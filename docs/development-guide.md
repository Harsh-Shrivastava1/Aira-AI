# Development Guide

Best practices for safely modifying the AIRA codebase.

## Frontend Modifications
- UI components live in `src/components/`. 
- Ensure any visual changes respect the dark/light dynamic glassmorphism design language found in `index.css`.

## Backend Modifications
- Vercel functions reside in `api/`.
- Always verify the Firebase `Authorization` token at the very beginning of the function using `firebaseAdmin.js`.
- Any shared logic (LLM API calls, Gmail interactions) must be placed in `api/_lib/` to keep the endpoint handlers clean.

## Safe Voice System Development
**CRITICAL**: The `useVoice.js` and `voiceService.js` files implement a highly fragile, time-sensitive state machine handling microphone mutex locks, echo cancellation, and TTS.
- Do NOT arbitrarily introduce `setTimeout` or state changes in these files.
- Modifying TTS execution flow will break echo cancellation.

## Testing Locally
Run `npm run dev`. The frontend runs on Vite, and API calls are relative to `/api`. Use the terminal logs to inspect `airaVoiceDebug` outputs when debugging voice lifecycle issues.
