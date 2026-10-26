import json
import os
import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import compass_bot  # noqa: E402
from compass_bot import handle_update  # noqa: E402

FIX = Path(__file__).parent / "fixtures"
SAMPLE = "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C"


class FakeApi:
    """Stands in for httpx.get: records calls, serves recorded API responses."""

    def __init__(self, status=200, body=None, error=None):
        self.calls, self.status, self.body, self.error = [], status, body, error

    def __call__(self, url, params=None, headers=None, timeout=None):
        self.calls.append({"url": url, "params": params, "headers": headers})
        if self.error:
            raise self.error
        if self.body is not None:
            body = self.body
        elif "/api/trove/" in url:
            body = json.loads((FIX / "trove.json").read_text())
        elif "/api/rewards/" in url:
            body = json.loads((FIX / "rewards.json").read_text())
        elif "/api/vault/" in url:
            body = json.loads((FIX / "vault.json").read_text())
        elif (params or {}).get("mode") == "borrower":
            body = json.loads((FIX / "yields_1000_borrower.json").read_text())
        else:
            body = json.loads((FIX / "yields_2000.json").read_text())
        return httpx.Response(self.status, json=body)


@pytest.fixture
def api(monkeypatch):
    fake = FakeApi()
    monkeypatch.setattr(compass_bot.httpx, "get", fake)
    monkeypatch.setenv("BOT_API_KEY", "k")
    compass_bot._seen.clear()
    return fake


def say(text, chat_id=1):
    return handle_update({"update_id": 1, "message": {"chat": {"id": chat_id}, "text": text}})["text"]


def test_yield_ranks_cash_first_with_labels_and_links(api):
    text = say("/yield")
    assert api.calls[0]["params"] == {"amount": "2000"}
    assert api.calls[0]["headers"] == {"x-compass-bot": "k"}
    assert text.index("Savings Vault") < text.index("Curve")  # API order = cash carry
    assert "cash 4.01%" in text
    assert "with 🔒 4.64%" in text  # locked shown beside cash, not inside it
    assert "beats the Vault: cash never · with 🔒 568–57,591 MUSD" in text  # Ethereum break-even
    assert "Mainnet data · assumes 90-day hold" in text
    assert "/vault?action=deposit&amp;amount=2000" in text
    assert "/?amount=2000&amp;mode=holder&amp;days=90" in text
    assert "more with no APR" in text


def test_yield_amount_parsing(api):
    say("/yield 5,000")
    assert api.calls[0]["params"] == {"amount": "5000"}
    assert "Usage: /yield" in say("/yield lots")
    say("/yield@musd_compass_bot 300")  # group-chat form
    assert api.calls[-1]["params"] == {"amount": "300"}


def test_carry_borrow_shows_api_notice_as_is(api):
    text = say("/carry 1000 borrow")
    assert api.calls[0]["params"] == {"amount": "1000", "mode": "borrower"}
    assert "⚠️ New troves need at least 1,800 MUSD of debt" in text
    assert "new trove, 1% rate, 0.1% fee" in text
    assert "with 🔒 1,799–57,591 MUSD" in text  # 1,798.21 rounds up: 1,798 could not open a trove
    assert "Usage: /carry" in say("/carry")
    assert "Usage: /carry" in say("/carry 1000 lend")


def test_vault_reads_testnet_position(api):
    text = say(f"/vault {SAMPLE}")
    assert api.calls[0]["url"].endswith(f"/api/vault/{SAMPLE}")
    assert "Testnet" in text and "Wallet: 157.31 MUSD" in text and "Pending yield: 0.0000" in text


def test_vault_usage_offers_sample_and_never_calls_api_for_bad_input(api):
    text = say("/vault 0x123")
    assert SAMPLE in text and "public address only" in text
    assert api.calls == []


def test_help_lists_commands_and_sample_and_never_asks_for_keys(api):
    for cmd in ("/start", "/help", "/nope"):
        text = say(cmd)
        assert "/yield" in text and "/carry" in text and SAMPLE in text
        assert "never asks for keys" in text
    assert api.calls == []


def test_api_down_and_api_errors_are_friendly(api, monkeypatch):
    monkeypatch.setattr(compass_bot.httpx, "get", FakeApi(error=httpx.ConnectTimeout("t")))
    assert "unavailable right now" in say("/yield")
    monkeypatch.setattr(compass_bot.httpx, "get", FakeApi(status=500, body={}))
    assert "unavailable right now" in say("/yield")
    monkeypatch.setattr(compass_bot.httpx, "get", FakeApi(status=400, body={"error": "amount must be < 10,000,000."}))
    assert say("/yield 99999999999") == "amount must be &lt; 10,000,000."
    monkeypatch.setattr(compass_bot.httpx, "get", FakeApi(body={"unexpected": True}))
    assert "unavailable right now" in say("/yield")


