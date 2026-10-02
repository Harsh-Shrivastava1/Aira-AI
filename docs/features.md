# Features

Detailed catalog of implemented features in AIRA AI.

## 1. Voice Interaction & Echo Cancellation
- **What it does**: Allows continuous hands-free interaction. AIRA speaks replies aloud and listens for user input.
- **How it works**: Uses the browser's `SpeechRecognition` and `speechSynthesis` APIs. The `useVoice` hook implements strict mutex locks. When AIRA speaks, the microphone is temporarily muted (or its input ignored via transcript matching) to prevent AIRA from transcribing its own voice.
- **Barge-in**: The user can interrupt AIRA mid-sentence. AIRA detects this, cancels its speech, and processes the new command.

## 2. Gmail Integration
- **What it does**: Search, read, draft, and send emails via natural voice commands.
- **How it works**: Uses OAuth 2.0 to securely connect to the user's Gmail.
- **Actions**:
  - *Search*: "Find my recent emails from Amazon."
  - *Read*: "Read the latest one."
  - *Draft*: "Draft a reply saying thank you."
  - *Send*: Explicit confirmation required (e.g., "Yes, send it").
- **Security**: Emails are never sent automatically. The system requires a deterministic verbal confirmation that matches specific regex patterns independent of LLM hallucinations.

## 3. Persistent Memory
- **What it does**: Remembers user background, preferences, and long-term context across sessions.
- **How it works**: The backend `/api/extract-memory` route runs asynchronously to identify facts from conversation history and save them to a dedicated Firestore `memory` document. This memory is injected into the system prompt for all new conversations.

## 4. Web Search
- **What it does**: Fetches real-time information from the internet.
- **How it works**: When the Web Search toggle is enabled in the UI, `/api/chat` uses the Tavily API to fetch context before querying the LLM, allowing accurate answers for current events with citations.

## 5. File & Code Analysis
- **What it does**: Allows users to upload PDFs/Text files or paste code snippets for context.
- **How it works**: Files are parsed via `/api/upload` or the Paste Content modal. The text is held in memory as `fileContext` and routed to `/api/file-chat` for specialized Q&A.

## 6. Mock Interviews
- **What it does**: Provides structured, roleplay-based HR or Technical interviews.
- **How it works**: Triggered via UI scenarios, modifying the system prompt to enforce rigorous questioning and post-interview scoring.
