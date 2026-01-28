#!/bin/sh
# entrypoint.sh - Docker entrypoint script for EduVision backend

set -e

echo "Waiting for database..."
python << END
import sys
import time
import os
import psycopg2

max_retries = 30
retry_count = 0

database_url = os.environ.get('DATABASE_URL', '')

if 'postgresql' in database_url or 'postgres' in database_url:
    # Parse DATABASE_URL
    import re
    match = re.match(r'postgres(?:ql)?://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', database_url)
    if match:
        user, password, host, port, dbname = match.groups()
        
        while retry_count < max_retries:
            try:
                conn = psycopg2.connect(
                    dbname=dbname,
                    user=user,
                    password=password,
                    host=host,
                    port=port,
                    connect_timeout=5,
                    sslmode='require'
                )
                conn.close()
                print("Database is ready!")
                sys.exit(0)
            except psycopg2.OperationalError as e:
                retry_count += 1
                print(f"Database not ready yet (attempt {retry_count}/{max_retries}). Waiting...")
                time.sleep(2)
        
        print("Failed to connect to database after maximum retries")
        sys.exit(1)
    else:
        print("Could not parse DATABASE_URL")
        sys.exit(1)
else:
    print("Using SQLite - no connection check needed")
    sys.exit(0)
END

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput --clear || true

echo "Starting server..."
exec "$@"
