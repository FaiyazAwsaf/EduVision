# Phase 2 Frontend - Quick Start Guide

## Prerequisites

- Backend running on `http://127.0.0.1:8000`
- Django development server started
- Celery worker running
- Redis running (for Celery)

## Installation Steps

### 1. Navigate to Frontend Directory

```bash
cd E:\code\EduVision\frontend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment (Optional)

If backend is not on default port, create `.env.local`:

```bash
# Copy example
copy .env.local.example .env.local

# Edit if needed
# NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

### 4. Start Development Server

```bash
npm run dev
```

### 5. Open Browser

Navigate to: [http://localhost:3000](http://localhost:3000)

## Testing the Flow

### Test 1: TEXT Format

1. Enter topic: "Pythagorean Theorem"
2. Select Content Type: "Summary"
3. Select Style: "Detailed"
4. Select Difficulty: "Medium"
5. Select Output Format: "**TEXT**"
6. Click "Generate Content"
7. Wait for status to change from "Queued" → "Generating..." → "Ready"
8. View inline content with metadata

### Test 2: PDF Format

1. Enter topic: "Linear Algebra Basics"
2. Select Content Type: "Worked Examples"
3. Select Style: "Step by Step"
4. Select Difficulty: "Easy"
5. Select Output Format: "**PDF**"
6. Click "Generate Content"
7. Wait for completion
8. Click "Download PDF" button
9. Verify PDF downloads correctly

### Test 3: Worksheet Format

1. Enter topic: "Quadratic Equations"
2. Select Content Type: "Formula Sheet"
3. Select Style: "Brief"
4. Select Difficulty: "Hard"
5. Select Output Format: "**WORKSHEET**"
6. Click "Generate Content"
7. Wait for completion
8. Click "Download WORKSHEET" button
9. Verify worksheet downloads correctly

## Troubleshooting

### Issue: "Failed to create content request"

**Cause:** Backend not running or unreachable

**Solution:**

```bash
# Terminal 1: Start Django
cd E:\code\EduVision\backend
python manage.py runserver

# Terminal 2: Start Celery
cd E:\code\EduVision\backend
celery -A config worker --loglevel=info --pool=solo

# Terminal 3: Verify Redis
redis-cli ping
# Should respond: PONG
```

### Issue: Request stuck in "Generating..." forever

**Cause:** Celery worker not running or crashed

**Solution:**

```bash
# Check if worker is running
# Look for "celery@..." process

# Restart worker
cd E:\code\EduVision\backend
celery -A config worker --loglevel=info --pool=solo
```

### Issue: CORS errors in browser console

**Cause:** Backend CORS not configured for frontend origin

**Solution:**
Backend `settings.py` should have:

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
```

This is already configured in your backend.

### Issue: Downloads fail with 404

**Cause:** Content not yet generated or backend endpoint issue

**Solution:**

1. Verify status is "Ready" before downloading
2. Check backend logs for errors
3. Try retrieving as TEXT format first to verify content exists

## Development Workflow

### Making Changes

1. Edit files in `src/`
2. Next.js automatically hot-reloads
3. Check browser for updates
4. Check browser console for errors

### Project Structure

```
src/
├── api/               # Backend communication
│   └── contentRequests.ts
├── components/        # UI components
│   ├── ContentRequestForm.tsx
│   ├── RequestStatus.tsx
│   ├── GeneratedContentView.tsx
│   ├── StatusBadge.tsx
│   └── ErrorMessage.tsx
├── config/            # Configuration
│   └── api.ts
├── types/             # TypeScript types
│   └── content.ts
└── app/               # Next.js pages
    └── page.tsx       # Main page
```

### Adding New Features

**To add a new field to the form:**

1. Update `src/types/content.ts` - Add to `CreateContentRequestPayload`
2. Update `src/components/ContentRequestForm.tsx` - Add form field
3. Backend should already support it if it's in the API

**To change polling behavior:**

1. Edit `src/config/api.ts` - Update `POLLING_CONFIG`

**To add a new view:**

1. Create new page in `src/app/`
2. Use existing API services in `src/api/contentRequests.ts`

## Build for Production

```bash
# Create optimized build
npm run build

# Test production build locally
npm start

# Open http://localhost:3000
```

## Next Steps (Phase 3)

Phase 3 will add:

- User authentication
- Request history
- WebSocket real-time updates
- Analytics dashboard

The current architecture is designed to support these additions without major refactoring.

## Support

For issues or questions:

1. Check browser console for errors
2. Check backend logs
3. Verify all services are running (Django, Celery, Redis)
4. Review [README_PHASE2.md](./README_PHASE2.md) for detailed documentation
