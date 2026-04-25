"""
Shared pytest fixtures for SafeSend backend tests.

Loads AWS creds from ~/.aws/credentials (profile=default) so tests can hit
real Bedrock. Sets BEDROCK_REGION=ap-southeast-1 (where Claude 3 Haiku is
on-demand for this account).
"""

import os
import sys
import pathlib
import pytest

# Make `shared.*` importable from backend root.
BACKEND_ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

# Force AWS region for Bedrock; the Lambda template pins ap-southeast-1.
os.environ.setdefault("AWS_REGION", "ap-southeast-1")
os.environ.setdefault("BEDROCK_REGION", "ap-southeast-1")
os.environ.setdefault("AWS_PROFILE", "default")


def _bedrock_reachable() -> bool:
    """Probe Bedrock once. Skip live tests if unreachable."""
    try:
        import boto3

        client = boto3.client("bedrock", region_name=os.environ["BEDROCK_REGION"])
        client.list_foundation_models()
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[conftest] Bedrock unreachable: {exc}")
        return False


_REACHABLE = _bedrock_reachable()

needs_bedrock = pytest.mark.skipif(
    not _REACHABLE, reason="Bedrock not reachable — check AWS creds + region."
)


@pytest.fixture(scope="session")
def bedrock_reachable() -> bool:
    return _REACHABLE
