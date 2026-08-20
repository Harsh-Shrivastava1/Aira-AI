/**
 * Centralized Voice & Speech Configuration for AIRA
 * All timing, rate, pitch, silence thresholds, and voice selection preferences
 * live here to avoid scattered magic numbers.
 */

export const VOICE_CONFIG = {
  // Speaking rates
  rates: {
    default: 1.00,      // Natural, brisk, responsive conversational speed
    slow: 0.78,         // Slower for clarity or when requested
    fast: 1.08,         // Slightly faster when requested
    complex: 0.88,      // Slightly slowed down for dense technical explanations
    min: 0.65,          // Minimum allowed rate
    max: 1.35,          // Maximum allowed rate
    step: 0.12,         // Incremental step for "faster" / "slower"
  },

  // Pitch settings
  pitch: {
    default: 1.05,      // Warm, natural tone without sounding high-pitched or childlike
    min: 0.9,
    max: 1.2,
  },

  // Volume
  volume: {
    default: 1.0,
  },

  // Silence handling & speech recognition timing (in ms)
  silence: {
    interimGraceMs: 750,     // Grace period to allow natural mid-sentence pauses
    finalGraceMs: 450,       // Snappy turn finalization after user finishes sentence
    maxContinuousListenMs: 15000, // Safety boundary for continuous speech listening
  },

  // Pacing & transitions (in ms)
  delays: {
    preSpeakMs: 0,           // Immediate speech start without artificial waiting
    postSpeakListenDelayMs: 200, // Small gap after speech ends before auto-opening mic
    recoveryBackoffMs: 600,  // Wait time before retrying a recoverable speech/network failure
  },

  // Voice synthesis chunking for long responses
  chunking: {
    enabled: true,
    maxChunkLength: 250,     // Target character count per sentence chunk
    maxUtteranceQueue: 8,    // Maximum chunks queued simultaneously
  },

  // Minimum transcript length for non-command noise filtering
  noiseFilter: {
    minNonCommandLength: 2,  // Discard 1-character clicks/fragments unless matched to a command
    ignoredFragments: ["uh", "um", "ah", "eh", "mm"],
  },

  // Priority ordered voice preferences across operating systems (Edge neural, Chrome, macOS, iOS, Android, Windows)
  preferredVoices: [
    // High-quality neural / natural voices (Edge & Chrome)
    "Microsoft Jenny Online (Natural) - English (United States)",
    "Microsoft Aria Online (Natural) - English (United States)",
    "Microsoft Guy Online (Natural) - English (United States)",
    "Google US English",
    "Google UK English Female",
    // macOS / iOS natural voices
    "Samantha",
    "Victoria",
    "Karen",
    "Siri",
    "Moira",
    // Windows desktop voices
    "Microsoft Zira - English (United States)",
    "Microsoft David - English (United States)",
    "Microsoft Mark - English (United States)",
  ],

  // Excluded robotic / legacy voice identifiers if better alternatives exist
  excludedVoices: [
    "eSpeak",
    "Albert",
    "Bad News",
    "Bahh",
    "Bells",
    "Boing",
    "Bubbles",
    "Cellos",
    "Deranged",
    "Good News",
    "Hysterical",
    "Pipe Organ",
    "Trinoids",
    "Whisper",
    "Wobble",
    "Zarvox",
  ],
};

/**
 * Standard voice commands recognized across conversation turns
 */
export const VOICE_COMMANDS = {
  STOP: ["stop", "shut up", "quiet", "be quiet", "silence", "stop talking", "hold on", "pause", "stop please"],
  WAIT: ["wait", "hang on", "one second", "give me a second", "just a moment", "wait a moment", "wait a sec", "wait a second", "wait a minute", "give me a moment", "hold on a second", "hold on a moment"],
  REPEAT: ["repeat that", "say that again", "repeat", "say again", "what did you say", "come again", "pardon"],
  SLOWER: ["slow down", "speak slower", "talk slower", "too fast", "speak slowly", "talk slowly"],
  FASTER: ["speak faster", "talk faster", "speed up", "too slow", "faster"],
  SHORTER: ["shorter", "summarize that", "make it shorter", "be more concise", "keep it brief", "too long"],
  DEEPER: ["go deeper", "explain that", "tell me more", "elaborate", "give more detail"],
  STOP_INTERVIEW: ["stop the interview", "end the interview", "stop interview", "exit interview", "end interview"],
};

const POLITE_PREFIXES = /^(?:please|can you|could you|would you|aira|hey aira|ok aira|okay aira)\s+/i;
const POLITE_SUFFIXES = /\s+(?:please|aira|now|thanks|thank you)$/i;

/**
 * Context-Aware Voice Command Matcher
 * 
 * Accurately detects standalone voice commands while avoiding false positives
 * on ordinary speech (e.g. "Wait, I have a question about Java" or "I don't want to stop").
 * 
 * @param {string} transcript 
 * @returns {string|null} command type or null
 */
export function matchVoiceCommand(transcript) {
  if (!transcript) return null;

  let cleaned = transcript
    .trim()
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "")
    .replace(/\s+/g, " ");

  // Strip polite prefixes & suffixes (e.g. "Please stop", "Can you slow down", "Stop please")
  cleaned = cleaned.replace(POLITE_PREFIXES, "").replace(POLITE_SUFFIXES, "").trim();

  // 1. Exact match against known command patterns
  for (const [commandType, patterns] of Object.entries(VOICE_COMMANDS)) {
    for (const pattern of patterns) {
      if (cleaned === pattern) {
        return commandType;
      }
    }
  }

  // 2. Specific multi-word commands with natural minor variations
  if (/^(?:stop the interview|end the interview|exit the interview)$/.test(cleaned)) return "STOP_INTERVIEW";
  if (/^(?:say that again|repeat that again|repeat what you said)$/.test(cleaned)) return "REPEAT";
  if (/^(?:slow down a bit|speak a bit slower|talk a bit slower)$/.test(cleaned)) return "SLOWER";
  if (/^(?:speed up a bit|speak a bit faster|talk a bit faster)$/.test(cleaned)) return "FASTER";

  return null;
}
