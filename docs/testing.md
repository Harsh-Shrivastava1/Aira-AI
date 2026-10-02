# Testing

Manual verification suite for AIRA features.

## 1. Authentication
- **Steps**: Click "Continue with Google".
- **Expected**: Pop-up authenticates, redirects, and lands on the Agent interface. Profile icon shows correct email.

## 2. Basic Voice Interaction
- **Steps**: Tap Orb. Say "Hello, who are you?".
- **Expected**: Orb pulses while listening, spins while thinking, and shows waves while speaking. Audio plays out clearly.

## 3. Interruption (Barge-in)
- **Steps**: Ask "Tell me a long story." While AIRA is speaking, say "Stop, change topic."
- **Expected**: AIRA's speech instantly stops, listening registers the new command, and AIRA responds to the new topic.

## 4. Gmail Integration
- **Steps**: Connect Gmail. Say "Do I have any unread emails?".
- **Expected**: Backend parses intent, fetches metadata, and AIRA summarizes the inbox.
- **Steps**: Say "Draft an email to test@example.com saying hello".
- **Expected**: Email Draft panel opens with populated fields.
- **Steps**: Say "Yes, send it".
- **Expected**: Panel closes, success toast appears, and the email actually arrives in the destination inbox.

## 5. File Context
- **Steps**: Upload a PDF or paste text via "Paste Content". Ask "Summarize this document".
- **Expected**: AIRA accurately summarizes the specific content uploaded, bypassing general web knowledge.
