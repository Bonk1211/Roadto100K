"""
SafeSend Backend — AWS SNS SMS Sender

Triggers SMS notifications via the `safesend-user-alerts` SNS topic
when a transaction is blocked by an agent.
"""

import boto3
from .config import AWS_REGION, SNS_TOPIC_ARN

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client("sns", region_name=AWS_REGION)
    return _client


def send_block_sms(user_phone: str | None, amount: float) -> bool:
    """Send a block notification SMS via SNS."""
    if not SNS_TOPIC_ARN:
        print("[sns] SNS_TOPIC_ARN not configured, skipping SMS")
        return False

    message = (
        f"SafeSend: Your TnG transfer of RM {amount:,.2f} "
        f"has been blocked. Contact support if this was not you."
    )

    try:
        _get_client().publish(
            TopicArn=SNS_TOPIC_ARN,
            Message=message,
            Subject="SafeSend Alert",
        )
        mask = user_phone[:5] + "****" + user_phone[-3:] if user_phone and len(user_phone) >= 7 else "unknown"
        print(f"[sns] Block SMS published for RM {amount:,.2f} (user: {mask})")
        return True
    except Exception as e:
        print(f"[sns] Error sending SMS: {e}")
        return False
