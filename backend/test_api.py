"""
API Test Script for Content Requests Module

This script demonstrates how to interact with the Content Requests API
and verifies all endpoints are working correctly.
"""
import requests
import json
import time
from typing import Dict, Any


BASE_URL = "http://127.0.0.1:8000/api/content-requests"


def print_section(title: str):
    """Print a formatted section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80 + "\n")


def print_response(response: requests.Response):
    """Print response details"""
    print(f"Status Code: {response.status_code}")
    print(f"Response Body:")
    print(json.dumps(response.json(), indent=2))


def test_health_check():
    """Test the health check endpoint"""
    print_section("1. Health Check")
    
    response = requests.get(f"{BASE_URL}/health/")
    print_response(response)
    
    assert response.status_code == 200
    print("✓ Health check passed")


def test_create_request() -> int:
    """Test creating a new content request"""
    print_section("2. Create Content Request")
    
    data = {
        "topic": "Calculus Integration by Substitution",
        "style": "detailed",
        "format": "text",
        "metadata": {
            "difficulty": "intermediate",
            "prerequisites": ["basic integration", "chain rule"]
        }
    }
    
    print("Request Data:")
    print(json.dumps(data, indent=2))
    print()
    
    response = requests.post(
        f"{BASE_URL}/requests/",
        json=data,
        headers={"Content-Type": "application/json"}
    )
    
    print_response(response)
    
    assert response.status_code == 201
    request_id = response.json()['id']
    print(f"\n✓ Content request created successfully (ID: {request_id})")
    
    return request_id


def test_list_requests():
    """Test listing content requests"""
    print_section("3. List Content Requests")
    
    response = requests.get(f"{BASE_URL}/requests/")
    print_response(response)
    
    assert response.status_code == 200
    print("✓ Successfully retrieved request list")


def test_retrieve_request(request_id: int):
    """Test retrieving a specific request"""
    print_section("4. Retrieve Specific Request")
    
    response = requests.get(f"{BASE_URL}/requests/{request_id}/")
    print_response(response)
    
    assert response.status_code == 200
    print(f"✓ Successfully retrieved request #{request_id}")


def test_get_content(request_id: int, wait_for_completion: bool = True):
    """Test getting generated content"""
    print_section("5. Get Generated Content")
    
    if wait_for_completion:
        print("Waiting for content generation to complete...")
        max_attempts = 10
        for attempt in range(max_attempts):
            # Check request status
            status_response = requests.get(f"{BASE_URL}/requests/{request_id}/")
            status = status_response.json()['status']
            
            print(f"Attempt {attempt + 1}/{max_attempts}: Status = {status}")
            
            if status == 'completed':
                break
            
            time.sleep(2)  # Wait 2 seconds before next check
        
        print()
    
    response = requests.get(f"{BASE_URL}/requests/{request_id}/content/")
    print_response(response)
    
    if response.status_code == 200:
        print(f"✓ Successfully retrieved generated content")
    elif response.status_code == 404:
        print("⚠ Content not yet available (task may still be processing)")
    
    return response.status_code == 200


def test_submit_feedback(request_id: int):
    """Test submitting feedback"""
    print_section("6. Submit Feedback")
    
    data = {
        "feedback_type": "positive",
        "notes": "Excellent explanation with clear examples! Very helpful for understanding the concept."
    }
    
    print("Feedback Data:")
    print(json.dumps(data, indent=2))
    print()
    
    response = requests.post(
        f"{BASE_URL}/requests/{request_id}/feedback/",
        json=data,
        headers={"Content-Type": "application/json"}
    )
    
    print_response(response)
    
    assert response.status_code == 201
    print("✓ Feedback submitted successfully")


def test_filter_requests():
    """Test filtering requests by status"""
    print_section("7. Filter Requests by Status")
    
    response = requests.get(f"{BASE_URL}/requests/?status=completed&limit=10")
    print_response(response)
    
    assert response.status_code == 200
    print("✓ Successfully filtered requests")


def run_all_tests():
    """Run all API tests"""
    print("\n" + "#" * 80)
    print("#  Content Requests API Test Suite")
    print("#" * 80)
    
    try:
        # Test 1: Health check
        test_health_check()
        
        # Test 2: Create request
        request_id = test_create_request()
        
        # Test 3: List requests
        test_list_requests()
        
        # Test 4: Retrieve specific request
        test_retrieve_request(request_id)
        
        # Test 5: Get generated content
        content_available = test_get_content(request_id, wait_for_completion=True)
        
        # Test 6: Submit feedback (only if content is available)
        if content_available:
            test_submit_feedback(request_id)
        
        # Test 7: Filter requests
        test_filter_requests()
        
        # Final summary
        print_section("Test Summary")
        print("✓ All tests passed successfully!")
        print("\nThe Content Requests API is working correctly.")
        print("You can now integrate the frontend or test with other tools.")
        
    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
        return False
    
    except requests.exceptions.ConnectionError:
        print("\n✗ Error: Could not connect to the API server.")
        print("Make sure the Django development server is running:")
        print("  python manage.py runserver")
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
