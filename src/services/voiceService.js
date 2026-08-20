/**
 * Modular Voice Service for AIRA
 * Encapsulates voice selection, text sanitization, sentence chunking,
 * and speech synthesis orchestration.
 * 
 * Provides an isolated interface so alternative TTS engines (e.g., ElevenLabs,
 * Google Cloud TTS, Azure Neural) can be integrated in the future without
 * modifying the conversation or React hook layers.
 */

import { VOICE_CONFIG, matchVoiceCommand } from "./voiceConfig.js";

/**
 * Robust voice selection strategy:
 * 1. Checks prioritized preferred voices
 * 2. Filters for natural English voices (en-US, en-GB, etc.)
 * 3. Excludes known low-quality / robotic voices
 * 4. Falls back gracefully
 */
export function selectBestVoice(voices) {
  if (!voices || voices.length === 0) return null;

  // Filter out excluded robotic voices
  const eligibleVoices = voices.filter(
    (v) => !VOICE_CONFIG.excludedVoices.some((ex) => v.name.includes(ex))
  );
  const pool = eligibleVoices.length > 0 ? eligibleVoices : voices;

  // 1. Preferred list matching
  for (const preferredName of VOICE_CONFIG.preferredVoices) {
    const matched = pool.find(
      (v) => v.name.toLowerCase() === preferredName.toLowerCase() || v.name.includes(preferredName)
    );
    if (matched) return matched;
  }

  // 2. High-quality / Neural indicators
  const neuralVoice = pool.find(
    (v) =>
      (v.name.includes("Natural") || v.name.includes("Online") || v.name.includes("Neural")) &&
      v.lang.startsWith("en")
  );
  if (neuralVoice) return neuralVoice;

  // 3. Any standard en-US voice
  const enUsVoice = pool.find((v) => v.lang === "en-US" || v.lang === "en_US");
  if (enUsVoice) return enUsVoice;

  // 4. Any English voice
  const enVoice = pool.find((v) => v.lang.startsWith("en"));
  if (enVoice) return enVoice;

  // 5. Fallback to first available
  return pool[0] || null;
}

/**
 * Clean text for spoken output:
 * Removes markdown symbols, code fences, emojis, urls, and brackets
 * so SpeechSynthesis speaks smoothly without reading syntax aloud.
 */
