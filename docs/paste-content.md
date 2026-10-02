# Paste Content

The Paste Content feature allows users to easily provide large blocks of text or code without dealing with actual files.

## Text Mode
- **Entering Content**: The user opens the Paste Content modal and pastes a large article or text block.
- **Analysis**: The text is sent to `/api/file-chat`.
- **Handoff**: AIRA processes the text, adds the summary to the chat visually, and speaks a silent handoff message natively using `window.speechSynthesis`: *"I’ve got it. Tap the orb whenever you’re ready, and we can talk about it."*
- **Context**: Listening does *not* automatically start. The context is saved in `fileContext`. When the user taps the VoiceOrb, they can immediately ask questions about the pasted text.

## Code Mode
- **Entering Content**: The user selects Code Mode and pastes source code.
- **Handoff**: AIRA speaks natively: *"I’ve got your code. Tap the orb whenever you’re ready, and we’ll go through it together."*
- **Context**: The backend prompt instructs the LLM to act as a senior software engineer when analyzing this context.

**Note**: The spoken handoff bypasses the core `useVoice.js` engine to prevent auto-activation of the microphone, ensuring the user has full control over when to start the technical discussion.
