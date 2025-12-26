"""
Test script for API key rotation functionality

This script tests that the Gemini provider correctly rotates through
multiple API keys when quota limits are exceeded.
"""
import os
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Django setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from apps.content_requests.services.gemini_provider import GeminiProvider
from apps.content_requests.domain.content_request import ContentRequest
from apps.content_requests.domain.enums import ContentType, Style, Difficulty, OutputFormat


def test_single_key():
    """Test with a single API key"""
    print("\n" + "="*60)
    print("TEST 1: Single API Key")
    print("="*60)
    
    api_key = os.getenv('GEMINI_API_KEY_1') or os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("❌ No API key found in environment")
        return False
    
    try:
        provider = GeminiProvider(api_key=api_key)
        print(f"✓ Provider initialized with single key")
        print(f"  - Number of keys: {len(provider.api_keys)}")
        print(f"  - Current key index: {provider.current_key_index}")
        return True
    except Exception as e:
        print(f"❌ Failed: {str(e)}")
        return False


def test_multiple_keys():
    """Test with multiple API keys"""
    print("\n" + "="*60)
    print("TEST 2: Multiple API Keys")
    print("="*60)
    
    # Load multiple keys
    api_keys = []
    for i in range(1, 5):
        key = os.getenv(f'GEMINI_API_KEY_{i}')
        if key:
            api_keys.append(key)
    
    if len(api_keys) < 2:
        print("⚠️  Less than 2 API keys configured, skipping multi-key test")
        return True
    
    try:
        provider = GeminiProvider(api_key=api_keys)
        print(f"✓ Provider initialized with {len(api_keys)} keys")
        print(f"  - Current key index: {provider.current_key_index}")
        return True
    except Exception as e:
        print(f"❌ Failed: {str(e)}")
        return False


def test_content_generation():
    """Test actual content generation with rotation"""
    print("\n" + "="*60)
    print("TEST 3: Content Generation")
    print("="*60)
    
    # Load multiple keys
    api_keys = []
    for i in range(1, 5):
        key = os.getenv(f'GEMINI_API_KEY_{i}')
        if key:
            api_keys.append(key)
    
    if not api_keys:
        api_keys = [os.getenv('GEMINI_API_KEY')]
    
    if not api_keys[0]:
        print("❌ No API key found")
        return False
    
    try:
        provider = GeminiProvider(api_key=api_keys)
        
        # Create a simple request
        request = ContentRequest(
            topic="Pythagorean theorem",
            content_type=ContentType.SUMMARY,
            style=Style.DETAILED,
            output_format=OutputFormat.TEXT,
            difficulty=Difficulty.EASY
        )
        
        print(f"Generating content with {len(api_keys)} key(s) available...")
        result = provider.generate_summary(request)
        
        print(f"✓ Content generated successfully")
        print(f"  - Content length: {len(result.content_text)} chars")
        print(f"  - Provider: {result.metadata.get('provider')}")
        print(f"  - Model: {result.metadata.get('model')}")
        print(f"  - Preview: {result.content_text[:100]}...")
        return True
        
    except Exception as e:
        print(f"❌ Failed: {str(e)}")
        return False


def main():
    print("\n" + "="*60)
    print("API KEY ROTATION TEST SUITE")
    print("="*60)
    
    # Check environment
    print("\nEnvironment Check:")
    key_count = 0
    for i in range(1, 5):
        key = os.getenv(f'GEMINI_API_KEY_{i}')
        if key:
            key_count += 1
            print(f"  ✓ GEMINI_API_KEY_{i} configured ({key[:10]}...)")
    
    if key_count == 0:
        single_key = os.getenv('GEMINI_API_KEY')
        if single_key:
            print(f"  ✓ GEMINI_API_KEY configured ({single_key[:10]}...)")
            key_count = 1
    
    if key_count == 0:
        print("\n❌ No API keys configured!")
        print("\nPlease configure API keys in your .env file:")
        print("  GEMINI_API_KEY_1=your-first-key")
        print("  GEMINI_API_KEY_2=your-second-key")
        print("  etc.")
        return
    
    print(f"\nTotal keys configured: {key_count}")
    
    # Run tests
    results = []
    results.append(("Single Key Test", test_single_key()))
    results.append(("Multiple Keys Test", test_multiple_keys()))
    results.append(("Content Generation Test", test_content_generation()))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    for name, passed in results:
        status = "✓ PASS" if passed else "❌ FAIL"
        print(f"{status}: {name}")
    
    total = len(results)
    passed = sum(1 for _, p in results if p)
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")


if __name__ == "__main__":
    main()
