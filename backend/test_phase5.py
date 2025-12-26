"""
Phase 5 Study Plan API Test Script

Quick test to verify study plan endpoints are working correctly.
Run this after starting the Django server.

Usage:
    python test_phase5.py
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000/api"

def print_section(title):
    """Print a formatted section header."""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

def test_create_study_plan():
    """Test creating a new study plan."""
    print_section("Test 1: Create Study Plan")
    
    payload = {
        "name": "Python Programming Study Plan",
        "user_id": "test_user_123"
    }
    
    response = requests.post(f"{BASE_URL}/study-plans/", json=payload)
    
    if response.status_code == 201:
        plan = response.json()
        print("✅ Study plan created successfully!")
        print(f"   ID: {plan['id']}")
        print(f"   Name: {plan['name']}")
        print(f"   Mode: {plan['mode']}")
        print(f"   Auto-detect weakness: {plan['auto_detect_weakness']}")
        return plan['id']
    else:
        print(f"❌ Failed to create study plan: {response.status_code}")
        print(response.text)
        return None

def test_list_study_plans():
    """Test listing all study plans."""
    print_section("Test 2: List Study Plans")
    
    response = requests.get(f"{BASE_URL}/study-plans/")
    
    if response.status_code == 200:
        plans = response.json()
        print(f"✅ Found {len(plans)} study plan(s)")
        for plan in plans:
            print(f"   - {plan['name']} ({len(plan['items'])} items)")
    else:
        print(f"❌ Failed to list plans: {response.status_code}")

def test_add_study_plan_items(plan_id):
    """Test adding items to a study plan."""
    print_section("Test 3: Add Study Plan Items")
    
    items_to_add = [
        {
            "topic": "Variables and Data Types",
            "priority": 1,
            "scheduled_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "status": "pending"
        },
        {
            "topic": "Control Flow (if/else, loops)",
            "priority": 1,
            "scheduled_date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "status": "pending"
        },
        {
            "topic": "Functions and Modules",
            "priority": 2,
            "scheduled_date": (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d"),
            "status": "pending"
        },
        {
            "topic": "Object-Oriented Programming",
            "priority": 2,
            "scheduled_date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "status": "pending"
        }
    ]
    
    created_items = []
    for item_data in items_to_add:
        response = requests.post(
            f"{BASE_URL}/study-plans/{plan_id}/items/",
            json=item_data
        )
        
        if response.status_code == 201:
            item = response.json()
            created_items.append(item['id'])
            print(f"✅ Added: {item['topic']}")
            print(f"   Priority: {item['priority']}, Status: {item['status']}")
        else:
            print(f"❌ Failed to add item: {response.status_code}")
            print(response.text)
    
    return created_items

def test_get_study_plan(plan_id):
    """Test getting a specific study plan with items."""
    print_section("Test 4: Get Study Plan Details")
    
    response = requests.get(f"{BASE_URL}/study-plans/{plan_id}/")
    
    if response.status_code == 200:
        plan = response.json()
        print(f"✅ Retrieved plan: {plan['name']}")
        print(f"   Total items: {len(plan['items'])}")
        
        # Count by status
        pending = sum(1 for i in plan['items'] if i['status'] == 'pending')
        in_progress = sum(1 for i in plan['items'] if i['status'] == 'in_progress')
        completed = sum(1 for i in plan['items'] if i['status'] == 'completed')
        
        print(f"   Pending: {pending}, In Progress: {in_progress}, Completed: {completed}")
    else:
        print(f"❌ Failed to get plan: {response.status_code}")

def test_update_item_status(item_id):
    """Test updating an item's status."""
    print_section("Test 5: Update Item Status")
    
    # First, set to in_progress
    response = requests.patch(
        f"{BASE_URL}/study-plan-items/{item_id}/",
        json={"status": "in_progress"}
    )
    
    if response.status_code == 200:
        item = response.json()
        print(f"✅ Updated to 'in_progress': {item['topic']}")
    else:
        print(f"❌ Failed to update to in_progress: {response.status_code}")
        return
    
    # Then, mark complete
    response = requests.post(f"{BASE_URL}/study-plan-items/{item_id}/complete/")
    
    if response.status_code == 200:
        item = response.json()
        print(f"✅ Marked as completed: {item['topic']}")
    else:
        print(f"❌ Failed to mark complete: {response.status_code}")

def test_constraint_validation():
    """Test that Phase 5 constraints are enforced."""
    print_section("Test 6: Constraint Validation")
    
    # Try to create AI mode plan (should fail)
    print("Testing AI mode rejection...")
    response = requests.post(
        f"{BASE_URL}/study-plans/",
        json={"name": "AI Plan", "mode": "ai"}
    )
    
    if response.status_code == 400:
        print("✅ AI mode correctly rejected")
    else:
        print(f"❌ Expected 400, got {response.status_code}")
    
    # Try to enable auto_detect_weakness (should fail)
    print("Testing auto_detect_weakness rejection...")
    response = requests.post(
        f"{BASE_URL}/study-plans/",
        json={"name": "Auto Plan", "auto_detect_weakness": True}
    )
    
    if response.status_code == 400:
        print("✅ auto_detect_weakness correctly rejected")
    else:
        print(f"❌ Expected 400, got {response.status_code}")

def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("  Phase 5: Study Plan API Tests")
    print("="*60)
    print("  Testing manual study plan functionality")
    print("  Backend must be running at http://127.0.0.1:8000")
    print("="*60)
    
    try:
        # Test basic CRUD operations
        plan_id = test_create_study_plan()
        
        if plan_id:
            test_list_study_plans()
            item_ids = test_add_study_plan_items(plan_id)
            test_get_study_plan(plan_id)
            
            if item_ids:
                test_update_item_status(item_ids[0])
        
        # Test constraint validation
        test_constraint_validation()
        
        print_section("Test Summary")
        print("✅ All tests completed!")
        print("\nNext steps:")
        print("1. Check the frontend at http://localhost:3000/study-plans")
        print("2. Verify the study plan appears in the UI")
        print("3. Test manual CRUD operations in the browser")
        
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Could not connect to backend")
        print("   Make sure Django server is running:")
        print("   cd backend && python manage.py runserver")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")

if __name__ == "__main__":
    main()
