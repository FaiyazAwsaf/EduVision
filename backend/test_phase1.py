"""
Test script for Phase 1 API endpoints.

Tests the complete flow:
1. Create a content request
2. Verify it's returned in list
3. Retrieve it by ID
4. Check status progression
"""

import requests
import time
import json
from typing import Dict, Any

BASE_URL = "http://127.0.0.1:8000/api/content-requests"


def print_section(title: str):
    """Print a formatted section header."""
    print(f"\n{'='*60}")
    print(f"{title}")
    print('='*60)


def print_json(data: Dict[str, Any]):
    """Pretty print JSON data."""
    print(json.dumps(data, indent=2))


def test_create_request():
    """Test creating a new content request."""
    print_section("TEST 1: Create Content Request")
    
    payload = {
        "topic": "Introduction to Quantum Mechanics",
        "content_type": "SUMMARY",
        "style": "DETAILED",
        "output_format": "PDF",
        "difficulty": "MEDIUM",
        "notes": "Focus on wave-particle duality and the Heisenberg uncertainty principle"
    }
    
    print("Sending POST request...")
    print_json(payload)
    
    response = requests.post(f"{BASE_URL}/", json=payload)
    
    print(f"\nResponse Status: {response.status_code}")
    
    if response.status_code == 201:
        print("✓ Request created successfully!")
        data = response.json()
        print_json(data)
        return data['id']
    else:
        print("✗ Failed to create request")
        print(response.text)
        return None


def test_list_requests():
    """Test listing all content requests."""
    print_section("TEST 2: List All Content Requests")
    
    response = requests.get(f"{BASE_URL}/")
    
    print(f"Response Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Found {len(data)} request(s)")
        print_json(data)
        return True
    else:
        print("✗ Failed to list requests")
        print(response.text)
        return False


def test_get_request_detail(request_id: str):
    """Test retrieving a specific content request."""
    print_section("TEST 3: Get Request Detail")
    
    print(f"Fetching request {request_id}...")
    
    response = requests.get(f"{BASE_URL}/{request_id}/")
    
    print(f"Response Status: {response.status_code}")
    
    if response.status_code == 200:
        print("✓ Request retrieved successfully!")
        data = response.json()
        print_json(data)
        return data
    else:
        print("✗ Failed to retrieve request")
        print(response.text)
        return None


def test_filter_by_status():
    """Test filtering requests by status."""
    print_section("TEST 4: Filter by Status")
    
    print("Fetching pending requests...")
    
    response = requests.get(f"{BASE_URL}/?status=pending")
    
    print(f"Response Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Found {len(data)} pending request(s)")
        print_json(data)
        return True
    else:
        print("✗ Failed to filter requests")
        print(response.text)
        return False


def test_invalid_request():
    """Test creating an invalid request."""
    print_section("TEST 5: Create Invalid Request")
    
    payload = {
        "topic": "",  # Empty topic should fail
        "content_type": "SUMMARY",
        "style": "BRIEF",
        "output_format": "TEXT",
        "difficulty": "EASY"
    }
    
    print("Sending invalid POST request...")
    print_json(payload)
    
    response = requests.post(f"{BASE_URL}/", json=payload)
    
    print(f"\nResponse Status: {response.status_code}")
    
    if response.status_code == 400:
        print("✓ Validation working correctly!")
        print("Error response:")
        print_json(response.json())
        return True
    else:
        print("✗ Expected 400 error for invalid data")
        print(response.text)
        return False


def run_all_tests():
    """Run all Phase 1 tests."""
    print("\n" + "="*60)
    print("PHASE 1 API TESTS")
    print("="*60)
    
    results = []
    
    # Test 1: Create request
    request_id = test_create_request()
    results.append(("Create Request", request_id is not None))
    
    if not request_id:
        print("\n✗ Cannot continue tests without a valid request ID")
        return
    
    # Give background task a moment
    time.sleep(1)
    
    # Test 2: List requests
    results.append(("List Requests", test_list_requests()))
    
    # Test 3: Get detail
    detail = test_get_request_detail(request_id)
    results.append(("Get Detail", detail is not None))
    
    # Test 4: Filter by status
    results.append(("Filter by Status", test_filter_by_status()))
    
    # Test 5: Invalid request
    results.append(("Invalid Request Handling", test_invalid_request()))
    
    # Wait a bit for background processing
    print_section("Waiting for Background Processing")
    print("Waiting 3 seconds for Celery task to process...")
    time.sleep(3)
    
    # Check status again
    print("\nChecking status after background processing...")
    final_status = test_get_request_detail(request_id)
    if final_status:
        print(f"\nFinal Status: {final_status.get('status', 'unknown')}")
    
    # Summary
    print_section("TEST SUMMARY")
    for test_name, passed in results:
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{test_name:.<40} {status}")
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    print(f"\nTotal: {passed_count}/{total_count} tests passed")
    
    if passed_count == total_count:
        print("\n🎉 All tests passed! Phase 1 is working correctly.")
    else:
        print(f"\n⚠️  {total_count - passed_count} test(s) failed.")


if __name__ == "__main__":
    try:
        run_all_tests()
    except requests.exceptions.ConnectionError:
        print("\n✗ ERROR: Cannot connect to server at http://127.0.0.1:8000")
        print("Make sure the Django development server is running:")
        print("  python manage.py runserver")
    except Exception as e:
        print(f"\n✗ ERROR: {type(e).__name__}: {e}")
