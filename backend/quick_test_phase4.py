"""Quick Phase 4 validation - Check API endpoints and database"""
import requests
import json

BASE_URL = "http://localhost:8000/api/content-requests/"

print("\n" + "="*60)
print("PHASE 4 QUICK VALIDATION")
print("="*60)

# Test 1: Create request
print("\n1. Creating content request...")
request_data = {
    "topic": "Test Topic - Phase 4",
    "content_type": "SUMMARY",
    "style": "DETAILED",
    "output_format": "TEXT",
    "difficulty": "MEDIUM",
}

response = requests.post(BASE_URL, json=request_data)
print(f"   Status: {response.status_code}")
assert response.status_code == 201, f"Failed: {response.text}"

request_id = response.json()["id"]
print(f"   ✓ Request ID: {request_id}")

# Test 2: Submit learning context
print("\n2. Submitting learning context...")
context_data = {
    "target_goal": "EXAM_PREP",
    "self_reported_weaknesses": ["topic1", "topic2", "topic3"],
    "preferred_depth": "DEEP",
    "time_constraint": "EXTENSIVE",
    "notes": "Test notes for Phase 4"
}

context_response = requests.post(
    f"{BASE_URL}{request_id}/context/",
    json=context_data
)
print(f"   Status: {context_response.status_code}")
assert context_response.status_code in [200, 201], f"Failed: {context_response.text}"

context_result = context_response.json()
print(f"   ✓ Context ID: {context_result['id']}")
print(f"   ✓ Goal: {context_result['target_goal']}")
print(f"   ✓ Weaknesses: {len(context_result['self_reported_weaknesses'])} items")

# Test 3: Retrieve learning context
print("\n3. Retrieving learning context...")
get_response = requests.get(f"{BASE_URL}{request_id}/context/")
print(f"   Status: {get_response.status_code}")
assert get_response.status_code == 200, "Failed to retrieve context"

retrieved = get_response.json()
print(f"   ✓ Retrieved goal: {retrieved['target_goal']}")
print(f"   ✓ Retrieved weaknesses: {retrieved['self_reported_weaknesses']}")
print(f"   ✓ Retrieved depth: {retrieved['preferred_depth']}")
print(f"   ✓ Retrieved time: {retrieved['time_constraint']}")
print(f"   ✓ Retrieved notes: {retrieved['notes'][:50]}...")

# Test 4: Verify data matches
print("\n4. Verifying data integrity...")
assert retrieved['target_goal'] == context_data['target_goal']
assert retrieved['self_reported_weaknesses'] == context_data['self_reported_weaknesses']
assert retrieved['preferred_depth'] == context_data['preferred_depth']
assert retrieved['time_constraint'] == context_data['time_constraint']
assert retrieved['notes'] == context_data['notes']
print("   ✓ All fields match!")

# Test 5: Test optional fields
print("\n5. Testing minimal context (optional fields)...")
request_data2 = {
    "topic": "Minimal Test",
    "content_type": "SUMMARY",
    "style": "BRIEF",
    "output_format": "TEXT",
    "difficulty": "EASY",
}

response2 = requests.post(BASE_URL, json=request_data2)
request_id2 = response2.json()["id"]

minimal_context = {
    "target_goal": "REVISION"
}

context_response2 = requests.post(
    f"{BASE_URL}{request_id2}/context/",
    json=minimal_context
)
print(f"   Status: {context_response2.status_code}")
assert context_response2.status_code in [200, 201]
print("   ✓ Minimal context accepted")

print("\n" + "="*60)
print("✓ ALL PHASE 4 API ENDPOINTS WORKING CORRECTLY")
print("="*60)
print(f"\nTest request IDs:")
print(f"  Full context: {request_id}")
print(f"  Minimal context: {request_id2}")
print("\n✓ Phase 4 backend integration complete!")
