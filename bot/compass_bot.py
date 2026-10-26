"""MUSD Compass Telegram bot: command routing. Replies are returned as Bot API method payloads,
so the webhook can answer in the HTTP response itself (no bot token needed to reply).
Source: https://core.telegram.org/bots/api#making-requests-when-getting-updates

The bot is thin: every number comes from the Compass JSON API, the same one the web page uses.
Local run without a webhook: TELEGRAM_BOT_TOKEN=... python compass_bot.py --poll
"""

from __future__ import annotations

import html
import math
import os
import re
import time
from datetime import datetime, timezone
from urllib.parse import quote, urlencode

import httpx

WEB_URL = os.environ.get("COMPASS_WEB_URL", "https://musd-compass.vercel.app").rstrip("/")
API_URL = os.environ.get("COMPASS_API_URL", WEB_URL).rstrip("/")
SAMPLE_WALLET = "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C"  # public dev wallet with a testnet deposit
SAMPLE_REWARDS = "0xeaC6A75e19beB1283352d24c0311De865a867DAB"  # public address with unclaimed veMEZO
TOP = 5
DEFAULT_AMOUNT = 2000
ADDRESS = re.compile(r"^0x[0-9a-fA-F]{40}$")

HELP = (
    "<b>MUSD Compass</b> — where Mezo MUSD earns the most after costs.\n\n"
    "Tap a button below. If it needs an amount or an address, the bot asks for it.\n\n"
    "Or type a command:\n"
    "/yield [amount] — top places for your MUSD (default 2,000)\n"
    "/carry &lt;amount&gt; [borrow] — same, as a borrower on a new trove\n"
    "/vault &lt;address&gt; — your testnet Savings Vault position\n"
    f"   try: <code>/vault {SAMPLE_WALLET}</code>\n"
    "/rewards &lt;address&gt; — unclaimed veMEZO from Merkl\n"
    "/trove &lt;address&gt; — your trove: ratio, rate, safe extra borrow (or <code>/trove sample</code>)\n"
    f"   try: <code>/rewards {SAMPLE_REWARDS}</code>\n\n"
    "Cash carry ranks; 🔒 = locked veMEZO, shown beside it, never counted as cash.\n"
    "Compass never asks for keys or seed phrases.\n"
    f"Web: {WEB_URL}"
)
DOWN = f"Compass data is unavailable right now — try again in a minute, or open {WEB_URL}"


class ApiError(Exception):
    """A reply-ready sentence: either the API's own validation error or the 'down' message."""


def api_get(path: str, params: dict | None = None) -> dict:
    headers = {"x-compass-bot": os.environ.get("BOT_API_KEY", "")}
    try:
        r = httpx.get(f"{API_URL}{path}", params=params, headers=headers, timeout=25)
    except httpx.HTTPError as e:
        raise ApiError(DOWN) from e
    if r.status_code == 400:
        raise ApiError(r.json().get("error", DOWN))
    if r.status_code != 200:
        raise ApiError(DOWN)
    return r.json()


# ---- formatting ----

def _pct(x: float) -> str:
    return f"{x:.2f}%"


def _n(x: float) -> str:
    return f"{x:,.0f}"


def _range(r: dict) -> str:
    if r["kind"] == "never":
        return "never"
    # Round inward so every amount shown is inside the range (e.g. 1,798.21 → 1,799, the real trove minimum).
    lo = _n(math.ceil(r["min"]))
    if r["kind"] == "from":
        return f"from {lo} MUSD"
    return f"{lo}–{_n(math.floor(r['max']))} MUSD"


def _venue(i: int, v: dict) -> str:
    c = v["carry"]
    line = f"{i}. <b>{html.escape(v['name'])}</b> — cash {_pct(c['cash'])}"
    if c["locked"]:
        line += f" · with 🔒 {_pct(c['total'])}"
    if v.get("breakEven"):
        b = v["breakEven"]
        line += f"\n   beats the Vault: cash {_range(b['cash'])} · with 🔒 {_range(b['total'])}"
    return line


