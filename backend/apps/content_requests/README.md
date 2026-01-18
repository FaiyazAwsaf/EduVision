# AI-Assisted Content Request System (Module 7)

## Overview

This module implements a complete backend system for AI-assisted educational content generation. Students can request personalized learning materials, and the system generates them asynchronously using AI services.

## Features Implemented

### 1. Database Models

- **ContentRequest**: Stores user requests with topic, style, format, and status tracking
- **GeneratedContent**: Stores AI-generated educational content
- **UserFeedback**: Captures user satisfaction and improvement suggestions

### 2. RESTful API Endpoints

#### Create Content Request

```http
POST /api/content-requests/requests/
Content-Type: application/json

{
  "topic": "Calculus Integration",
  "style": "detailed",  // Options: brief, detailed, step_by_step
  "format": "text",     // Options: text, pdf, worksheet
  "metadata": {
    "difficulty": "intermediate",
    "prerequisites": ["derivatives", "limits"]
  }
}
```

#### List Content Requests

```http
GET /api/content-requests/requests/?status=completed&limit=20&offset=0
```

#### Retrieve Request Details

```http
GET /api/content-requests/requests/{id}/
```

#### Get Generated Content

```http
GET /api/content-requests/requests/{id}/content/
```

#### Submit Feedback

```http
POST /api/content-requests/requests/{id}/feedback/
Content-Type: application/json

{
  "feedback_type": "positive",  // Options: positive, negative, report_issue, suggestion
  "notes": "Very helpful explanation!"
}
```

#### Cancel Request

```http
POST /api/content-requests/requests/{id}/cancel/
```

### 3. Service Layer Architecture

#### ContentRequestService

- Business logic for request management
- Content generation coordination
- Feedback handling
- Status tracking

#### AIContentGeneratorInterface

- Abstract interface for AI providers
- Easy to swap AI backends (OpenAI, Anthropic, etc.)
- Mock implementation for development/testing

### 4. Background Task System (Celery)

Asynchronous task processing with:

- **generate_content_task**: Main content generation task
- **batch_generate_content_task**: Batch processing
- **cleanup_old_requests_task**: Scheduled cleanup
- **retry_failed_requests_task**: Automatic retry handling

### 5. Error Handling & Logging

- Centralized exception handling middleware
- Request/response logging middleware
- Structured logging with context
- Unique error IDs for tracking
- Security: Hides sensitive details in production

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Frontend)                    │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/REST
┌──────────────────────▼──────────────────────────────────┐
│                  API Layer (Views)                      │
│              - Input validation                         │
│              - Response formatting                       │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              Service Layer (Business Logic)              │
│              - ContentRequestService                     │
│              - AIContentGeneratorInterface               │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
┌─────────▼──────────┐    ┌────────▼────────┐
│  Database (SQLite) │    │  Celery + Redis │
│  - Models          │    │  - Tasks        │
│  - Migrations      │    │  - Queue        │
└────────────────────┘    └─────────────────┘
```

## Installation & Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Run Migrations

```bash
python manage.py migrate
```

### 3. Start Redis (for Celery)

```bash
# Windows (using Docker)
docker run -d -p 6379:6379 redis:latest

# Or install Redis natively on Windows
```

### 4. Start Celery Worker

```bash
celery -A config worker -l info --pool=solo
```

### 5. Start Django Development Server

```bash
python manage.py runserver
```

## Testing the API

### Using cURL

```bash
# Create a content request
curl -X POST http://localhost:8000/api/content-requests/requests/ \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Pythagorean Theorem",
    "style": "step_by_step",
    "format": "text"
  }'

# Get request details
curl http://localhost:8000/api/content-requests/requests/1/

# Get generated content
curl http://localhost:8000/api/content-requests/requests/1/content/

# Submit feedback
curl -X POST http://localhost:8000/api/content-requests/requests/1/feedback/ \
  -H "Content-Type: application/json" \
  -d '{
    "feedback_type": "positive",
    "notes": "Great explanation!"
  }'
```

### Using Python

```python
import requests

# Create request
response = requests.post(
    'http://localhost:8000/api/content-requests/requests/',
    json={
        'topic': 'Calculus Integration',
        'style': 'detailed',
        'format': 'text'
    }
)
request_id = response.json()['id']

