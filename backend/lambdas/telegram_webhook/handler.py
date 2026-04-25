import json
import os
import time
import requests
import boto3
from botocore.exceptions import ClientError

# Read env vars
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8652683424:AAHO_QfnAJCyCS_2VEREkmaCTFwkhJ77Nfo")
DYNAMODB_TABLE = os.environ.get("CHAT_HISTORY_TABLE", "SafeSendTelegramChatHistory")
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0")

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(DYNAMODB_TABLE)
bedrock = boto3.client("bedrock-runtime", region_name=os.environ.get("BEDROCK_REGION", "us-east-1"))

TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"

def get_chat_history(chat_id):
    try:
        response = table.get_item(Key={"chat_id": str(chat_id)})
        return response.get("Item", {}).get("messages", [])
    except ClientError as e:
        print(f"Error fetching history: {e}")
        return []

def save_chat_history(chat_id, messages):
    # Keep only the last 10 messages (5 pairs) to fit in context and keep it cheap
    messages = messages[-10:]
    try:
        table.put_item(
            Item={
                "chat_id": str(chat_id),
                "messages": messages,
                "updated_at": int(time.time()),
                "expires_at": int(time.time()) + 86400  # 1 day TTL
            }
        )
    except ClientError as e:
        print(f"Error saving history: {e}")

def call_bedrock(messages, user_text):
    # System prompt based on the AntiFraudChatBot concept
    system_prompt = """You are SafeSend Anti-Fraud AI, an intelligent chatbot designed to help users identify and prevent scams.
You detect urgency, government impersonation, requests for money, and suspicious links.
Respond directly, naturally, and warmly to the user. Keep it conversational like a chat on Telegram.
If you detect a scam pattern, explain why it's a scam clearly and advise them not to transfer money.
Otherwise, just have a helpful conversation."""

    # Format history for Claude
    formatted_messages = []
    for msg in messages:
        formatted_messages.append({
            "role": msg["role"],
            "content": [{"text": msg["content"]}]
        })
    
    formatted_messages.append({
        "role": "user",
        "content": [{"text": user_text}]
    })

    payload = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 512,
        "system": system_prompt,
        "messages": formatted_messages,
        "temperature": 0.5
    }

    try:
        response = bedrock.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(payload)
        )
        response_body = json.loads(response['body'].read())
        return response_body["content"][0]["text"]
    except Exception as e:
        print(f"Bedrock Error: {e}")
        return "I'm sorry, I encountered an issue analyzing your message. Please try again later."

def send_telegram_message(chat_id, text):
    payload = {
        "chat_id": chat_id,
        "text": text
    }
    try:
        requests.post(TELEGRAM_API_URL, json=payload, timeout=5)
    except Exception as e:
        print(f"Telegram API Error: {e}")

def handler(event, context):
    print("Received event:", json.dumps(event))
    
    # API Gateway HTTP API payload comes in event['body'] as string
    body = event.get('body', '{}')
    try:
        data = json.loads(body)
    except Exception:
        return {"statusCode": 400, "body": "Invalid JSON"}

    # If it's a webhook verification or missing message
    if "message" not in data:
        return {"statusCode": 200, "body": "OK"}

    message = data["message"]
    chat_id = message.get("chat", {}).get("id")
    text = message.get("text", "")

    if not chat_id or not text:
        return {"statusCode": 200, "body": "Ignored"}

    # 1. Get history
    history = get_chat_history(chat_id)

    # 2. Call LLM
    bot_reply = call_bedrock(history, text)

    # 3. Send reply back to Telegram
    send_telegram_message(chat_id, bot_reply)

    # 4. Save history
    history.append({"role": "user", "content": text})
    history.append({"role": "assistant", "content": bot_reply})
    save_chat_history(chat_id, history)

    return {"statusCode": 200, "body": "Success"}
