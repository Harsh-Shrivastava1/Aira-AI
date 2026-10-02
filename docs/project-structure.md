# Project Structure

The AIRA repository is divided into frontend code, serverless API routes, and documentation.

## Root Directories

### `src/`
Contains the entire React (Vite) frontend application.
- **`components/`**: Reusable UI elements (VoiceOrb, TransientChatBox, EmailDraftPanel).
- **`pages/`**: Top-level views (`Login.jsx`, `Agent.jsx`).
- **`hooks/`**: Custom React hooks (`useVoice.js` for speech lifecycle, `useFirestore.js` for DB operations).
- **`services/`**: Client-side logic (`voiceService.js`, `errorRecoveryService.js`).
- **`config/`**: Client-side environment/Firebase init (`firebase.js`).

### `api/`
Contains the Node.js Vercel serverless functions representing the backend.
- **`chat.js`**: Primary orchestrator for conversation, web search, and email actions.
- **`file-chat.js`**: Handles QA on uploaded files or pasted content.
- **`extract-memory.js`**: Background job to distill long-term user preferences.
- **`generate-title.js`**: Generates chat thread titles.
- **`upload.js`**: Parses PDFs and text files.
- **`gmail/`**: OAuth endpoints (`connect`, `callback`, `status`, `disconnect`).

### `api/_lib/`
Contains shared backend service modules (not exposed as public endpoints).
- **`gmailService.js`**: Wraps Googleapis to fetch, read, and send emails.
- **`emailHelper.js`**: Uses LLMs to parse natural language into structured Gmail parameters.
- **`groqClient.js`**: Handles LLM requests and API key failover.
- **`memoryService.js`**: Firestore queries for context memory.
- **`tokenCrypto.js`**: AES-256 encryption/decryption for Gmail refresh tokens.
- **`userProfile.js`**: Manages user profiles in Firestore.
- **`webSearchService.js`**: Tavily integration for real-time web search.
- **`rateLimiter.js`**: Rate limits endpoint requests.

### `docs/`
Contains this comprehensive documentation system.

### `public/`
Static assets served directly (e.g., icons, fonts).

## Important Root Files
- **`package.json`**: Dependencies and npm scripts.
- **`vite.config.js`**: Vite build configuration.
- **`vercel.json`**: Defines serverless function routing and runtime configuration for Vercel.
- **`firestore.rules`**: Firebase security rules ensuring users can only read/write their own documents.
- **`.env.example`**: Template for required environment variables.
