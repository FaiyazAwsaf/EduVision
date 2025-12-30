"""
WebSocket Test Script for Tutoring Sessions

Run this script to verify the WebSocket infrastructure is working.

Usage:
    python test_websocket.py

Prerequisites:
    1. Daphne server running: python -m daphne -p 8000 config.asgi:application
    2. Test users created: python manage.py create_test_users
    3. websockets package: pip install websockets
"""

import asyncio
import json
import sys
import os

# Add the project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set up Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from apps.tutoring.models import TutoringUser, TutoringSession

async def test_websocket():
    try:
        import websockets
    except ImportError:
        print("❌ websockets package not installed")
        print("   Run: pip install websockets")
        return False
    
    from asgiref.sync import sync_to_async
    
    print("=" * 60)
    print("WebSocket Test for Tutoring Sessions")
    print("=" * 60)
    
    # Get a teacher user (wrapped for async)
    @sync_to_async
    def get_teacher():
        return TutoringUser.objects.filter(role='TEACHER').first()
    
    @sync_to_async
    def get_student():
        return TutoringUser.objects.filter(role='STUDENT').first()
    
    @sync_to_async
    def create_session(room_id, teacher, token):
        return TutoringSession.objects.create(
            room_id=room_id,
            teacher=teacher,
            status='WAITING',
            livekit_token_teacher=token
        )
    
    @sync_to_async
    def delete_session(session):
        session.delete()
    
    teacher = await get_teacher()
    if not teacher:
        print("❌ No teacher user found. Run: python manage.py create_test_users")
        return False
    
    print(f"✓ Found teacher: {teacher.full_name} ({teacher.id})")
    
    student = await get_student()
    if not student:
        print("❌ No student user found. Run: python manage.py create_test_users")
        return False
    
    print(f"✓ Found student: {student.full_name} ({student.id})")
    
    # Create a test session
    from apps.tutoring.utils import generate_livekit_token
    import uuid
    
    room_id = f"test_room_{uuid.uuid4()}"
    
    try:
        token = generate_livekit_token(
            room_id=room_id,
            user_id=str(teacher.id),
            user_name=teacher.full_name,
            role='TEACHER'
        )
    except Exception as e:
        print(f"⚠️  Token generation failed (LiveKit not configured): {e}")
        token = "test_token"
    
    session = await create_session(room_id, teacher, token)
    
    print(f"✓ Created test session: {session.id}")
    
    # Test WebSocket connection
    ws_url = f"ws://localhost:8000/ws/tutoring/{session.id}/?user_id={teacher.id}"
    print(f"\n🔌 Connecting to WebSocket...")
    print(f"   URL: {ws_url}")
    
    try:
        async with websockets.connect(ws_url) as websocket:
            print("✓ WebSocket connected!")
            
            # Wait for initial state
            message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            data = json.loads(message)
            print(f"\n📩 Received: {data['type']}")
            
            if data['type'] == 'initial_state':
                print(f"   Session ID: {data['payload']['session_id']}")
                print(f"   Status: {data['payload']['status']}")
                print(f"   Your Role: {data['payload']['your_role']}")
            
            # Wait for participant_joined event (self)
            message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            data = json.loads(message)
            print(f"\n📩 Received: {data['type']}")
            
            if data['type'] == 'participant_joined':
                print(f"   User: {data['payload']['user_name']}")
                print(f"   Role: {data['payload']['role']}")
            
            # Send ping
            print("\n🏓 Sending ping...")
            await websocket.send(json.dumps({'type': 'ping', 'payload': {}}))
            
            # Wait for pong
            message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            data = json.loads(message)
            print(f"📩 Received: {data['type']}")
            
            print("\n✅ All WebSocket tests passed!")
            
    except asyncio.TimeoutError:
        print("❌ Timeout waiting for WebSocket response")
        return False
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
        return False
    finally:
        # Cleanup
        await delete_session(session)
        print(f"\n🧹 Cleaned up test session")
    
    return True


if __name__ == '__main__':
    success = asyncio.run(test_websocket())
    sys.exit(0 if success else 1)
