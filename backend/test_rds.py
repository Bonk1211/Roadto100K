import os
import socket
from pathlib import Path
from dotenv import load_dotenv

def test_rds_connection():
    # Load environment variables from frontend/.env
    env_path = Path(__file__).parent.parent / 'frontend' / '.env'
    load_dotenv(dotenv_path=env_path)
    
    host = os.getenv("RDSHOST")
    port = os.getenv("RDSPORT")
    
    if not host or not port:
        print("❌ RDS_HOST or RDS_PORT not found in .env")
        return

    print(f"Testing connection to {host}:{port}...")
    
    try:
        # Test if the port is open
        with socket.create_connection((host, int(port)), timeout=5):
            print(f"✅ Successfully connected to {host}:{port} (Port is OPEN)")
    except Exception as e:
        print(f"❌ Failed to connect to {host}:{port}")
        print(f"Error: {e}")

if __name__ == "__main__":
    test_rds_connection()
