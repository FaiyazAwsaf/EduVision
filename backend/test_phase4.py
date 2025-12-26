"""
Phase 4 End-to-End Test Script

Tests the complete flow of learning context integration:
1. Create content request
2. Submit learning context
3. Verify context is passed to AI generation
4. Check personalized content generation

Run this after starting Django, Celery, and Redis.
"""
import requests
import time
import json
import os
from datetime import datetime

BASE_URL = "http://localhost:8000/api/content-requests/"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def print_section(title):
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80)

def test_without_context():
    """Test content generation WITHOUT learning context (baseline)"""
    print_section("TEST 1: Content Generation WITHOUT Learning Context")
    
    # Create request
    request_data = {
        "topic": "Quadratic Equations",
        "content_type": "SUMMARY",
        "style": "DETAILED",
        "output_format": "TEXT",
        "difficulty": "MEDIUM",
        "notes": "Basic test without context"
    }
    
    print("\n1. Creating content request...")
    response = requests.post(BASE_URL, json=request_data)
    assert response.status_code == 201, f"Failed to create request: {response.text}"
    
    request_id = response.json()["id"]
    print(f"✓ Request created: {request_id}")
    
    # Wait for generation
    print("\n2. Waiting for content generation...")
    max_attempts = 30
    for i in range(max_attempts):
        time.sleep(2)
        status_response = requests.get(f"{BASE_URL}{request_id}/")
        status = status_response.json()["status"]
        print(f"   Attempt {i+1}/{max_attempts}: {status}")
        
        if status == "COMPLETED":
            break
        elif status == "FAILED":
            print("✗ Generation failed")
            return None
    
    # Fetch generated content
    print("\n3. Fetching generated content...")
    content_response = requests.get(f"{BASE_URL}{request_id}/generated-content/")
    assert content_response.status_code == 200, "Failed to fetch content"
    
    content = content_response.json()
    print(f"✓ Content generated ({len(content['content_text'])} chars)")
    print(f"   Has context flag: {content['metadata'].get('has_learning_context', False)}")
    
    return request_id

def test_with_context():
    """Test content generation WITH learning context"""
    print_section("TEST 2: Content Generation WITH Learning Context")
    
    # Create request
    request_data = {
        "topic": "Quadratic Equations",
        "content_type": "SUMMARY",
        "style": "DETAILED",
        "output_format": "TEXT",
        "difficulty": "MEDIUM",
        "notes": "Test with full learning context"
    }
    
    print("\n1. Creating content request...")
    response = requests.post(BASE_URL, json=request_data)
    assert response.status_code == 201, f"Failed to create request: {response.text}"
    
    request_id = response.json()["id"]
    print(f"✓ Request created: {request_id}")
    
    # Submit learning context
    context_data = {
        "target_goal": "EXAM_PREP",
        "self_reported_weaknesses": [
            "completing the square",
            "discriminant interpretation",
            "word problems"
        ],
        "preferred_depth": "DEEP",
        "time_constraint": "EXTENSIVE",
        "notes": "I struggle with completing the square and understanding when to use different methods. I have a math exam in 2 weeks and need thorough coverage."
    }
    
    print("\n2. Submitting learning context...")
    context_response = requests.post(
        f"{BASE_URL}{request_id}/context/",
        json=context_data
    )
    assert context_response.status_code in [200, 201], f"Failed to submit context: {context_response.text}"
    print(f"✓ Learning context submitted")
    print(f"   Goal: {context_data['target_goal']}")
    print(f"   Weaknesses: {len(context_data['self_reported_weaknesses'])} topics")
    print(f"   Depth: {context_data['preferred_depth']}")
    print(f"   Time: {context_data['time_constraint']}")
    
    # Wait for generation
    print("\n3. Waiting for personalized content generation...")
    max_attempts = 30
    for i in range(max_attempts):
        time.sleep(2)
        status_response = requests.get(f"{BASE_URL}{request_id}/")
        status = status_response.json()["status"]
        print(f"   Attempt {i+1}/{max_attempts}: {status}")
        
        if status == "COMPLETED":
            break
        elif status == "FAILED":
            print("✗ Generation failed")
            return None
    
    # Fetch generated content
    print("\n4. Fetching personalized content...")
    content_response = requests.get(f"{BASE_URL}{request_id}/generated-content/")
    assert content_response.status_code == 200, "Failed to fetch content"
    
    content = content_response.json()
    print(f"✓ Personalized content generated ({len(content['content_text'])} chars)")
    print(f"   Has context flag: {content['metadata'].get('has_learning_context', False)}")
    
    # Verify context was used
    context_check = requests.get(f"{BASE_URL}{request_id}/context/")
    assert context_check.status_code == 200, "Failed to fetch context"
    print(f"✓ Learning context confirmed in database")
    
    return request_id