def test_per_chat_rate_limit():
    compass_bot._seen.clear()
    assert all(compass_bot.allowed(7, now=100.0) for _ in range(10))
    assert not compass_bot.allowed(7, now=101.0)
    assert compass_bot.allowed(8, now=101.0)  # other chats unaffected
    assert compass_bot.allowed(7, now=200.0)  # window passed


def test_rewards_shows_unclaimed_warning_and_usage(api):
    text = say("/rewards 0xeaC6A75e19beB1283352d24c0311De865a867DAB")
    assert api.calls[0]["url"].endswith("/api/rewards/0xeaC6A75e19beB1283352d24c0311De865a867DAB")
    assert "🔒 Unclaimed: 239.28 veMEZO (≈ $0.71 at MEZO spot)" in text
    assert "reallocated" in text and "Claim: https://app.merkl.xyz" in text
    assert "0xeaC6A75e19beB1283352d24c0311De865a867DAB" in say("/rewards nope")
    assert "/rewards" in say("/help")


def test_trove_shows_ratio_rate_queue_and_safe_borrow(api):
    text = say("/trove sample")
    assert api.calls[0]["url"].endswith("/api/trove/sample")
    assert "Collateral ratio: 333%" in text and "Interest rate: 1%" in text
    assert "≈ 812 of 1,204 troves are redeemed before yours" in text
    assert "Borrow up to <b>20,068 MUSD</b> more and stay at or above 200%" in text
    assert "Usage: /trove" in say("/trove 0x12")


# ---- buttons ----

def send(text, reply_to=None, chat_id=1):
    message = {"chat": {"id": chat_id}, "text": text}
    if reply_to is not None:
        message["reply_to_message"] = {"text": reply_to}
    return handle_update({"update_id": 1, "message": message})


def test_every_answer_carries_the_buttons(api):
    rows = send("/start")["reply_markup"]["keyboard"]
    labels = [b["text"] for row in rows for b in row]
    assert labels == list(compass_bot.ASK) + [compass_bot.B_HELP]


def test_a_button_that_needs_an_address_asks_for_it_then_answers_the_reply(api):
    ask = send(compass_bot.B_VAULT)
    assert ask["reply_markup"]["force_reply"] is True
    assert api.calls == []  # asking costs no API call
    out = send(SAMPLE, reply_to=ask["text"])
    assert api.calls[0]["url"].endswith(f"/api/vault/{SAMPLE}")
    assert "Savings Vault" in out["text"]
    assert "keyboard" in out["reply_markup"]


def test_sample_works_for_each_address_button(api):
    for button, path in [(compass_bot.B_VAULT, "/api/vault/"), (compass_bot.B_REWARDS, "/api/rewards/"), (compass_bot.B_TROVE, "/api/trove/sample")]:
        api.calls.clear()
        send("sample", reply_to=send(button)["text"])
        assert path in api.calls[0]["url"]


def test_amount_buttons_and_bare_numbers(api):
    send("5,000", reply_to=send(compass_bot.B_YIELD)["text"])
    assert api.calls[-1]["params"] == {"amount": "5000"}
    send("2000", reply_to=send(compass_bot.B_CARRY)["text"])
    assert api.calls[-1]["params"] == {"amount": "2000", "mode": "borrower"}
    send("3000")  # a number with no question asked: best places for that much
    assert api.calls[-1]["params"] == {"amount": "3000"}


def test_a_bad_reply_gets_the_usage_line_and_no_api_call(api):
    out = send("0x123", reply_to=send(compass_bot.B_REWARDS)["text"])
    assert "Usage: /rewards" in out["text"]
    assert api.calls == []


def test_help_button_shows_the_faq_and_the_key_warning(api):
    text = send(compass_bot.B_HELP)["text"]
    assert "What does 🔒 mean?" in text
    assert "Never send a seed phrase" in text
    assert api.calls == []


def test_api_busy_messages_are_passed_on_and_a_pending_scan_is_not_called_none(api):
    api.status, api.body = 503, {"error": "Mezo testnet did not answer — try again in a minute."}
    assert "Mezo testnet did not answer" in say(f"/vault {SAMPLE}")
    api.status, api.body = 200, {**json.loads((FIX / "vault.json").read_text()), "lastDistribution": None, "lastDistributionPending": True}
    assert "still being read" in say(f"/vault {SAMPLE}")
