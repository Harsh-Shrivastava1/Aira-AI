# Data and Storage

AIRA uses Firebase Authentication and Cloud Firestore for persistent storage.

## Firebase Authentication
Handles user identity. Issues JWTs (ID Tokens) that are verified securely on every Vercel serverless API call via the Firebase Admin SDK.

## Cloud Firestore Structure

### `users/{userId}`
Stores user profile data.
- **Fields**: `email`, `name`, `createdAt`.
- **Gmail Data**: `gmailConnected`, `gmailEmail`, `gmailRefreshToken` (AES-256 encrypted).

### `users/{userId}/memory/user_memory`
Stores the distilled persistent memory block.
- **Fields**: `content`, `updatedAt`.

### `threads/{threadId}`
Stores top-level metadata for conversation threads.
- **Fields**: `userId`, `title`, `startedAt`, `lastMessageAt`, `isArchived`.

### `threads/{threadId}/messages/{messageId}`
Stores the actual conversation history.
- **Fields**: `role` ("user" | "assistant"), `content`, `timestamp`, `type` ("text" | "code").

## Storage Security
Firestore is protected by `firestore.rules` which strictly enforces that `request.auth.uid == userId`. Users cannot read or write data belonging to other users.
