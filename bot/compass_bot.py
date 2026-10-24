"""MUSD Compass Telegram bot: command routing. Replies are returned as Bot API method payloads,
so the webhook can answer in the HTTP response itself (no bot token needed to reply).
Source: https://core.telegram.org/bots/api#making-requests-when-getting-updates
"""

from __future__ import annotations

import os

WEB_URL = os.environ.get("COMPASS_WEB_URL", "https://musd-compass.vercel.app")
HELP = (
    "<b>MUSD Compass</b> — where Mezo MUSD earns the most after costs.\n"
    f"Bot commands are being built; meanwhile open {WEB_URL}"
)


def handle_update(update: dict) -> dict | None:
    """Return a sendMessage payload for a Telegram update, or None to ignore it."""
    message = update.get("message") or {}
    text = (message.get("text") or "").strip()
    chat_id = (message.get("chat") or {}).get("id")
    if chat_id is None or not text.startswith("/"):
        return None
    return {
        "method": "sendMessage",
        "chat_id": chat_id,
        "text": HELP,
        "parse_mode": "HTML",
        "link_preview_options": {"is_disabled": True},
    }
