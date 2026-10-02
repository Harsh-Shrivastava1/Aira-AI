# Getting Started

This guide walks you through setting up AIRA AI for local development.

## Prerequisites
- Node.js (v18+ recommended)
- npm (v9+)
- A Firebase project (for Auth & Firestore)
- A Groq Cloud account (for LLM inference API keys)
- A Google Cloud Console project (for Gmail API OAuth 2.0 credentials)
- (Optional) Tavily account for Web Search

## Cloning the Repository
```bash
git clone <repository-url>
cd aira-ai
```

## Installing Dependencies
Install the required packages using npm:
```bash
npm install
```

## Environment Configuration
AIRA requires both client-side and server-side environment variables.
Copy the example file to create your local environment:
```bash
cp .env.example .env
```
Fill in the values in your `.env` file. (See [Environment Variables](environment-variables.md) for details).

## Firebase Setup
1. Create a project at [Firebase Console](https://console.firebase.google.com/).
2. Enable **Authentication** (Google Sign-In).
3. Enable **Firestore Database** (See `firestore.rules` for security rules).
4. Go to Project Settings -> Service Accounts, generate a new private key, and set its JSON string as `FIREBASE_SERVICE_ACCOUNT_KEY` in your `.env` file.
5. Copy your client config (apiKey, authDomain, etc.) into the `VITE_FIREBASE_*` variables.

## Google/Gmail Setup
1. In the Google Cloud Console, enable the **Gmail API**.
2. Create **OAuth 2.0 Client IDs** (Web application).
3. Set the Authorized redirect URI to `http://localhost:5173/api/gmail/callback` (and your production Vercel URL).
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in your `.env`.

## Local Development
Start the Vite development server:
```bash
npm run dev
```
- Expected local URL: `http://localhost:5173`
- The Vercel serverless functions in `/api` are automatically handled by Vite proxying or Vercel CLI (`vercel dev`) if you use it.

## Common First-Run Issues
- **Missing Firebase Config**: The UI will crash or fail to login. Check `VITE_FIREBASE_API_KEY`.
- **500 API Errors**: Likely missing `FIREBASE_SERVICE_ACCOUNT_KEY` or `GROQ_API_KEY_1`.
- **Gmail OAuth Fails**: Ensure your Google Cloud OAuth consent screen is configured and your test email is added as a test user if in "Testing" mode.

## How to Verify
1. Open `http://localhost:5173`.
2. Click "Continue with Google" to sign in.
3. Tap the VoiceOrb and say "Hello". AIRA should respond with voice.
