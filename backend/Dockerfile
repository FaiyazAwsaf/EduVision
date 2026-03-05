# ==========================================
# EduVision Backend - Production Dockerfile
# ==========================================
# Django + Celery application

FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn uvicorn[standard] channels daphne

# Copy application code
COPY . .

# Set entrypoint script permissions
RUN chmod +x /app/entrypoint.sh

# Collect static files
RUN python manage.py collectstatic --noinput || true

# Create non-root user
RUN addgroup --system --gid 1001 django && \
    adduser --system --uid 1001 --ingroup django django && \
    chown -R django:django /app

# Create media directory
RUN mkdir -p /app/media && chown -R django:django /app/media

# Switch to non-root user
USER django

# Expose port
EXPOSE 8000

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]

# Default command (can be overridden in docker-compose)
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