def format_yields(d: dict, title: str) -> str:
    a = d["assumptions"]
    ranked = [v for v in d["venues"] if v["status"] == "ok" and v["carry"]["cash"] is not None]
    size_only = sum(1 for v in d["venues"] if v["status"] == "ok" and v["carry"]["cash"] is None)
    down = [v["name"] for v in d["venues"] if v["status"] != "ok"]
    lines = [title, ""]
    if d.get("notice"):
        lines += [f"⚠️ {html.escape(d['notice'])}", ""]
    lines += [_venue(i, v) for i, v in enumerate(ranked[:TOP], 1)]
    if size_only:
        lines.append(f"+ {size_only} more with no APR to compare (pool size only) on the web")
    if down:
        lines.append("Unavailable now: " + html.escape(", ".join(down)))
    query = {"amount": a["amount"], "mode": a["mode"], "days": a["days"]}
    lines += [
        "",
        f"<i>Mainnet data · assumes {a['days']}-day hold</i>",
        f"Full table: {html.escape(f'{WEB_URL}/?{urlencode(query)}')}",
        f"Try the Savings Vault (testnet): {WEB_URL}/vault?action=deposit&amp;amount={a['amount']:g}",
    ]
    return "\n".join(lines)


def _ago(ts: int | None) -> str:
    if not ts:
        return "none seen yet"
    hours = (time.time() - ts) / 3600
    when = datetime.fromtimestamp(ts, timezone.utc).strftime("%d %b %H:%M UTC")
    return f"{when} ({hours / 24:.0f} days ago)" if hours >= 48 else f"{when} ({hours:.0f} h ago)"


def format_vault(d: dict) -> str:
    return "\n".join([
        f"<b>Savings Vault</b> · <code>{d['address']}</code>",
        "<i>Testnet — real Mezo contracts, test funds.</i>",
        "",
        f"In vault: {float(d['smusd']):,.2f} sMUSD",
        f"Pending yield: {float(d['pendingYield']):,.4f} MUSD",
        f"Wallet: {float(d['musd']):,.2f} MUSD",
        f"Last distribution: {_ago(d.get('lastDistribution'))}",
        "",
        f"Deposit, claim or withdraw: {WEB_URL}/vault",
    ])


# ---- commands ----

def _amount(arg: str | None) -> float | None:
    if arg is None:
        return None
    try:
        return float(arg.replace(",", ""))
    except ValueError:
        return None


def cmd_yield(args: list[str]) -> str:
    amount = _amount(args[0]) if args else DEFAULT_AMOUNT
    if amount is None:
        return "Usage: /yield [amount] — for example <code>/yield 5000</code>"
    d = api_get("/api/yields", {"amount": f"{amount:g}"})
    return format_yields(d, f"<b>Best places for {_n(amount)} MUSD</b> (holding)")


def cmd_carry(args: list[str]) -> str:
    amount = _amount(args[0]) if args else None
    borrow = len(args) > 1 and args[1].lower() == "borrow"
    if amount is None or (len(args) > 1 and not borrow):
        return "Usage: /carry &lt;amount&gt; [borrow] — for example <code>/carry 2000 borrow</code>"
    params = {"amount": f"{amount:g}", "mode": "borrower" if borrow else "holder"}
    d = api_get("/api/yields", params)
    if borrow:
        a = d["assumptions"]
        title = (f"<b>Carry on {_n(amount)} borrowed MUSD</b> (new trove, {a['ratePct']:g}% rate, "
                 f"{a['borrowParams']['feePct']:g}% fee — change these on the web)")
    else:
        title = f"<b>Carry on {_n(amount)} MUSD</b> (holding)"
    return format_yields(d, title)


def cmd_vault(args: list[str]) -> str:
    if not args or not ADDRESS.match(args[0]):
        return f"Usage: /vault &lt;address&gt; — public address only, for example\n<code>/vault {SAMPLE_WALLET}</code>"
    return format_vault(api_get(f"/api/vault/{quote(args[0])}"))


def format_rewards(d: dict) -> str:
    lines = [
        f"<b>Unclaimed veMEZO</b> · <code>{d['address']}</code>",
        "<i>Mezo mainnet · Merkl rewards for MUSD liquidity on Ethereum</i>",
        "",
        f"🔒 Unclaimed: {d['unclaimed']:,.2f} veMEZO" + (f" (≈ ${d['usd']:,.2f} at MEZO spot)" if d.get("usd") is not None else ""),
        f"Not claimable yet: {d['pending']:,.2f}",
    ]
    if d["unclaimed"] > 0:
        lines += ["", f"⚠️ {html.escape(d['warning'])}", html.escape(d["gas"]), f"Claim: {d['claimUrl']}"]
    else:
        lines += ["", "Nothing to claim right now."]
    lines += ["", "veMEZO is locked 12 weeks once claimed — Compass never counts it as cash."]
    return "\n".join(lines)


