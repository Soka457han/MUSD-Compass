"""MUSD Compass Telegram bot: command routing. Replies are returned as Bot API method payloads,
so the webhook can answer in the HTTP response itself (no bot token needed to reply).
Source: https://core.telegram.org/bots/api#making-requests-when-getting-updates

The bot is thin: every number comes from the Compass JSON API, the same one the web page uses.
Local run without a webhook: TELEGRAM_BOT_TOKEN=... python compass_bot.py --poll
"""

from __future__ import annotations

import html
import os
import re
import time
from datetime import datetime, timezone
from urllib.parse import quote, urlencode

import httpx

WEB_URL = os.environ.get("COMPASS_WEB_URL", "https://musd-compass.vercel.app").rstrip("/")
API_URL = os.environ.get("COMPASS_API_URL", WEB_URL).rstrip("/")
SAMPLE_WALLET = "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C"  # public dev wallet with a testnet deposit
TOP = 5
DEFAULT_AMOUNT = 2000
ADDRESS = re.compile(r"^0x[0-9a-fA-F]{40}$")

HELP = (
    "<b>MUSD Compass</b> — where Mezo MUSD earns the most after costs.\n\n"
    "/yield [amount] — top places for your MUSD (default 2,000)\n"
    "/carry &lt;amount&gt; [borrow] — same, as a borrower on a new trove\n"
    "/vault &lt;address&gt; — your testnet Savings Vault position\n"
    f"   try: <code>/vault {SAMPLE_WALLET}</code>\n\n"
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
    if r["kind"] == "from":
        return f"from {_n(r['min'])} MUSD"
    return f"{_n(r['min'])}–{_n(r['max'])} MUSD"


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


COMMANDS = {"yield": cmd_yield, "carry": cmd_carry, "vault": cmd_vault}

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
    handler = COMMANDS.get(command)
    if handler is None:
        return HELP
    try:
        return handler(args)
    except ApiError as e:
        return html.escape(str(e))
    except (KeyError, TypeError, ValueError):
        return DOWN  # the API answered with a shape this bot doesn't know


def handle_update(update: dict) -> dict | None:
    """Return a sendMessage payload for a Telegram update, or None to ignore it."""
    message = update.get("message") or {}
    text = (message.get("text") or "").strip()
    chat_id = (message.get("chat") or {}).get("id")
    if chat_id is None or not text.startswith("/"):
        return None
    body = reply_text(text) if allowed(chat_id) else "Too many requests — try again in a minute."
    return {
        "method": "sendMessage",
        "chat_id": chat_id,
        "text": body,
        "parse_mode": "HTML",
        "link_preview_options": {"is_disabled": True},
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