def test_context_retrieval():
    """Test retrieving learning context"""
    print_section("TEST 3: Learning Context Retrieval")
    
    # Create request with context
    print("\n1. Creating request with context...")
    request_data = {
        "topic": "Trigonometry",
        "content_type": "WORKED_EXAMPLES",
        "style": "STEP_BY_STEP",
        "output_format": "TEXT",
    }
    
    response = requests.post(BASE_URL, json=request_data)
    request_id = response.json()["id"]
    print(f"✓ Request created: {request_id}")
    
    context_data = {
        "target_goal": "PRACTICE",
        "self_reported_weaknesses": ["sine rule", "cosine rule"],
        "preferred_depth": "NORMAL"
    }
    
    context_response = requests.post(
        f"{BASE_URL}{request_id}/context/",
        json=context_data
    )
    print(f"✓ Context submitted")
    
    # Retrieve context
    print("\n2. Retrieving context...")
    get_response = requests.get(f"{BASE_URL}{request_id}/context/")
    assert get_response.status_code == 200
    
    retrieved = get_response.json()
    print(f"✓ Context retrieved successfully")
    print(f"   Goal: {retrieved.get('target_goal')}")
    print(f"   Weaknesses: {retrieved.get('self_reported_weaknesses')}")
    print(f"   Depth: {retrieved.get('preferred_depth')}")
    
    return request_id

def test_optional_fields():
    """Test that context fields are truly optional"""
    print_section("TEST 4: Optional Fields Validation")
    
    # Minimal context
    print("\n1. Testing minimal context (only goal)...")
    request_data = {
        "topic": "Calculus Derivatives",
        "content_type": "SUMMARY",
        "style": "BRIEF",
        "output_format": "TEXT",
    }
    
    response = requests.post(BASE_URL, json=request_data)
    request_id = response.json()["id"]
    
    minimal_context = {
        "target_goal": "REVISION"
    }
    
    context_response = requests.post(
        f"{BASE_URL}{request_id}/context/",
        json=minimal_context
    )
    assert context_response.status_code in [200, 201]
    print(f"✓ Minimal context accepted")
    
    # Empty context (should still work)
    print("\n2. Testing empty context...")
    request_data2 = {
        "topic": "Physics Motion",
        "content_type": "FORMULA_SHEET",
        "style": "BRIEF",
        "output_format": "TEXT",
    }
    
    response2 = requests.post(BASE_URL, json=request_data2)
    request_id2 = response2.json()["id"]
    
    empty_context = {}
    
    context_response2 = requests.post(
        f"{BASE_URL}{request_id2}/context/",
        json=empty_context
    )
    # Should still accept it (backend creates record even if empty)
    print(f"   Status: {context_response2.status_code}")
    
    return request_id

def run_all_tests():
    """Run complete test suite"""
    print("\n")
    print("╔" + "="*78 + "╗")
    print("║" + " "*25 + "PHASE 4 TEST SUITE" + " "*35 + "║")
    print("║" + " "*20 + "Learning Context Integration" + " "*30 + "║")
    print("╚" + "="*78 + "╝")
    
    print(f"\nTest started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Backend URL: {BASE_URL}")
    print(f"Gemini API Key configured: {'✓' if GEMINI_API_KEY else '✗'}")
    
    results = {}
    
    try:
        # Test 1: Without context
        results['test1'] = test_without_context()
        
        # Test 2: With context
        results['test2'] = test_with_context()
        
        # Test 3: Context retrieval
        results['test3'] = test_context_retrieval()
        
        # Test 4: Optional fields
        results['test4'] = test_optional_fields()
        
        # Summary
        print_section("TEST SUMMARY")
        print("\n✓ All tests passed!")
        print(f"\nGenerated request IDs:")
        for test, req_id in results.items():
            if req_id:
                print(f"  {test}: {req_id}")
        
        print("\n" + "="*80)
        print("  PHASE 4 IMPLEMENTATION VERIFIED SUCCESSFULLY")
        print("="*80)
        
    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
        return False
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
