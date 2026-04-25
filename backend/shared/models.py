"""
SafeSend Backend — Shared Data Models

Pydantic-style dict helpers and type constants used across all Lambda functions.
"""

from typing import TypedDict, Optional, Literal
from datetime import datetime, timezone
import uuid

# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------
ScamType = Literal[
    "macau_scam",
    "investment_scam",
    "love_scam",
    "account_takeover",
    "mule_account",
    "false_positive",
]

RiskLevel = Literal["low", "medium", "high"]
AlertStatus = Literal["open", "blocked", "warned", "cleared"]
AgentAction = Literal["block", "warn", "clear"]
UserChoice = Literal["cancel", "proceed", "report"]


# ---------------------------------------------------------------------------
# Signal definitions (7 risk signals from PRD Section 5)
# ---------------------------------------------------------------------------
class RiskSignal(TypedDict):
    signal: str
    label_en: str
    label_bm: str
    weight: int
    triggered: bool
    detail: Optional[str]


# ---------------------------------------------------------------------------
# Request / Response shapes
# ---------------------------------------------------------------------------
class ScreenTransactionRequest(TypedDict):
    user_id: str
    session_id: str
    payee_id: str
    payee_name: str
    amount: float
    currency: str
    device_id: str
    timestamp: str
    user_avg_30d: float


class AnalyseMessageRequest(TypedDict):
    message_text: str
    language_hint: str  # "BM" | "EN" | "auto"


class AgentActionRequest(TypedDict):
    action: AgentAction
    agent_id: str
    notes: str


class UserChoiceRequest(TypedDict):
    txn_id: str
    user_id: str
    choice: UserChoice
    timestamp: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def generate_request_id() -> str:
    """Generate a unique request ID (UUID v4)."""
    return str(uuid.uuid4())


def generate_txn_id() -> str:
    """Generate a unique transaction ID."""
    now = datetime.now(timezone.utc)
    seq = str(uuid.uuid4())[:5].upper()
    return f"TXN-{now.strftime('%Y%m%d')}-{seq}"


def now_iso() -> str:
    """Current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds") + "Z"


def action_to_status(action: AgentAction) -> AlertStatus:
    """Map agent action to alert status."""
    return {"block": "blocked", "warn": "warned", "clear": "cleared"}[action]


def action_to_label(action: AgentAction) -> int:
    """Map agent action to training label (1=scam, 0=false positive)."""
    return 0 if action == "clear" else 1
