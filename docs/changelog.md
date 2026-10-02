# Changelog

Historical changes to the AIRA AI repository.

## Recent Updates
- **Gmail Search/Read Overhaul**: Replaced regex parsing with structured Groq LLM JSON parsing for highly accurate Gmail parameter extraction (`emailHelper.js`).
- **Gmail Metadata Optimization**: Updated `gmailService.js` to use `format: "metadata"` for searches, vastly improving performance by skipping MIME payloads.
- **Voice System Echo Fix**: Fixed ReferenceError in `voiceService.js` related to `allSpokenWords` initialization during echo cancellation.
- **Paste Content Silent Handoff**: Modified `Agent.jsx` to use native `window.speechSynthesis` for Text/Code Mode handoffs, preventing unintended microphone activation.
- **UI Unification**: Removed visual boundary on the Login page to unify the background gradient.
