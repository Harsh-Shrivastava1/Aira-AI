# Voice System

The voice system is the core of AIRA, built primarily in `src/hooks/useVoice.js` and `src/services/voiceService.js`.

## Components
- **SpeechRecognition**: Standard Web Speech API for transcribing user audio.
- **speechSynthesis (TTS)**: Standard Web Speech API for reading AI responses aloud.
- **VoiceOrb**: The visual representation in the UI that reflects the current state.

## State Machine
The `useVoice` hook operates a strict state machine:
- `idle`: Not listening, not speaking. Orb is solid.
- `listening`: Microphone is active, waiting for speech. Orb pulses.
- `thinking`: User has finished speaking, awaiting API response. Orb spins.
- `speaking`: TTS is active. Microphone is either suspended or actively ignoring input to prevent echoes. Orb shows wave animation.
- `error`: Microphone permission denied or network error.

## Interruption & Barge-in
AIRA supports natural interruption. If the user speaks while AIRA is speaking (the `speaking` state), the system captures the transcript. If it passes echo-cancellation checks (meaning it's not AIRA hearing herself), `cancelActiveSpeech()` is fired. This immediately stops TTS, unlocks the mutex, and transitions to `thinking` to process the user's interruption.

## Echo Prevention
Echo cancellation is handled in `voiceService.js` (`isEchoTranscript`).
When AIRA speaks, her exact words are tracked. If the microphone picks up a transcript that closely matches the currently spoken text or recent chunks, it is flagged as an echo and ignored, preventing infinite feedback loops.

## Microphone Lifecycle
Microphone permissions are requested on first interaction. The system includes watchdog timers to automatically restart recognition if it silently fails or times out, ensuring the assistant is always ready when in the `listening` state.

## Important Note
**DO NOT MODIFY** the voice engine code directly. The state machine is highly sensitive to timing and browser quirks across Chrome/Edge/Safari.
