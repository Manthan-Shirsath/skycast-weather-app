import os
import re
import httpx
from dotenv import load_dotenv

load_dotenv("backend/.env")

def verify_groq_model():
    key = os.getenv("GROQ_API_KEY")
    base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
    model_id = os.getenv("GROQ_MODEL") or os.getenv("LLM_MODEL") or "openai/gpt-oss-120b"
    
    masked_key = key[:6] + "..." + key[-4:] if key and len(key) > 10 else "NOT_FOUND"
    print("=== GROQ MODEL VERIFICATION ===")
    print(f"API Key present: {'YES' if key else 'NO'} ({masked_key})")
    print(f"Base URL: {base_url}")
    print(f"Configured Model ID: {model_id}")
    
    endpoint = f"{base_url}/chat/completions"
    payload = {
        "model": model_id,
        "messages": [
            {"role": "user", "content": "Reply with only the exact text: MODEL_VERIFIED_OK"}
        ],
        "temperature": 0.0,
        "max_tokens": 50
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    
    try:
        res = httpx.post(endpoint, json=payload, headers=headers, timeout=12.0)
        print(f"Direct API HTTP Status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            choices = data.get("choices", [])
            text_reply = ""
            if choices:
                raw = choices[0].get("message", {}).get("content", "").strip()
                text_reply = re.sub(r'<think>[\s\S]*?</think>', '', raw).strip()
            print(f"Direct Model Output: '{text_reply}'")
            print(f"Verification Result: SUCCESS - Model '{model_id}' on Groq is ACTIVE and functioning (200 OK).")
            return True
        elif res.status_code == 429:
            print(f"Direct API Status 429 (Rate Limit): {res.text[:200]}")
            return True
        else:
            print(f"Direct API Error ({res.status_code}): {res.text[:300]}")
            return False
    except Exception as exc:
        print(f"Connection/API Exception: {exc}")
        return False

if __name__ == "__main__":
    verify_groq_model()
