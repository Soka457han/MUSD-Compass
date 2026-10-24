import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from compass_bot import handle_update  # noqa: E402
from api.telegram import handler  # noqa: E402


def update(text, chat_id=42):
    return {"update_id": 1, "message": {"message_id": 1, "chat": {"id": chat_id}, "text": text}}


def test_command_gets_a_send_message_reply():
    reply = handle_update(update("/start"))
    assert reply["method"] == "sendMessage"
    assert reply["chat_id"] == 42
    assert "MUSD Compass" in reply["text"]


def test_plain_text_and_non_messages_are_ignored():
    assert handle_update(update("hello")) is None
    assert handle_update({"update_id": 2, "edited_message": {}}) is None


class FakeRequest(handler):
    """Drive the BaseHTTPRequestHandler without a socket."""

    def __init__(self, headers, body):
        self.headers = headers
        self.rfile = io.BytesIO(body)
        self.wfile = io.BytesIO()
        self.status = None

    def send_response(self, code, message=None):
        self.status = code

    def send_header(self, *a):
        pass

    def end_headers(self):
        pass


def post(headers, body):
    req = FakeRequest(headers, body)
    req.do_POST()
    return req.status, json.loads(req.wfile.getvalue() or b"{}")


def test_webhook_rejects_missing_or_wrong_secret(monkeypatch):
    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", "s3cret")
    body = json.dumps(update("/start")).encode()
    assert post({"Content-Length": str(len(body))}, body)[0] == 401
    assert post({"Content-Length": str(len(body)), "X-Telegram-Bot-Api-Secret-Token": "nope"}, body)[0] == 401


def test_webhook_rejects_everything_when_secret_unset(monkeypatch):
    monkeypatch.delenv("TELEGRAM_WEBHOOK_SECRET", raising=False)
    body = json.dumps(update("/start")).encode()
    assert post({"Content-Length": str(len(body)), "X-Telegram-Bot-Api-Secret-Token": ""}, body)[0] == 401


def test_webhook_replies_with_method_payload(monkeypatch):
    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", "s3cret")
    body = json.dumps(update("/start")).encode()
    status, reply = post({"Content-Length": str(len(body)), "X-Telegram-Bot-Api-Secret-Token": "s3cret"}, body)
    assert status == 200
    assert reply["method"] == "sendMessage"
