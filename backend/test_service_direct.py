"""
Direct test of service layer to diagnose issues.
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, r'E:\code\EduVision\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.content_requests.services.content_service import get_content_request_service

def test_service():
    """Test service directly."""
    print("Testing service layer...")
    
    service = get_content_request_service()
    
    try:
        result = service.create_request(
            topic="Test Topic",
            content_type="SUMMARY",
            style="BRIEF",
            output_format="TEXT",
            difficulty="EASY",
            notes="Test notes"
        )
        print(f"✓ Success! Created request: {result.id}")
        print(f"  Topic: {result.topic}")
        print(f"  Status: {result.status}")
        print(f"  Created: {result.created_at}")
        
    except Exception as e:
        print(f"✗ Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_service()