export function sanitizeTextForSpeech(text) {
  if (!text) return "";
  let clean = text;

  // Remove code blocks entirely or replace with brief spoken placeholder if large
  clean = clean.replace(/```[\s\S]*?```/g, " I've provided the code on screen. ");

  // Remove inline code
  clean = clean.replace(/`([^`]+)`/g, "$1");

  // Remove markdown headings, bold, italics, strikethrough, blockquotes
  clean = clean.replace(/^#{1,6}\s+/gm, "");
  clean = clean.replace(/(\*\*|__)(.*?)\1/g, "$2");
  clean = clean.replace(/(\*|_)(.*?)\1/g, "$2");
  clean = clean.replace(/~~(.*?)~~/g, "$1");
  clean = clean.replace(/^\s*>\s+/gm, "");

  // Remove bullet points / numbered list markers at line starts
  clean = clean.replace(/^\s*[-*+]\s+/gm, "");
  clean = clean.replace(/^\s*\d+\.\s+/gm, "");

  // Remove URLs
  clean = clean.replace(/https?:\/\/\S+/gi, "link");

  // Clean brackets and braces
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // markdown links
  clean = clean.replace(/[{}[\]]/g, "");

  // Normalize whitespace
  clean = clean.replace(/\s+/g, " ").trim();

  return clean;
}

/**
 * Split text into natural conversational sentence/clause chunks for TTS
 * Ensures long responses do not freeze the browser speech synthesis engine
 * and allows immediate mid-speech interruption.
 */
export function chunkSpeechText(text, maxChunkLen = VOICE_CONFIG.chunking.maxChunkLength) {
  const clean = sanitizeTextForSpeech(text);
  if (!clean) return [];

  if (clean.length <= maxChunkLen) {
    return [clean];
  }

  // Split by sentence boundaries (. ! ?)
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  const chunks = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length <= maxChunkLen) {
      currentChunk = currentChunk ? `${currentChunk} ${trimmed}` : trimmed;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }

      // If a single sentence exceeds maxChunkLen, split by commas/semicolons
      if (trimmed.length > maxChunkLen) {
        const clauses = trimmed.split(/([,;:]\s+)/);
        let clauseChunk = "";
        for (const clause of clauses) {
          if (clauseChunk.length + clause.length <= maxChunkLen) {
            clauseChunk += clause;
          } else {
            if (clauseChunk.trim()) chunks.push(clauseChunk.trim());
            clauseChunk = clause;
          }
        }
        if (clauseChunk.trim()) {
          currentChunk = clauseChunk.trim();
        } else {
          currentChunk = "";
        }
      } else {
        currentChunk = trimmed;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [clean];
}

/**
 * Multi-layer Acoustic Echo vs User Interruption Classifier
 * 
 * Prevents AIRA from interpreting her own speaker audio as user speech
 * while ensuring instant, sensitive detection when the user actually speaks or commands.
 */
export function classifyMicrophoneInput({
  heardText,
  activeSpokenChunk,
  lastSpokenText,
  isSpeaking,
  elapsedSinceChunkStartMs
}) {
  if (!isSpeaking) {
    return { isEcho: false, isInterruption: false, reason: "assistant_silent" };
  }

  const cleanedHeard = (heardText || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");

  if (!cleanedHeard || cleanedHeard.length < VOICE_CONFIG.noiseFilter.minNonCommandLength) {
    return { isEcho: true, isInterruption: false, reason: "noise_or_too_short" };
  }

  // 1. High-priority voice command match (e.g. "stop", "wait", "repeat that")
  const matchedCmd = matchVoiceCommand(cleanedHeard);
  if (matchedCmd) {
    return { isEcho: false, isInterruption: true, reason: `voice_command_${matchedCmd}`, command: matchedCmd };
  }

  // 2. Interruption keyword fast-path
  const INTERRUPTION_KEYWORDS = ["wait", "stop", "hold on", "hang on", "pause", "no", "actually", "cancel", "shut up", "repeat", "slower", "faster", "listen"];
  const heardWords = cleanedHeard.split(" ").filter(Boolean);
  const hasInterruptionKeyword = heardWords.some(w => INTERRUPTION_KEYWORDS.includes(w));
  if (hasInterruptionKeyword && heardWords.length <= 5) {
    return { isEcho: false, isInterruption: true, reason: "interruption_keyword" };
  }

  // 3. Audio startup immunity window (first 200ms of any TTS chunk)
  if (elapsedSinceChunkStartMs !== undefined && elapsedSinceChunkStartMs < 200) {
    return { isEcho: true, isInterruption: false, reason: "tts_startup_immunity" };
  }

  // 4. Token overlap comparison against actively spoken chunk and full response text
  const cleanActive = (activeSpokenChunk || "").toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
  const cleanFull = (lastSpokenText || "").toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");

  const activeWords = new Set(cleanActive.split(" ").filter(Boolean));
  const fullWords = new Set(cleanFull.split(" ").filter(Boolean));

  let matchInActive = 0;
  let matchInFull = 0;

  for (const word of heardWords) {
    if (activeWords.has(word)) matchInActive++;
    if (fullWords.has(word)) matchInFull++;
  }

  const activeOverlapRatio = heardWords.length > 0 ? matchInActive / heardWords.length : 0;
  const fullOverlapRatio = heardWords.length > 0 ? matchInFull / heardWords.length : 0;

  // Substring match
  const isDirectSubstring = (cleanActive.includes(cleanedHeard) || cleanFull.includes(cleanedHeard)) && cleanedHeard.length > 5;

  if (isDirectSubstring || activeOverlapRatio >= 0.60 || fullOverlapRatio >= 0.70) {
    return { isEcho: true, isInterruption: false, reason: "acoustic_echo_overlap", activeOverlapRatio, fullOverlapRatio };
  }

  // Otherwise, genuine user interruption
  return { isEcho: false, isInterruption: true, reason: "distinct_user_speech" };
}

/**
 * Pre-flight microphone permission and hardware check
 * Verifies that the audio input stream is available and healthy
 * without permanently locking the hardware device.
 */
export async function checkMicrophoneHealth() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { available: false, error: "mediaDevices not supported" };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const tracks = stream.getAudioTracks();
    const isHealthy = tracks.length > 0 && tracks[0].readyState === "live";

    // Release test tracks immediately
    tracks.forEach((t) => t.stop());

    return { available: isHealthy, error: null };
  } catch (err) {
    return { available: false, error: err.name || err.message };
  }
}
