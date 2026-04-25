import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load credentials from frontend/.env
env_path = Path(__file__).parent.parent / 'frontend' / '.env'
load_dotenv(dotenv_path=env_path)

# Add the current directory to sys.path so we can import shared
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from shared.bedrock import invoke_bedrock

def test_bedrock():
    print("Testing Bedrock invocation...")
    result = invoke_bedrock(
        amount=5000.00,
        payee="Suspicious Account",
        time="2024-04-25T00:00:00Z",
        payee_age_days=2,
        prior_txns=0,
        score=85,
        signals=["new_payee", "high_amount", "unusual_time"]
    )
    print("Bedrock Result:")
    import json
    print(json.dumps(result, indent=2))
    
if __name__ == "__main__":
    test_bedrock()
