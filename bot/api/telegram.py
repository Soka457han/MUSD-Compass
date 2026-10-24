"""Vercel Python function: Telegram webhook entry point, as a standard-library WSGI app.
Vercel loads `app` via [tool.vercel] entrypoint in pyproject.toml:
https://vercel.com/docs/functions/runtimes/python#python-entrypoints
"""

import hmac
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from compass_bot import handle_update  # noqa: E402

# Telegram sends X-Telegram-Bot-Api-Secret-Token (https://core.telegram.org/bots/api#setwebhook);
# WSGI exposes request headers as HTTP_<NAME> with dashes turned into underscores.
SECRET_KEY = "HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN"
MAX_BODY = 1_000_000

STATUS = {200: "200 OK", 400: "400 Bad Request", 401: "401 Unauthorized", 405: "405 Method Not Allowed"}


def _reply(start_response, status: int, body: dict) -> list[bytes]:
    data = json.dumps(body).encode()
    start_response(STATUS[status], [("Content-Type", "application/json"), ("Content-Length", str(len(data)))])
    return [data]


def _secret_ok(environ) -> bool:
    expected = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
    given = environ.get(SECRET_KEY, "")
    # Safe default: with no secret configured, every update is rejected. Bytes, so non-ASCII input can't raise.
    return bool(expected) and hmac.compare_digest(expected.encode(), given.encode())


def app(environ, start_response):
    method = environ.get("REQUEST_METHOD", "GET")
    if method == "GET":
        return _reply(start_response, 200, {"ok": True, "service": "musd-compass-bot"})
    if method != "POST":
        return _reply(start_response, 405, {"ok": False})
    if not _secret_ok(environ):
        return _reply(start_response, 401, {"ok": False})
    try:
        length = int(environ.get("CONTENT_LENGTH") or 0)
    except ValueError:
        length = 0
    if length <= 0 or length > MAX_BODY:
        return _reply(start_response, 400, {"ok": False})
    try:
        update = json.loads(environ["wsgi.input"].read(length))
    except ValueError:
        return _reply(start_response, 400, {"ok": False})
    return _reply(start_response, 200, handle_update(update) or {})
