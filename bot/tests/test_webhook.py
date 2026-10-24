import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.telegram import app  # noqa: E402
from compass_bot import handle_update  # noqa: E402

SECRET = "HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN"


def update(text, chat_id=42):
    return {"update_id": 1, "message": {"message_id": 1, "chat": {"id": chat_id}, "text": text}}


def call(method="POST", body=b"", headers=None):
    environ = {"REQUEST_METHOD": method, "CONTENT_LENGTH": str(len(body)), "wsgi.input": io.BytesIO(body), **(headers or {})}
    seen = {}

    def start_response(status, response_headers):
        seen["status"] = int(status.split()[0])

    out = b"".join(app(environ, start_response))
    return seen["status"], json.loads(out or b"{}")


def test_command_gets_a_send_message_reply():
    reply = handle_update(update("/start"))
    assert reply["method"] == "sendMessage"
    assert reply["chat_id"] == 42
    assert "MUSD Compass" in reply["text"]


def test_plain_text_and_non_messages_are_ignored():
    assert handle_update(update("hello")) is None
    assert handle_update({"update_id": 2, "edited_message": {}}) is None


def test_webhook_rejects_missing_or_wrong_secret(monkeypatch):
    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", "s3cret")
    body = json.dumps(update("/start")).encode()
    assert call(body=body)[0] == 401  # header absent
    assert call(body=body, headers={SECRET: "nope"})[0] == 401
    assert call(body=body, headers={SECRET: "s3crét"})[0] == 401  # non-ASCII must not raise


def test_webhook_rejects_everything_when_secret_unset(monkeypatch):
    monkeypatch.delenv("TELEGRAM_WEBHOOK_SECRET", raising=False)
    body = json.dumps(update("/start")).encode()
    assert call(body=body, headers={SECRET: ""})[0] == 401


def test_webhook_replies_with_method_payload_and_guards_body(monkeypatch):
    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", "s3cret")
    body = json.dumps(update("/start")).encode()
    status, reply = call(body=body, headers={SECRET: "s3cret"})
    assert status == 200 and reply["method"] == "sendMessage"
    assert call(body=b"", headers={SECRET: "s3cret"})[0] == 400
    assert call(body=b"{not json", headers={SECRET: "s3cret"})[0] == 400
    assert call(method="GET")[0] == 200
