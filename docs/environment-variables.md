# Environment Variables

This document lists all environment variables referenced by the AIRA codebase.

## Server-Side Variables (Vercel / Node.js)
*These must NOT be prefixed with `VITE_` and are completely hidden from the client.*

- `GROQ_API_KEY_1`: Primary API key for Groq inference.
- `GROQ_API_KEY_2`: Secondary fallback API key for Groq.
- `GROQ_API_KEY`: Legacy fallback API key.
- `GOOGLE_CLIENT_ID`: Google OAuth 2.0 Client ID for Gmail integration.
- `GOOGLE_CLIENT_SECRET`: Google OAuth 2.0 Client Secret.
- `GOOGLE_REDIRECT_URI`: OAuth callback URL (e.g., `https://aira-ai-taupe.vercel.app/api/gmail/callback`).
- `GMAIL_TOKEN_ENCRYPTION_KEY`: A highly secure, 32-byte AES-256 encryption key used to protect refresh tokens.
- `FIREBASE_SERVICE_ACCOUNT_KEY`: JSON string representation of the Firebase Admin service account credential.
- `TAVILY_API_KEY`: Optional. API key for the Tavily web search integration.

## Client-Side Variables (React / Vite)
*These MUST be prefixed with `VITE_` to be bundled into the browser application.*

- `VITE_FIREBASE_API_KEY`: Firebase project Web API key.
- `VITE_FIREBASE_AUTH_DOMAIN`: Firebase auth domain.
- `VITE_FIREBASE_PROJECT_ID`: Firebase project ID.
- `VITE_FIREBASE_STORAGE_BUCKET`: Firebase storage bucket URL.
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Firebase messaging sender ID.
- `VITE_FIREBASE_APP_ID`: Firebase App ID.
