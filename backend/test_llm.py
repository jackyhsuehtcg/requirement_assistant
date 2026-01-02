import os
import httpx
import asyncio
from dotenv import load_dotenv

# Load env
load_dotenv()
api_key = os.getenv("OPENROUTER_API_KEY")

if not api_key:
    print("Error: OPENROUTER_API_KEY not found in .env")
    exit(1)

print(f"Testing OpenRouter connection with Key: {api_key[:8]}...")

# List of models to try (Free tier candidates)
candidate_models = [
    "qwen/qwen3-235b-a22b:free",
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-2.0-flash-thinking-exp:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "microsoft/phi-3-mini-128k-instruct:free",
    "mistralai/mistral-7b-instruct:free",
    "openchat/openchat-7b:free",
    "qwen/qwen3-235b-a22b:free",
    "huggingfaceh4/zephyr-7b-beta:free"
]

async def test_model(model_id):
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://github.com/hideman/requirement_assistant",
        "X-Title": "Connection Test",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model_id,
        "messages": [{"role": "user", "content": "Hi"}],
        "max_tokens": 5
    }

    async with httpx.AsyncClient() as client:
        try:
            print(f"Trying {model_id}...", end=" ", flush=True)
            response = await client.post(url, json=payload, headers=headers, timeout=10)
            
            if response.status_code == 200:
                print("✅ SUCCESS!")
                print(f"Response: {response.json()['choices'][0]['message']['content']}")
                return True
            else:
                print(f"❌ Failed ({response.status_code})")
                print(f"Reason: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Error: {e}")
            return False

async def main():
    print("Starting probe...")
    success_model = None
    
    for model in candidate_models:
        if await test_model(model):
            success_model = model
            break
            
    if success_model:
        print(f"\n🎉 FOUND WORKING MODEL: {success_model}")
        print(f"Please update backend/app/services.py to use this model.")
    else:
        print("\n💀 All models failed. Please check your API Key, Credit Balance, or OpenRouter Status.")

if __name__ == "__main__":
    asyncio.run(main())
