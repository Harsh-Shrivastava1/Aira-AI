# API Reference

AIRA uses Vercel Serverless Functions. All endpoints expect a valid Firebase ID token in the `Authorization: Bearer <token>` header.

## `/api/chat`
- **Method**: POST
- **Purpose**: Main conversation orchestrator. Handles standard chat, web search, and Gmail search/read/draft intents.
- **Body**: `{ transcript, messageHistory, currentScenario, emailDraft, timeZone }`
- **Response**: `{ reply, emailDraft, intent, scenario, error }`

## `/api/file-chat`
- **Method**: POST
- **Purpose**: Specialized QA for uploaded files and pasted content.
- **Body**: `{ question, fileContent, fileName, type }`
- **Response**: `{ reply }`

## `/api/extract-memory`
- **Method**: POST
- **Purpose**: Background distillation of user facts.
- **Body**: `{ transcript, existingMemory }`
- **Response**: 200 OK (Updates Firestore directly)

## `/api/upload`
- **Method**: POST
- **Purpose**: Parses uploaded files (PDF, TXT).
- **Body**: `multipart/form-data` containing `file`.
- **Response**: `{ text, fileName }`

## `/api/gmail/*`
- **`/connect` (GET)**: Redirects to Google OAuth consent screen.
- **`/callback` (GET)**: Handles OAuth callback, encrypts token, stores in Firestore.
- **`/status` (GET)**: Returns `{ connected, emailAddress }`.
- **`/disconnect` (POST)**: Deletes Gmail token from user profile.
- **`/send` (POST)**: Executes Gmail API to send an email. Requires `{ to, subject, body }`.
