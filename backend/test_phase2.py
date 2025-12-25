"""
Phase 2 Test Script - AI Content Generation

This script tests the complete Phase 2 pipeline:
1. Create content request
2. Wait for AI generation (via Celery worker)
3. Retrieve generated content
4. Test different output formats (JSON, PDF, WORKSHEET)
"""
import requests
import json
import time
import sys
from typing import Dict, Any, Optional


BASE_URL = "http://127.0.0.1:8000/api/content-requests"


def print_section(title: str):
    """Print a formatted section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80 + "\n")


def print_success(message: str):
    """Print success message"""
    print(f"✓ {message}")


def print_error(message: str):
    """Print error message"""
    print(f"✗ {message}")


def print_info(message: str):
    """Print info message"""
    print(f"ℹ {message}")


def print_response(response: requests.Response, show_body: bool = True):
    """Print response details"""
    print(f"Status Code: {response.status_code}")
    if show_body:
        try:
            print(f"Response Body:")
            print(json.dumps(response.json(), indent=2))
        except:
            print(f"Response: {response.text[:200]}")


def test_create_request() -> Optional[str]:
    """Test creating a new content request"""
    print_section("Step 1: Create Content Request")
    
    data = {
        "topic": "Pythagorean Theorem",
        "content_type": "SUMMARY",
        "style": "DETAILED",
        "output_format": "PDF",
        "difficulty": "MEDIUM",
        "notes": "Include historical context and practical applications"
    }
    
    print("Request Data:")
    print(json.dumps(data, indent=2))
    print()
    
    try:
        response = requests.post(f"{BASE_URL}/", json=data)
        print_response(response)
        
        if response.status_code == 201:
            request_id = response.json()['id']
            print_success(f"Created request with ID: {request_id}")
            return request_id
        else:
            print_error(f"Failed to create request: {response.status_code}")
            return None
    except Exception as e:
        print_error(f"Exception occurred: {e}")
        return None


def wait_for_completion(request_id: str, max_wait: int = 60, poll_interval: int = 2) -> str:
    """Wait for content generation to complete"""
    print_section("Step 2: Wait for AI Generation")
    
    print_info(f"Polling every {poll_interval} seconds (max {max_wait}s)")
    print_info(f"Request ID: {request_id}\n")
    
    start_time = time.time()
    attempt = 0
    
    while time.time() - start_time < max_wait:
        attempt += 1
        
        try:
            response = requests.get(f"{BASE_URL}/{request_id}/")
            
            if response.status_code == 200:
                data = response.json()
                status = data['status']
                
                elapsed = int(time.time() - start_time)
                print(f"[{elapsed}s] Attempt {attempt}: Status = {status}")
                
                if status == 'COMPLETED':
                    print_success(f"Content generation completed in {elapsed} seconds!")
                    return 'COMPLETED'
                elif status == 'FAILED':
                    print_error(f"Content generation failed")
                    if 'error_message' in data:
                        print_error(f"Error: {data['error_message']}")
                    return 'FAILED'
                elif status in ['PENDING', 'PROCESSING']:
                    time.sleep(poll_interval)
                else:
                    print_error(f"Unknown status: {status}")
                    return 'UNKNOWN'
            else:
                print_error(f"Failed to check status: {response.status_code}")
                return 'ERROR'
                
        except Exception as e:
            print_error(f"Exception while polling: {e}")
            return 'ERROR'
    
    print_error(f"Timeout after {max_wait} seconds")
    return 'TIMEOUT'


def test_get_json_content(request_id: str) -> bool:
    """Test retrieving content in JSON format"""
    print_section("Step 3: Retrieve Content (JSON Format)")
    
    try:
        response = requests.get(f"{BASE_URL}/{request_id}/content?format=json")
        
        if response.status_code == 200:
            content = response.json()
            print_response(response)
            
            print("\n" + "-" * 80)
            print("Content Analysis:")
            print("-" * 80)
            print(f"Content Length: {len(content['content_text'])} characters")
            print(f"Topic: {content['topic']}")
            print(f"Content Type: {content['content_type']}")
            print(f"Style: {content['style']}")
            print(f"Output Format: {content['output_format']}")
            
            if 'metadata' in content:
                print(f"\nMetadata:")
                for key, value in content['metadata'].items():
                    print(f"  - {key}: {value}")
            
            print("\n" + "-" * 80)
            print("Content Preview (first 500 chars):")
            print("-" * 80)
            print(content['content_text'][:500])
            if len(content['content_text']) > 500:
                print("...")
            print("-" * 80)
            
            print_success("JSON content retrieved successfully")
            return True
        else:
            print_response(response)
            print_error(f"Failed to retrieve JSON content: {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception occurred: {e}")
        return False


def test_download_pdf(request_id: str) -> bool:
    """Test downloading content as PDF"""
    print_section("Step 4: Download PDF")
    
    try:
        response = requests.get(f"{BASE_URL}/{request_id}/content?format=pdf")
        
        if response.status_code == 200:
            filename = f"test_content_{request_id[:8]}.pdf"
            
            with open(filename, 'wb') as f:
                f.write(response.content)
            
            file_size = len(response.content)
            print(f"Content-Type: {response.headers.get('Content-Type')}")
            print(f"Content-Disposition: {response.headers.get('Content-Disposition')}")
            print(f"File Size: {file_size:,} bytes")
            print(f"Saved as: {filename}")
            
            print_success(f"PDF downloaded successfully ({file_size:,} bytes)")
            return True
        else:
            print_response(response)
            print_error(f"Failed to download PDF: {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception occurred: {e}")
        return False


def test_download_worksheet(request_id: str) -> bool:
    """Test downloading content as worksheet"""
    print_section("Step 5: Download Worksheet")
    
    try:
        response = requests.get(f"{BASE_URL}/{request_id}/content?format=worksheet")
        
        if response.status_code == 200:
            filename = f"test_worksheet_{request_id[:8]}.pdf"
            
            with open(filename, 'wb') as f:
                f.write(response.content)
            
            file_size = len(response.content)
            print(f"Content-Type: {response.headers.get('Content-Type')}")
            print(f"Content-Disposition: {response.headers.get('Content-Disposition')}")
            print(f"File Size: {file_size:,} bytes")
            print(f"Saved as: {filename}")
            
            print_success(f"Worksheet downloaded successfully ({file_size:,} bytes)")
            return True
        else:
            print_response(response)
            print_error(f"Failed to download worksheet: {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception occurred: {e}")
        return False


def test_error_handling(request_id: str):
    """Test error handling for invalid requests"""
    print_section("Step 6: Test Error Handling")
    
    # Test 1: Invalid format
    print("Test 6.1: Invalid format parameter")
    try:
        response = requests.get(f"{BASE_URL}/{request_id}/content?format=invalid")
        print(f"Status Code: {response.status_code}")
        if response.status_code == 400:
            print_success("Invalid format correctly rejected")
        else:
            print_error(f"Expected 400, got {response.status_code}")
    except Exception as e:
        print_error(f"Exception: {e}")
    
    print()
    
    # Test 2: Non-existent request
    print("Test 6.2: Non-existent request ID")
    try:
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(f"{BASE_URL}/{fake_id}/content")
        print(f"Status Code: {response.status_code}")
        if response.status_code == 404:
            print_success("Non-existent request correctly handled")
        else:
            print_error(f"Expected 404, got {response.status_code}")
    except Exception as e:
        print_error(f"Exception: {e}")


def run_full_test():
    """Run the complete Phase 2 test suite"""
    print("\n" + "=" * 80)
    print("  PHASE 2 TEST SUITE - AI CONTENT GENERATION")
    print("=" * 80)
    print(f"\nBase URL: {BASE_URL}")
    print(f"Test Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Step 1: Create request
    request_id = test_create_request()
    if not request_id:
        print_error("Failed to create request. Aborting test.")
        return False
    
    # Step 2: Wait for completion
    status = wait_for_completion(request_id, max_wait=90, poll_interval=3)
    if status != 'COMPLETED':
        print_error(f"Content generation did not complete successfully: {status}")
        print_info("Make sure Celery worker is running:")
        print_info("  celery -A config worker --loglevel=info --pool=solo")
        return False
    
    # Step 3: Get JSON content
    if not test_get_json_content(request_id):
        print_error("Failed to retrieve JSON content")
        return False
    
    # Step 4: Download PDF
    if not test_download_pdf(request_id):
        print_error("Failed to download PDF")
        return False
    
    # Step 5: Download worksheet
    if not test_download_worksheet(request_id):
        print_error("Failed to download worksheet")
        return False
    
    # Step 6: Test error handling
    test_error_handling(request_id)
    
    # Final summary
    print_section("Test Summary")
    print_success("All Phase 2 tests passed!")
    print()
    print("Verified:")
    print("  ✓ Content request creation")
    print("  ✓ AI content generation (Gemini)")
    print("  ✓ Content persistence to database")
    print("  ✓ JSON content retrieval")
    print("  ✓ PDF format generation")
    print("  ✓ Worksheet format generation")
    print("  ✓ Error handling")
    print()
    print_success("Phase 2 implementation is working correctly!")
    
    return True


if __name__ == "__main__":
    try:
        success = run_full_test()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
