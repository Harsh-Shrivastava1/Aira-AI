/**
 * Modular Voice Service for AIRA
 * Encapsulates voice selection, text sanitization, sentence chunking,
 * and speech synthesis orchestration.
 * 
 * Provides an isolated interface so alternative TTS engines (e.g., ElevenLabs,
 * Google Cloud TTS, Azure Neural) can be integrated in the future without
 * modifying the conversation or React hook layers.
 */

import { VOICE_CONFIG, matchVoiceCommand, INTERRUPTION_PHRASES } from "./voiceConfig.js";

/**
 * Normalizes text for voice matching and comparison:
 * Lowercases, strips punctuation, normalizes whitespace.
 */
export function normalizeTranscript(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Character trigram helper to evaluate phonetic/ASR similarity
 */
function getTrigrams(str) {
  const s = ` ${str} `;
  const trigrams = new Set();
  for (let i = 0; i <= s.length - 3; i++) {
    trigrams.add(s.slice(i, i + 3));
  }
  return trigrams;
}

function calculateTrigramSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const t1 = getTrigrams(s1);
  const t2 = getTrigrams(s2);
  let intersect = 0;
  for (const tri of t1) {
    if (t2.has(tri)) intersect++;
  }
  const union = t1.size + t2.size - intersect;
  return union > 0 ? intersect / union : 0;
}

/**
 * Reusable Acoustic Echo Evaluator
 * 
 * Safely evaluates whether a heard transcript matches text recently spoken by AIRA.
 * Used during active speech and during the trailing post-TTS buffer window.
 * 
 * @param {string} transcript 
 * @param {string} lastSpokenText 
 * @param {string[]|string} spokenChunks 
 * @returns {boolean}
 */
export function isEchoTranscript(transcript, lastSpokenText = "", spokenChunks = []) {
  if (!transcript || typeof transcript !== "string") return false;

  const cleanedHeard = normalizeTranscript(transcript);
  if (!cleanedHeard || cleanedHeard.length < VOICE_CONFIG.noiseFilter.minNonCommandLength) {
    return true; // Noise click or empty fragment
  }

  // Fast-path: Explicit voice command is NEVER echo
  if (matchVoiceCommand(cleanedHeard)) {
    return false;
  }

  // Fast-path: Known interruption phrase or prefix is NEVER echo
  const isInterruption = (INTERRUPTION_PHRASES || []).some(
    (phrase) => cleanedHeard === phrase || cleanedHeard.startsWith(phrase + " ") || cleanedHeard.startsWith(phrase + ",")
  );
  if (isInterruption) {
    return false;
  }

  // Combine spoken texts
  const cleanFull = normalizeTranscript(lastSpokenText);
  const cleanChunks = (Array.isArray(spokenChunks) ? spokenChunks : [spokenChunks])
    .filter(Boolean)
    .map(normalizeTranscript)
    .filter(Boolean);

  if (!cleanFull && cleanChunks.length === 0) {
    return false;
  }

  const heardWords = cleanedHeard.split(" ").filter(Boolean);
  if (heardWords.length === 0) return true;

  // Single-word transcript:
  // A single word is only an echo if the assistant's chunk was literally just that single word
  // (e.g. AIRA said "Understood." or "Okay."). It must NEVER suppress genuine single-word answers
  // (e.g. "Java", "Python", "React", "Yes", "No") when answering questions.
  if (heardWords.length === 1) {
    return cleanChunks.some((chunk) => chunk === cleanedHeard) || cleanFull === cleanedHeard;
  }

  // Token overlap calculation against spoken text
  const allSpokenWords = new Set(
    cleanFull.split(" ").concat(cleanChunks.flatMap((c) => c.split(" "))).filter(Boolean)
  );

  let matchCount = 0;
  for (const word of heardWords) {
    if (allSpokenWords.has(word)) matchCount++;
  }
  const tokenOverlap = matchCount / heardWords.length;

  // Two-word phrase:
  // Must be an exact subphrase of a recent chunk with 100% token overlap to be echo.
  if (heardWords.length === 2) {
    const isExactSubphraseInChunks = cleanChunks.some(
      (chunk) => chunk.includes(cleanedHeard) && cleanedHeard.length >= 8
    );
    return isExactSubphraseInChunks && tokenOverlap === 1.0;
  }

  // Three or more words (heardWords.length >= 3):
  // A. Exact continuous subphrase matching
  const isPhraseInChunks = cleanChunks.some((chunk) => chunk.includes(cleanedHeard));
  const isPhraseInFull = cleanFull && cleanFull.includes(cleanedHeard) && cleanedHeard.length >= 12;
  if (isPhraseInChunks || isPhraseInFull) {
    return true;
  }

  // B. High token overlap (>= 70%)
  if (tokenOverlap >= 0.70) {
    return true;
  }

  // C. Combined Token Overlap (45%+) + Trigram Similarity (ASR phonetic variation)
  let maxTrigramSim = 0;
  for (const chunk of cleanChunks) {
    const sim = calculateTrigramSimilarity(cleanedHeard, chunk);
    if (sim > maxTrigramSim) maxTrigramSim = sim;
  }
  if (cleanFull) {
    const fullSim = calculateTrigramSimilarity(cleanedHeard, cleanFull);
    if (fullSim > maxTrigramSim) maxTrigramSim = fullSim;
  }

  if (tokenOverlap >= 0.45 && maxTrigramSim >= 0.35) {
    return true;
  }

  if (maxTrigramSim >= 0.75) {
    return true;
  }

  return false;
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
  recentSpokenChunks = [],
  lastSpokenText,
  isSpeaking,
  elapsedSinceChunkStartMs
}) {
  if (!isSpeaking) {
    return { isEcho: false, isInterruption: false, reason: "assistant_silent" };
  }

  const cleanedHeard = normalizeTranscript(heardText);
  if (!cleanedHeard || cleanedHeard.length < VOICE_CONFIG.noiseFilter.minNonCommandLength) {
    return { isEcho: true, isInterruption: false, reason: "noise_or_too_short" };
  }

  // 1. High-priority voice command match (e.g. "stop", "wait", "repeat that")
  const matchedCmd = matchVoiceCommand(cleanedHeard);
  if (matchedCmd) {
    return { isEcho: false, isInterruption: true, reason: `voice_command_${matchedCmd}`, command: matchedCmd };
  }

  // 2. Interruption phrase fast-path (e.g. "wait", "actually explain in Java instead")
  const isInterruptionPhrase = (INTERRUPTION_PHRASES || []).some(
    (phrase) => cleanedHeard === phrase || cleanedHeard.startsWith(phrase + " ") || cleanedHeard.startsWith(phrase + ",")
  );
  if (isInterruptionPhrase) {
    return { isEcho: false, isInterruption: true, reason: "interruption_keyword" };
  }

  // 3. Audio startup immunity window (first 150ms of any TTS chunk)
  if (elapsedSinceChunkStartMs !== undefined && elapsedSinceChunkStartMs < 150) {
    return { isEcho: true, isInterruption: false, reason: "tts_startup_immunity" };
  }

  // 4. Multi-layer echo detection
  const chunksToCheck = [activeSpokenChunk, ...(Array.isArray(recentSpokenChunks) ? recentSpokenChunks : [])].filter(Boolean);
  const isEcho = isEchoTranscript(cleanedHeard, lastSpokenText, chunksToCheck);

  if (isEcho) {
    return { isEcho: true, isInterruption: false, reason: "acoustic_echo_detected" };
  }

  // 5. Otherwise, genuine user interruption
  return { isEcho: false, isInterruption: true, reason: "distinct_user_speech" };
}

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