# Get content
content_response = requests.get(
    f'http://localhost:8000/api/content-requests/requests/{request_id}/content/'
)
print(content_response.json())
```

## Code Organization

```
backend/apps/content_requests/
├── __init__.py
├── admin.py              # Django admin configuration
├── apps.py               # App configuration
├── models.py             # Database models
├── tasks.py              # Celery background tasks
├── middleware.py         # Custom middleware (error handling, logging)
├── logging_config.py     # Logging configuration
├── api/
│   ├── __init__.py
│   ├── serializers.py    # DRF serializers for validation
│   ├── views.py          # API viewsets and endpoints
│   └── urls.py           # URL routing
├── services/
│   ├── __init__.py
│   ├── content_service.py    # Business logic service
│   └── ai_generator.py       # AI integration (abstract + mock)
└── migrations/
    ├── __init__.py
    └── 0001_initial.py
```

## Design Patterns Used

1. **Repository Pattern**: Models abstract database operations
2. **Service Layer Pattern**: Business logic separated from controllers
3. **Strategy Pattern**: Pluggable AI generator implementations
4. **Factory Pattern**: AI generator factory function
5. **Dependency Injection**: Services injected into views
6. **SOLID Principles**: Throughout the codebase

## Future Integration Points

### Authentication (Module 8)

When the authentication module is implemented:

```python
# In serializers
def create(self, validated_data):
    validated_data['user'] = self.context['request'].user
    return super().create(validated_data)

# In views
from rest_framework.permissions import IsAuthenticated

class ContentRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
```

### Analytics (Module 3)

Content requests feed into analytics:

- Track most requested topics
- Measure content quality through feedback
- Identify knowledge gaps

### Real AI Integration

Replace `MockAIContentGenerator` with actual AI service:

```python
class OpenAIContentGenerator(AIContentGeneratorInterface):
    def __init__(self, config):
        self.client = OpenAI(api_key=config['api_key'])

    def generate_summary(self, topic, style, metadata):
        response = self.client.chat.completions.create(
            model="gpt-4",
            messages=[...]
        )
        return {
            'content': response.choices[0].message.content,
            'metadata': {...}
        }
```

## Environment Variables

Add to `.env` file:

```env
# Celery Configuration
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# AI Provider Configuration (when implemented)
AI_PROVIDER=openai
OPENAI_API_KEY=your-api-key-here
```

## Monitoring & Observability

### Logs Location

- Main logs: `logs/eduvision.log`
- Error logs: `logs/errors.log`
- API logs: `logs/api.log`
- Celery logs: `logs/celery.log`

### Health Check

```bash
curl http://localhost:8000/api/content-requests/health/
```

## Performance Considerations

1. **Database Indexes**: Applied on frequently queried fields (status, created_at)
2. **Query Optimization**: Uses `prefetch_related` for nested data
3. **Caching**: Redis used for task queue (can be extended for query caching)
4. **Async Processing**: Content generation doesn't block API responses
5. **Rate Limiting**: Ready for rate limiting middleware (implement when auth is ready)

## Security Features

1. **Input Validation**: All inputs validated via DRF serializers
2. **SQL Injection Prevention**: Django ORM parameterized queries
3. **XSS Protection**: Django's built-in escaping
4. **CSRF Protection**: Django middleware
5. **Error Masking**: Detailed errors only in DEBUG mode

## Testing

### Run Tests

```bash
pytest apps/content_requests/tests/
```

### Test Coverage

```bash
pytest --cov=apps.content_requests --cov-report=html
```

## API Documentation

Browse the API interactively:

```
http://localhost:8000/api/content-requests/requests/
```

DRF's browsable API provides:

- Interactive endpoint testing
- Schema documentation
- Request/response examples

## Troubleshooting

### Celery Not Processing Tasks

```bash
# Check Redis is running
redis-cli ping

# Check Celery worker is running
celery -A config inspect active
```

### Database Locked Error (SQLite)

SQLite doesn't handle concurrent writes well. For production, use PostgreSQL:

```python
# settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        ...
    }
}
```

### Import Errors

```bash
# Ensure virtual environment is activated
# Reinstall dependencies
pip install -r requirements.txt
```

## Contributing

When extending this module:

1. Follow existing patterns (service layer, serializers, etc.)
2. Add tests for new features
3. Update API documentation
4. Log important operations
5. Handle errors gracefully

## License

Part of EduVision AI educational platform.
