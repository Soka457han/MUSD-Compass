"""Vercel Python function: Telegram webhook entry point.
Handler shape per https://vercel.com/docs/functions/runtimes/python/api-directory
"""

import hmac
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from compass_bot import handle_update  # noqa: E402

SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"  # https://core.telegram.org/bots/api#setwebhook
MAX_BODY = 1_000_000


class handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: dict | None = None) -> None:
        data = json.dumps(body or {}).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        self._send(200, {"ok": True, "service": "musd-compass-bot"})

    def do_POST(self) -> None:
        expected = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
        given = self.headers.get(SECRET_HEADER, "")
        # Safe default: with no secret configured, every update is rejected.
        if not expected or not hmac.compare_digest(expected, given):
            self._send(401, {"ok": False})
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            self._send(400, {"ok": False})
            return
        try:
            update = json.loads(self.rfile.read(length))
        except ValueError:
            self._send(400, {"ok": False})
            return
        self._send(200, handle_update(update) or {})
