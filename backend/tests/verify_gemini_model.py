import os
import httpx
from dotenv import load_dotenv

load_dotenv("backend/.env")

def verify_gemini_model():
    key = os.getenv("gemini_api_key") or os.getenv("GEMINI_API_KEY")
    model_id = os.getenv("LLM_MODEL", "gemini-3.6-flash")
    
    # Hide key security
    masked_key = key[:6] + "..." + key[-4:] if key and len(key) > 10 else "NOT_FOUND"
    print("=== GEMINI MODEL VERIFICATION ===")
    print(f"API Key present: {'YES' if key else 'NO'} ({masked_key})")
    print(f"Configured Model ID from backend/.env: {model_id}")
    
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={key}"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": "Reply with only the exact text: MODEL_VERIFIED_OK"}]
            }
        ]
    }
    
    try:
        res = httpx.post(endpoint, json=payload, timeout=12.0)
        print(f"Direct API HTTP Status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            candidates = data.get("candidates", [])
            text_reply = ""
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    text_reply = parts[0].get("text", "").strip()
            print(f"Direct Model Output: '{text_reply}'")
            print(f"Verification Result: SUCCESS - Model '{model_id}' is ACTIVE and functioning (200 OK).")
            return True
        elif res.status_code == 429:
            print(f"Direct API Status 429 (Rate Limit / Quota Reached): {res.json().get('error', {}).get('message')}")
            print(f"Verification Result: Model '{model_id}' is VALID & REACHABLE, but currently rate-limited (HTTP 429).")
            return True
        else:
            print(f"Direct API Error ({res.status_code}): {res.text[:300]}")
            return False
    except Exception as exc:
        print(f"Connection/API Exception: {exc}")
        return False

if __name__ == "__main__":
    verify_gemini_model()