def cmd_rewards(args: list[str]) -> str:
    if not args or not ADDRESS.match(args[0]):
        return f"Usage: /rewards &lt;address&gt; — public address only, for example\n<code>/rewards {SAMPLE_REWARDS}</code>"
    return format_rewards(api_get(f"/api/rewards/{quote(args[0])}"))


def format_trove(d: dict) -> str:
    head = [f"<b>Trove</b> · <code>{d['address']}</code>", "<i>Mezo mainnet</i>", ""]
    if not d["active"]:
        return "\n".join(head + ["This address has no open trove."])
    queue = "unavailable right now" if d.get("ahead") is None else f"≈ {d['ahead']:,} of {d['troves']:,} troves are redeemed before yours"
    lines = head + [
        f"Collateral ratio: {d['icrPct']:,.0f}%",
        f"Interest rate: {d['ratePct']:g}%",
        f"Collateral: {d['collateralBtc']:,.4f} BTC · Debt: {d['debt']:,.2f} MUSD",
        f"Redemption queue: {queue}",
        "",
        f"Borrow up to <b>{d['safeExtra']:,.0f} MUSD</b> more and stay at or above {d['safeIcrPct']}% (fee counted; Mezo's minimum is {d['minIcrPct']}%).",
    ]
    if d.get("recoveryMode"):
        lines.append("⚠️ Mezo is in recovery mode: borrowing rules are stricter for now.")
    lines.append(f"Plan it: {WEB_URL}/trove")
    return "\n".join(lines)


def cmd_trove(args: list[str]) -> str:
    if not args or not (args[0] == "sample" or ADDRESS.match(args[0])):
        return "Usage: /trove &lt;address&gt; — public address only, or <code>/trove sample</code>"
    return format_trove(api_get(f"/api/trove/{quote(args[0])}"))


COMMANDS = {"yield": cmd_yield, "carry": cmd_carry, "vault": cmd_vault, "rewards": cmd_rewards, "trove": cmd_trove}

FAQ = (
    "<b>Help &amp; FAQ</b>\n\n"
    "<b>What is cash carry?</b>\nWhat you keep in MUSD after costs (gas, bridge, trove interest), per year. It ranks the list.\n\n"
    "<b>What does 🔒 mean?</b>\nRewards paid in veMEZO, locked 12 weeks once claimed. Shown beside the cash figure, never added to it.\n\n"
    "<b>Where do the numbers come from?</b>\nMezo mainnet and Ethereum, read live and kept for 5 minutes. The Savings Vault rate is its last 14 days of payouts.\n\n"
    "<b>Why is the vault on testnet?</b>\nWave 1 only sends transactions to Mezo testnet, with test MUSD. Get some: "
    f"{WEB_URL}/get-test-musd\n\n"
    "<b>Is it safe to send my address?</b>\nYes, an address is public. Never send a seed phrase or private key to anyone, this bot included.\n\n"
    "<b>Is this financial advice?</b>\nNo. It is arithmetic on public data.\n\n"
    f"Commands: /help · Web: {WEB_URL}"
)

# Buttons under the message box. A tap sends the label as text; labels that need input ask for it with a
# reply prompt, and the answer is matched back to the prompt it replies to (so the bot keeps no state).
B_YIELD, B_CARRY, B_VAULT, B_REWARDS, B_TROVE, B_HELP = "📈 Best yields", "🏦 Borrow carry", "💰 My vault", "🎁 My rewards", "🛡️ My trove", "❓ Help & FAQ"
KEYBOARD = {
    "keyboard": [[{"text": B_YIELD}, {"text": B_CARRY}], [{"text": B_VAULT}, {"text": B_REWARDS}], [{"text": B_TROVE}, {"text": B_HELP}]],
    "resize_keyboard": True,
    "is_persistent": True,
    "input_field_placeholder": "Tap a button",
}
ASK = {  # button -> (prompt the bot sends, command it runs on the answer, placeholder)
    B_YIELD: ("How much MUSD? Reply with a number, for example 2000.", "yield", "2000"),
    B_CARRY: ("How much MUSD do you want to borrow? Reply with a number, for example 2000.", "carry", "2000"),
    B_VAULT: ("Reply with your wallet address (0x…), or with the word sample.", "vault", "0x…"),
    B_REWARDS: ("Reply with the address to check for unclaimed veMEZO (0x…), or with the word sample.", "rewards", "0x…"),
    B_TROVE: ("Reply with the address that has the trove (0x…), or with the word sample.", "trove", "0x…"),
}
PROMPTS = {prompt: command for prompt, command, _ in ASK.values()}
SAMPLES = {"vault": SAMPLE_WALLET, "rewards": SAMPLE_REWARDS, "trove": "sample"}
NUDGE = "Tap a button below, or type /help."


