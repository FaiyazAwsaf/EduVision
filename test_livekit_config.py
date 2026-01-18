#!/usr/bin/env python
"""
Test script to check LiveKit configuration
"""
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from apps.tutoring.utils import get_livekit_ws_url, validate_livekit_config

print("=" * 60)
print("LiveKit Configuration Test")
print("=" * 60)

# Check environment variables directly
print("\n1. Environment Variables (direct):")
print(f"   LIVEKIT_API_KEY: {os.environ.get('LIVEKIT_API_KEY', 'NOT SET')}")
print(f"   LIVEKIT_API_SECRET: {os.environ.get('LIVEKIT_API_SECRET', 'NOT SET')[:20]}..." if os.environ.get('LIVEKIT_API_SECRET') else "NOT SET")
print(f"   LIVEKIT_WS_URL: {os.environ.get('LIVEKIT_WS_URL', 'NOT SET')}")

# Check via utility function
print("\n2. Via utility function:")
print(f"   get_livekit_ws_url(): {get_livekit_ws_url()}")

# Validate configuration
print("\n3. Configuration validation:")
config = validate_livekit_config()
for key, value in config.items():
    if key == 'ws_url':
        print(f"   {key}: {value}")
    else:
        print(f"   {key}: {value}")

print("\n" + "=" * 60)
if config['configured']:
    print("✓ LiveKit is properly configured!")
else:
    print("✗ LiveKit configuration is INCOMPLETE")
    print("\nMissing:")
    if not config['api_key_set']:
        print("  - LIVEKIT_API_KEY")
    if not config['api_secret_set']:
        print("  - LIVEKIT_API_SECRET")
    if not config['ws_url_set']:
        print("  - LIVEKIT_WS_URL")
print("=" * 60)
