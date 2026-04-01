# Chat API Testing Guide

## Backend Endpoints - Testing Instructions

### Prerequisites
- Dev server running on `http://localhost:3000`
- Postman or similar HTTP client
- (Optional) Clerk authentication token for full testing

---

## Endpoint 1: Create Thread

**Endpoint:** `POST /api/chat/threads`

**Purpose:** Create a new chat thread and save the first user message

**Request Body:**
```json
{
  "articleId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "What is the main topic of this article?"
}
```

**Expected Responses:**

### ✅ Success (200)
```json
{
  "id": "thread-uuid-here",
  "title": "What is the main topic of...",
  "isNew": true
}
```

### ✅ Thread Already Exists (200)
If thread already exists for this user + article:
```json
{
  "id": "existing-thread-uuid",
  "title": "Previous title",
  "isNew": false
}
```

### ❌ Error Cases
- **401 Unauthorized**: Missing Clerk authentication
- **400 Bad Request**: Missing articleId or message
- **500 Internal Server Error**: Database error

---

## Endpoint 2: Stream Chat Response

**Endpoint:** `POST /api/chat`

**Purpose:** Stream Groq AI response and save to database

**Request Body:**
```json
{
  "threadId": "550e8400-e29b-41d4-a716-446655440000",
  "articleId": "article-uuid-here",
  "message": "What is the main topic of this article?"
}
```

**Response Format:** NDJSON (newline-delimited JSON)

Each line is a JSON object:
```json
{"token": "Você", "index": 1}
{"token": " é", "index": 2}
{"token": " o", "index": 3}
...
{"complete": true, "suggestions": ["Question 1?", "Question 2?", "Question 3?"]}
```

### Testing in Postman

1. **Set Request Type:** POST
2. **URL:** `http://localhost:3000/api/chat`
3. **Headers:**
   - Content-Type: application/json
4. **Body (raw JSON):**
   ```json
   {
     "threadId": "your-thread-id",
     "articleId": "your-article-id",
     "message": "Your question here"
   }
   ```
5. **Response:** Click "Send" and watch the streaming response come in

---

## Testing via Browser Console

You can test the streaming endpoint directly in browser console:

```javascript
async function testChatStream() {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      threadId: 'test-thread-id',
      articleId: 'test-article-id',
      message: 'What is this about?'
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const json = JSON.parse(line);
      console.log('Received:', json);

      if (json.token) {
        console.log('Token:', json.token);
      }
      if (json.complete) {
        console.log('Suggestions:', json.suggestions);
      }
    }
  }
}

// Run it:
await testChatStream();
```

---

## Testing via curl

### Test 1: Create Thread
```bash
curl -X POST http://localhost:3000/api/chat/threads \
  -H "Content-Type: application/json" \
  -d '{
    "articleId": "550e8400-e29b-41d4-a716-446655440000",
    "message": "What is this about?"
  }'
```

### Test 2: Stream Response
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "threadId": "550e8400-e29b-41d4-a716-446655440001",
    "articleId": "550e8400-e29b-41d4-a716-446655440000",
    "message": "Explain the main points"
  }' \
  -N  # --no-buffer to stream immediately
```

---

## Implementation Checklist

### Backend (✅ COMPLETED)

- [x] POST `/api/chat/threads` endpoint created
  - [x] Clerk authentication validation
  - [x] Check for existing thread (user + article combo)
  - [x] Create new thread with title from first message
  - [x] Save first user message to database
  - [x] Return thread ID

- [x] POST `/api/chat` endpoint created
  - [x] Clerk authentication validation
  - [x] Fetch raw_items.content for article
  - [x] Build system prompt with Chicote Sênior persona
  - [x] Stream Groq response via NDJSON
  - [x] Extract 3 follow-up suggestions
  - [x] Save user message to database
  - [x] Save assistant response + suggestions to database
  - [x] Update thread updated_at timestamp

### Frontend (⏳ NEXT PHASE)

- [ ] ChatThread component with fixed bottom input
- [ ] Dynamic padding based on sidebar state
- [ ] First message → create thread → redirect
- [ ] Auto-load response on thread page load
- [ ] Display follow-up suggestions as buttons

### Thread Page (⏳ NEXT PHASE)

- [ ] Load thread data and messages
- [ ] Display article reference card
- [ ] Auto-trigger AI response if last message is from user

---

## Database Verification

To verify the database is receiving messages correctly:

```sql
-- Check if thread was created
SELECT * FROM chat_threads
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC LIMIT 5;

-- Check messages in thread
SELECT * FROM chat_messages
WHERE thread_id = 'your-thread-id'
ORDER BY created_at ASC;

-- Check if follow-up suggestions were saved
SELECT id, role, follow_up_suggestions
FROM chat_messages
WHERE thread_id = 'your-thread-id' AND role = 'assistant';
```

---

## Next Steps

Once you've verified the streaming works:

1. ✅ **Phase 2 Backend API** (COMPLETE)
2. → **Phase 3: Frontend Components** (Next)
   - Rewrite ChatThread component
   - Add input handling and streaming parsing
   - Integrate with FeedContext for dynamic padding
3. → **Phase 4: Thread Page** (Then)
   - Auto-response logic
   - Message history display

