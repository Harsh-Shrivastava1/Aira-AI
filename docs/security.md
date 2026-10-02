# Security

AIRA incorporates strict security boundaries for identity, API access, and LLM safety.

## Authentication and API Security
- **Firebase Auth**: All client-side identity is managed by Firebase.
- **Server Verification**: The Vercel backend extracts the `Bearer` token and verifies it using `firebase-admin`. If the token is missing, expired, or forged, the API immediately returns a `401 Unauthorized`.
- **User Isolation**: Backend endpoints always use the verified `uid` from the token to query Firestore, guaranteeing cross-account data isolation.

## Gmail Token Encryption
- Gmail OAuth refresh tokens are **never** stored in plain text.
- They are encrypted via AES-256-CBC using `GMAIL_TOKEN_ENCRYPTION_KEY` before being saved to Firestore.
- They are decrypted purely in memory during serverless function execution.

## LLM Side-Effect Protection
- **Hallucination Defense**: The LLM is isolated from executing destructive actions (like sending emails) on its own.
- **Deterministic Confirmation**: Sending an email requires the frontend to match explicit user voice intents (e.g., "Yes, send it") via strict Regex. The LLM claiming "I have sent the email" has zero impact on the actual Gmail API.

## Environment Variables
- Client-side variables (`VITE_*`) contain safe, public Firebase configuration.
- Server-side variables (`GROQ_API_KEY`, `GOOGLE_CLIENT_SECRET`, `FIREBASE_SERVICE_ACCOUNT_KEY`) are strictly injected into Vercel runtime and are entirely invisible to the browser.