def answer(command: str, value: str) -> str:
    """Runs a command with the value a person sent after a button prompt."""
    value = value.strip()
    if value.lower() == "sample" and command in SAMPLES:
        value = SAMPLES[command]
    args = [value, "borrow"] if command == "carry" else [value]
    return reply_text(f"/{command} " + " ".join(args))

# shortcut: per-instance memory, so the limit is per serverless instance; move to a shared store if abused.
RATE_WINDOW, RATE_MAX = 60, 10
_seen: dict[int, list[float]] = {}


def allowed(chat_id: int, now: float | None = None) -> bool:
    now = time.time() if now is None else now
    recent = [t for t in _seen.get(chat_id, []) if now - t < RATE_WINDOW]
    if len(_seen) > 10_000:
        _seen.clear()
    _seen[chat_id] = recent + [now]
    return len(recent) < RATE_MAX


def reply_text(text: str) -> str:
    name, *args = text.split()
    command = name[1:].split("@")[0].lower()  # "/yield@musd_compass_bot" in groups
    if command == "faq":
        return FAQ
    handler = COMMANDS.get(command)
    if handler is None:
        return HELP
    try:
        return handler(args)
    except ApiError as e:
        return html.escape(str(e))
    except (KeyError, TypeError, ValueError):
        return DOWN  # the API answered with a shape this bot doesn't know


def route(message: dict) -> tuple[str, dict]:
    """The reply text and the keyboard to show with it."""
    text = message["text"].strip()
    replied = message.get("reply_to_message")
    asked = replied.get("text") if isinstance(replied, dict) else None
    if text in ASK:
        prompt, _, placeholder = ASK[text]
        return prompt, {"force_reply": True, "input_field_placeholder": placeholder}
    if text == B_HELP:
        return FAQ, KEYBOARD
    if text.startswith("/"):
        return reply_text(text), KEYBOARD
    if isinstance(asked, str) and asked in PROMPTS:
        return answer(PROMPTS[asked], text), KEYBOARD
    if _amount(text) is not None:  # a bare number: best places for that much
        return reply_text(f"/yield {text}"), KEYBOARD
    return NUDGE, KEYBOARD


def handle_update(update: dict) -> dict | None:
    """Return a sendMessage payload for a Telegram update, or None to ignore it."""
    # The body is untrusted JSON: anything that isn't the documented shape is ignored, never a crash.
    message = update.get("message") if isinstance(update, dict) else None
    if not isinstance(message, dict):
        return None
    chat = message.get("chat")
    text = message.get("text")
    chat_id = chat.get("id") if isinstance(chat, dict) else None
    if not isinstance(chat_id, int) or not isinstance(text, str) or not text.strip():
        return None
    if allowed(chat_id):
        body, markup = route(message)
    else:
        body, markup = "Too many requests — try again in a minute.", KEYBOARD
    return {
        "method": "sendMessage",
        "chat_id": chat_id,
        "text": body,
        "parse_mode": "HTML",
        "link_preview_options": {"is_disabled": True},
        "reply_markup": markup,
    }


def poll() -> None:
    """Long-polling loop for local runs (needs the token; delete the webhook first)."""
    api = f"https://api.telegram.org/bot{os.environ['TELEGRAM_BOT_TOKEN']}"
    offset = 0
    while True:
        updates = httpx.get(f"{api}/getUpdates", params={"offset": offset, "timeout": 50}, timeout=60).json()
        for u in updates.get("result", []):
            offset = u["update_id"] + 1
            out = handle_update(u)
            if out:
                httpx.post(f"{api}/{out.pop('method')}", json=out, timeout=30)


if __name__ == "__main__":
    import sys

    if "--poll" in sys.argv:
        poll()
