# EduVision Frontend - Phase 2

AI-Assisted Content Request System frontend implementation.

## Overview

This frontend provides a clean, functional interface for the AI content generation pipeline. It demonstrates:

- Content request submission
- Real-time status polling
- Generated content display
- File downloads (PDF/Worksheet)
- Error handling

## Architecture

### Folder Structure

```
src/
├── api/               # API service layer
│   └── contentRequests.ts
├── components/        # React components
│   ├── ContentRequestForm.tsx
│   ├── RequestStatus.tsx
│   ├── GeneratedContentView.tsx
│   ├── StatusBadge.tsx
│   └── ErrorMessage.tsx
├── config/            # Configuration
│   └── api.ts
├── types/             # TypeScript types
│   └── content.ts
└── app/               # Next.js app router
    ├── layout.tsx
    └── page.tsx
```

### Key Design Principles

1. **Separation of Concerns**

   - API logic in `/api`
   - UI components in `/components`
   - Types centralized in `/types`
   - No API calls inside JSX

2. **Type Safety**

   - All API responses typed
   - Enums match backend exactly
   - No `any` types

3. **Extensibility**

   - Request ID is first-class concept
   - Components are loosely coupled
   - Ready for Phase 3 enhancements:
     - Authentication
     - WebSockets
     - User history
     - Analytics

4. **Error Handling**
   - Network errors caught
   - User-visible messages
   - Retry mechanisms
   - No silent failures

## Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript 5** - Type safety
- **Tailwind CSS 4** - Styling
- **Fetch API** - HTTP requests (no external dependencies)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Backend URL

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Or update `src/config/api.ts` directly.

### 3. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

### Create a Request

1. Fill in the form:

   - **Topic** (required): Subject matter
   - **Content Type**: Summary, Worked Examples, or Formula Sheet
   - **Style**: Brief, Detailed, or Step by Step
   - **Difficulty**: Easy, Medium, or Hard
   - **Output Format**: Text, PDF, or Worksheet
   - **Notes** (optional): Additional context

2. Click "Generate Content"

### Monitor Progress

The page automatically:

- Polls backend every 3 seconds
- Updates status badge
- Shows elapsed time
- Stops polling when complete or failed

### View Results

**Text Format:**

- Rendered inline with formatting
- Metadata displayed
- Character count shown

**PDF/Worksheet:**

- Download button appears
- Click to download file
- Filename handled automatically

## API Integration

### Endpoints Used

```typescript
POST   /api/content-requests/           // Create request
GET    /api/content-requests/{id}/      // Check status
GET    /api/content-requests/{id}/content?format=json  // Get text content
GET    /api/content-requests/{id}/content?format=pdf   // Download PDF
```

### Error Scenarios

| Status        | Handling                             |
| ------------- | ------------------------------------ |
| Network error | Show error message with retry        |
| 404 Not Found | "Request not found"                  |
| FAILED status | Show failure with retry option       |
| Timeout       | After 100 polls (~5min) show timeout |

## Component API

### ContentRequestForm

```typescript
interface ContentRequestFormProps {
  onSuccess: (requestId: string) => void;
}
```

- Validates input
- Calls API service
- Passes request ID to parent

### RequestStatus

```typescript
interface RequestStatusProps {
  requestId: string;
  onCreateNew: () => void;
}
```

- Polls for status updates
- Renders status badge
- Loads generated content when ready
- Handles errors and retries

### GeneratedContentView

```typescript
interface GeneratedContentViewProps {
  content: GeneratedContent;
}
```

- Displays content based on format
- Handles file downloads
- Shows metadata

## Polling Configuration

```typescript
// src/config/api.ts
export const POLLING_CONFIG = {
  INTERVAL_MS: 3000, // Poll every 3 seconds
  MAX_ATTEMPTS: 100, // Stop after 5 minutes
} as const;
```

## State Management

Uses local React state:

```typescript
type ViewState = "form" | "status";
type RequestLifecycleState =
  | "idle"
  | "submitting"
  | "polling"
  | "completed"
  | "failed";
```

No global state library needed for Phase 2.

## Build & Deployment

```bash
# Development
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint
npm run lint
```

## Environment Variables

| Variable              | Required | Default                 | Description          |
| --------------------- | -------- | ----------------------- | -------------------- |
| `NEXT_PUBLIC_API_URL` | No       | `http://127.0.0.1:8000` | Backend API base URL |

## Phase 3 Roadmap

The current architecture is designed to easily support:

1. **Authentication**

   - Wrap routes with auth HOC
   - Add token to API calls
   - Show user-specific requests

2. **WebSockets**

   - Replace polling with real-time updates
   - Update RequestStatus component
   - Keep same UI/UX

3. **Request History**

   - Add list view route
   - Use existing API service
   - Link to status page by ID

4. **Analytics**
   - Track request metrics
   - Usage patterns
   - Performance data

## Troubleshooting

### Backend Connection Issues

```
Error: Failed to create content request
```

**Solution:** Verify backend is running on `http://127.0.0.1:8000`

```bash
# Test backend
curl http://127.0.0.1:8000/api/content-requests/
```

### CORS Errors

If you see CORS errors in browser console:

**Solution:** Backend must include frontend origin in CORS config:

```python
# backend/config/settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
```

### Request Stuck in PROCESSING

**Solution:** Check if Celery worker is running:

```bash
cd backend
celery -A config worker --loglevel=info --pool=solo
```

## Testing Checklist

- [ ] Form validation works
- [ ] Request creation succeeds
- [ ] Status polling updates automatically
- [ ] TEXT format displays inline
- [ ] PDF download works
- [ ] Worksheet download works
- [ ] Error messages display correctly
- [ ] Retry button works
- [ ] Create new request resets form
- [ ] Page responsive on mobile

## License

Part of EduVision Platform - Educational Technology System
