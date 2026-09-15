#!/usr/bin/env python3
import os
from dotenv import load_dotenv

# Test which OpenAI key is being used
print("Before loading .env:")
print(f"OPENAI_API_KEY from environment: {os.getenv('OPENAI_API_KEY', 'Not Set')}")

load_dotenv(override=True)  # Force override environment variables

print("\nAfter loading .env:")
print(f"OPENAI_API_KEY: {os.getenv('OPENAI_API_KEY', 'Not Set')}")

# Test basic OpenAI connection
try:
    from openai import OpenAI
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    
    # Test a very simple completion to check if key works
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": "Say 'test successful' if you can read this."}],
        max_tokens=10
    )
    
    print(f"\nAPI Test Result: {response.choices[0].message.content}")
    print("✅ OpenAI API key is working!")
    
except Exception as e:
    print(f"\n❌ OpenAI API Error: {e}")
    if "quota" in str(e).lower():
        print("This appears to be a quota/billing issue.")
    elif "authentication" in str(e).lower():
        print("This appears to be an authentication issue - check your API key.")