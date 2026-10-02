# Gmail Integration

AIRA features deep integration with the Gmail API, allowing for voice-controlled inbox management.

## OAuth and Authentication
Users connect their Gmail via the UI, which routes to `/api/gmail/connect`.
This initiates a standard Google OAuth 2.0 flow. The scopes requested include read and send permissions (`https://www.googleapis.com/auth/gmail.readonly`, `https://www.googleapis.com/auth/gmail.send`).
Tokens are encrypted using AES-256 (`tokenCrypto.js`) and stored in the user's Firestore profile.

## Searching and Reading
When the LLM detects a search intent, it triggers `parseGmailIntentAsync` (`emailHelper.js`), which extracts structured search parameters (sender, subject, timeframe).
- **searchEmails**: Uses `format: "metadata"` to quickly fetch headers without downloading massive payloads.
- **getMessage / getThread**: Fetches full email payloads. The `createCleanBody` function strips noisy HTML and reply-chain artifacts so the LLM gets clean, legible text.

## Email Drafting
Users can say "Draft an email to John". The LLM responds with a JSON block containing the `emailDraft` object (to, subject, body). The frontend catches this and opens the `EmailDraftPanel` UI.

## Sending and Confirmation (SECURITY BOUNDARY)
The system requires **Explicit Deterministic Confirmation** to send emails.
1. The user asks to send the draft.
2. The LLM must prompt for final confirmation.
3. The user says "Yes, send it".
4. The frontend relies on strict Regex matching (`emailHelper.js`) on the user's transcript to authorize the send.
5. **CRITICAL**: The LLM output stating "I have sent the email" is NEVER treated as authorization to actually trigger the Gmail API. This prevents hallucinations from executing destructive side-effects.

## Error Handling
If an OAuth token expires and fails to refresh, the backend returns a 401, prompting the frontend to ask the user to reconnect their Gmail.
