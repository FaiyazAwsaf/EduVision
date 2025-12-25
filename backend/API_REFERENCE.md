# API Quick Reference Guide

## Base URL

```
http://127.0.0.1:8000/api/content-requests
```

## Endpoints

### 1. Create Content Request

**POST** `/api/content-requests/`

**Request Body:**

```json
{
  "topic": "string (required, max 500 chars)",
  "content_type": "SUMMARY | WORKED_EXAMPLES | FORMULA_SHEET (required)",
  "style": "BRIEF | DETAILED | STEP_BY_STEP (required)",
  "output_format": "TEXT | PDF | WORKSHEET (required)",
  "difficulty": "EASY | MEDIUM | HARD (optional)",
  "notes": "string (optional, max 2000 chars)"
}
```

**Success Response (201):**

```json
{
  "id": "uuid",
  "topic": "string",
  "content_type": "string",
  "style": "string",
  "output_format": "string",
  "difficulty": "string",
  "notes": "string",
  "status": "PENDING",
  "created_at": "ISO 8601 timestamp",
  "updated_at": "ISO 8601 timestamp"
}
```

**Error Responses:**

- `400`: Validation error
- `500`: Internal server error

---

### 2. List Content Requests

**GET** `/api/content-requests/`

**Query Parameters:**

- `status`: Filter by status (case-insensitive)
  - Values: `pending`, `processing`, `completed`, `failed`
- `limit`: Max number of results (default: 100, max: 1000)
- `offset`: Pagination offset (default: 0)

**Examples:**

```
GET /api/content-requests/
GET /api/content-requests/?status=pending
GET /api/content-requests/?status=completed&limit=10&offset=20
```

**Success Response (200):**

```json
{
  "results": [
    {
      "id": "uuid",
      "topic": "string",
      "content_type": "string",
      "status": "string",
      "created_at": "ISO 8601 timestamp"
    }
  ],
  "count": 1
}
```

**Error Responses:**

- `400`: Invalid query parameters
- `500`: Internal server error

---

### 3. Get Content Request Detail

**GET** `/api/content-requests/{id}/`

**URL Parameters:**

- `id`: UUID of the content request

**Example:**

```
GET /api/content-requests/8574f2a7-7a05-48de-bd44-736718506a76/
```

**Success Response (200):**

```json
{
  "id": "uuid",
  "topic": "string",
  "content_type": "string",
  "style": "string",
  "output_format": "string",
  "difficulty": "string",
  "notes": "string",
  "status": "PENDING | PROCESSING | COMPLETED | FAILED",
  "created_at": "ISO 8601 timestamp",
  "updated_at": "ISO 8601 timestamp"
}
```

**Error Responses:**

- `404`: Request not found
- `500`: Internal server error

---

## Enum Values

### Content Type

- `SUMMARY`: Brief overview of a topic
- `WORKED_EXAMPLES`: Step-by-step worked problems
- `FORMULA_SHEET`: Collection of formulas and equations

### Style

- `BRIEF`: Concise, to-the-point content
- `DETAILED`: Comprehensive, in-depth content
- `STEP_BY_STEP`: Structured, sequential instructions

### Output Format

- `TEXT`: Plain text format
- `PDF`: PDF document
- `WORKSHEET`: Interactive worksheet format

### Difficulty

- `EASY`: Introductory level
- `MEDIUM`: Intermediate level
- `HARD`: Advanced level

### Status

- `PENDING`: Request created, awaiting processing
- `PROCESSING`: Currently being processed
- `COMPLETED`: Successfully completed
- `FAILED`: Processing failed

---

## cURL Examples

### Create Request

```bash
curl -X POST http://127.0.0.1:8000/api/content-requests/ \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Introduction to Quantum Mechanics",
    "content_type": "SUMMARY",
    "style": "DETAILED",
    "output_format": "PDF",
    "difficulty": "MEDIUM",
    "notes": "Focus on wave-particle duality"
  }'
```

### List All Requests

```bash
curl http://127.0.0.1:8000/api/content-requests/
```

### Filter by Status

```bash
curl http://127.0.0.1:8000/api/content-requests/?status=pending
```

### Get Specific Request

```bash
curl http://127.0.0.1:8000/api/content-requests/8574f2a7-7a05-48de-bd44-736718506a76/
```

---

## Python Example (using requests)

```python
import requests

BASE_URL = "http://127.0.0.1:8000/api/content-requests"

# Create a request
response = requests.post(f"{BASE_URL}/", json={
    "topic": "Python Decorators",
    "content_type": "WORKED_EXAMPLES",
    "style": "STEP_BY_STEP",
    "output_format": "TEXT",
    "difficulty": "MEDIUM"
})

if response.status_code == 201:
    data = response.json()
    request_id = data['id']
    print(f"Created request: {request_id}")

    # Get request details
    detail = requests.get(f"{BASE_URL}/{request_id}/")
    print(f"Status: {detail.json()['status']}")

    # List all pending requests
    pending = requests.get(f"{BASE_URL}/?status=pending")
    print(f"Pending requests: {pending.json()['count']}")
```

---

## JavaScript Example (using fetch)

```javascript
const BASE_URL = "http://127.0.0.1:8000/api/content-requests";

// Create a request
async function createRequest() {
  const response = await fetch(`${BASE_URL}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: "React Hooks",
      content_type: "SUMMARY",
      style: "BRIEF",
      output_format: "TEXT",
      difficulty: "EASY",
    }),
  });

  if (response.ok) {
    const data = await response.json();
    console.log(`Created request: ${data.id}`);
    return data.id;
  }
}

// List requests
async function listRequests() {
  const response = await fetch(`${BASE_URL}/`);
  const data = await response.json();
  console.log(`Total requests: ${data.count}`);
  return data.results;
}

// Get request detail
async function getRequest(id) {
  const response = await fetch(`${BASE_URL}/${id}/`);
  const data = await response.json();
  console.log(`Status: ${data.status}`);
  return data;
}
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": "Error message",
  "detail": "Additional details (optional)",
  "errors": {
    "field_name": ["Error message 1", "Error message 2"]
  }
}
```

### Validation Error Example (400)

```json
{
  "error": "Validation failed",
  "errors": {
    "topic": ["This field may not be blank."],
    "content_type": ["\"invalid\" is not a valid choice."]
  }
}
```

### Not Found Example (404)

```json
{
  "error": "Content request not found",
  "request_id": "invalid-uuid"
}
```

---

## Status Transitions

Valid status transitions:

```
PENDING ────────┐
  │             │
  ↓             ↓
PROCESSING ──→ FAILED
  │
  ↓
COMPLETED

Note: FAILED can transition back to PENDING for retry
```

---

## Rate Limits

**Phase 1**: No rate limits implemented

**Phase 2+**: Recommended limits

- 100 requests per minute per IP
- 1000 requests per day per user

---

## Testing

Run the included test suite:

```bash
python test_phase1.py
```

Expected output:

```
✓ Create Request
✓ List Requests
✓ Get Detail
✓ Filter by Status
✓ Invalid Request Handling

Total: 5/5 tests passed
🎉 All tests passed! Phase 1 is working correctly.
```
