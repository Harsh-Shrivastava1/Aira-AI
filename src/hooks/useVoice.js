import { useState, useEffect, useRef, useCallback } from "react";
import { VOICE_CONFIG, matchVoiceCommand } from "../services/voiceConfig.js";
import {
  selectBestVoice,
  chunkSpeechText,
  classifyMicrophoneInput,
  checkMicrophoneHealth,
  isEchoTranscript,
  airaVoiceDebug,
} from "../services/voiceService.js";

let globalRecognitionInstanceCount = 0;

/**
 * Enterprise-Grade Voice & Conversation Lifecycle Hook for AIRA
 *
 * Provides:
 * - Authoritative SpeechRecognition lifecycle manager with mutex lock and watchdog
 * - Full Web Speech API event handling (onstart, onaudiostart, onspeechstart, onresult,
 *   onspeechend, onsoundend, onaudioend, onerror, onend)
 * - Multi-layer acoustic echo suppression with trailing post-TTS immunity window
 * - Instant, sensitive mid-speech user voice interruption and command matching
 * - Exponential backoff retry for network/temporary recognition drops
 * - Pre-flight microphone permission and health validation
 * - Stale session ID protection for sentence-level TTS chunking
 * - Deterministic conversation state machine: idle | listening | thinking | speaking | interrupted | error
 *
 * LIFECYCLE:
 *   IDLE â†’ LISTENING (user starts voice mode)
 *   LISTENING â†’ THINKING (user finishes speaking, final transcript received)
 *   THINKING â†’ SPEAKING (AIRA generates and speaks response)
 *   SPEAKING â†’ LISTENING (TTS finishes, auto-resume mic)
 *
 * CRITICAL: Recognition remains active during AIRA TTS so the user can interrupt.
 * Echo suppression (classifyMicrophoneInput) prevents AIRA from hearing herself.
 */
export function useVoice(onUserSpeak, onInterrupt) {
  // Authoritative conversation state exposed to React UI
  const [state, setState] = useState("idle"); // idle | listening | thinking | speaking | interrupted | error
  const [thinkingMessage, setThinkingMessage] = useState("");
  const [speakingRate, setSpeakingRate] = useState(VOICE_CONFIG.rates.default);

  // Synchronous Authoritative Lifecycle State Ref (avoids stale closures and async setState delay)
  const voiceLifecycleStateRef = useRef("idle");
  const isUnmountedRef = useRef(false);

  // Authoritative State Transitioner
  const transitionState = useCallback((nextState, message = "") => {
    const prevState = voiceLifecycleStateRef.current;
    voiceLifecycleStateRef.current = nextState;
    airaVoiceDebug("5. transitionState() result", { from: prevState, to: nextState, message });
    setState(nextState);
    if (message !== undefined) {
      setThinkingMessage(message);
    }
  }, []);

  // References & Mutexes
  const recognitionRef = useRef(null);
  const recognitionInstanceIdRef = useRef(0);
  const synthRef = useRef(typeof window !== "undefined" ? window.speechSynthesis : null);

  // Authoritative Lifecycle Flags
  const isRecognitionRunningRef = useRef(false);
  const isStartingRef = useRef(false);
  const shouldBeListeningRef = useRef(false);
  const pausedByUserRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const restartAttemptsRef = useRef(0);
  const restartTimerRef = useRef(null);
  const lastBackoffDelayRef = useRef(0);
  const watchdogTimerRef = useRef(null);
  const lastAudioEventTimeRef = useRef(Date.now());
  const isSpeechUnlocked = useRef(false);
  const activeVoiceRef = useRef(null);

  // Speech Session IDs â€” increment to invalidate old TTS sessions only
  // NOTE: Recognition does NOT use a session ID for onstart gating.
  // The intentionalStopRef + shouldBeListeningRef + isSpeakingRef flags
  // provide authoritative restart control without stale-session false-positives.
  const currentSpeechSessionId = useRef(0);

  // Active Speech & Echo Tracking
  const activeSpeechChunkRef = useRef("");
  const recentSpokenChunksRef = useRef([]);
  const chunkStartTimeRef = useRef(0);
  const lastSpokenTextRef = useRef("");
  const isSpeakingRef = useRef(false);
  const ttsFinishedTimestampRef = useRef(0);
  const clearMicBufferRef = useRef(null);

  // Callback refs to avoid stale closures
  const onUserSpeakRef = useRef(onUserSpeak);
  const onInterruptRef = useRef(onInterrupt);

  useEffect(() => {
    onUserSpeakRef.current = onUserSpeak;
  }, [onUserSpeak]);

  useEffect(() => {
    onInterruptRef.current = onInterrupt;
  }, [onInterrupt]);

  const lastSubmittedVoiceTranscriptRef = useRef({ text: "", timestamp: 0 });

  // Voice Loading and Selection
  const loadVoices = useCallback(() => {
    if (!synthRef.current) return;
    const available = synthRef.current.getVoices();
    if (available && available.length > 0) {
      activeVoiceRef.current = selectBestVoice(available);
    }
  }, []);

  useEffect(() => {
    if (!synthRef.current) return;
    loadVoices();
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }
  }, [loadVoices]);

  // Unlock Web Audio/SpeechSynthesis on first user interaction
  const unlock = useCallback(() => {
    if (!isSpeechUnlocked.current && synthRef.current) {
      try {
        const u = new SpeechSynthesisUtterance("");
        synthRef.current.speak(u);
        isSpeechUnlocked.current = true;
        console.log("[AIRA Voice] Speech system unlocked");
      } catch (err) {
        console.warn("[AIRA Voice] Unlock failed:", err);
      }
    }
  }, []);

  // Stop active speech synthesis and flush chunk queue
  const cancelActiveSpeech = useCallback(() => {
    currentSpeechSessionId.current += 1; // Invalidate active speech chunk queue
    activeSpeechChunkRef.current = "";
    isSpeakingRef.current = false;
    if (clearMicBufferRef.current) {
      clearMicBufferRef.current();
    }
    if (synthRef.current) {
      try {
        synthRef.current.cancel();
      } catch (_) {}
    }
  }, []);

  const startRecognitionRef = useRef(null);
  const scheduleRestartRef = useRef(null);

  // Centralized, Mutex-Protected SpeechRecognition Start
  // Guards:
  //   - component not unmounted
  //   - shouldBeListening is true (user-enabled voice mode)
  //   - not manually paused
  //   - not already running or starting
  //   NOTE: Does NOT block during isSpeaking â€” recognition runs during TTS
  //   so the user can interrupt AIRA. Echo suppression handles self-listening.
  const startRecognition = useCallback(() => {
    airaVoiceDebug("6. startRecognition() called");
    const guardValues = {
      hasRecognition: !!recognitionRef.current,
      isUnmounted: isUnmountedRef.current,
      shouldBeListening: shouldBeListeningRef.current,
      pausedByUser: pausedByUserRef.current,
      isRecognitionRunning: isRecognitionRunningRef.current,
      isStarting: isStartingRef.current,
      lifecycleState: voiceLifecycleStateRef.current,
      isSpeaking: isSpeakingRef.current,
    };
    airaVoiceDebug("7. startRecognition guards", guardValues);

    if (!recognitionRef.current) {
      airaVoiceDebug("START BLOCKED", { reason: "no recognitionRef.current", ...guardValues });
      return;
    }
    if (isUnmountedRef.current) {
      airaVoiceDebug("START BLOCKED", { reason: "isUnmountedRef is true", ...guardValues });
      return;
    }
    if (!shouldBeListeningRef.current) {
      airaVoiceDebug("START BLOCKED", { reason: "shouldBeListeningRef is false", ...guardValues });
      return;
    }
    if (pausedByUserRef.current) {
      airaVoiceDebug("START BLOCKED", { reason: "pausedByUserRef is true", ...guardValues });
      return;
    }
    if (isRecognitionRunningRef.current) {
      airaVoiceDebug("START BLOCKED", { reason: "isRecognitionRunningRef is true", ...guardValues });
      return;
    }
    if (isStartingRef.current) {
      airaVoiceDebug("START BLOCKED", { reason: "isStartingRef is true", ...guardValues });
      return;
    }

    try {
      isStartingRef.current = true;
      intentionalStopRef.current = false;
      airaVoiceDebug("8. recognition.start() attempted", {
        instanceId: recognitionInstanceIdRef.current,
        continuous: recognitionRef.current.continuous,
        interimResults: recognitionRef.current.interimResults,
        lang: recognitionRef.current.lang,
      });
      recognitionRef.current.start();
    } catch (err) {
      isStartingRef.current = false;
      if (err.name === "InvalidStateError") {
        airaVoiceDebug("8. recognition.start() threw InvalidStateError (already running)", { name: err.name });
        // Recognition engine is transitioning or already active in browser.
        isRecognitionRunningRef.current = true;
      } else {
        airaVoiceDebug("8. recognition.start() threw error", { name: err.name, message: err.message });
        console.warn("[AIRA Voice] recognition.start error:", err);
      }
    }
  }, []);

  // Centralized SpeechRecognition Stop
  const stopRecognition = useCallback((intentional = true, reason = "unspecified") => {
    airaVoiceDebug("16. stopRecognition() + exact reason", {
      intentional,
      reason,
      lifecycleState: voiceLifecycleStateRef.current,
      isRecognitionRunning: isRecognitionRunningRef.current
    });
    intentionalStopRef.current = intentional;
    isStartingRef.current = false;

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.abort();
    } catch (_) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
  }, []);

  // Restart scheduler with exponential backoff.
  // Conditions are checked at the time of execution (not scheduling time).
  const scheduleRestart = useCallback((delayMs = 0, caller = "unspecified") => {
    airaVoiceDebug("13. scheduleRestart() called", {
      delayMs,
      caller,
      shouldBeListening: shouldBeListeningRef.current,
      pausedByUser: pausedByUserRef.current,
      isUnmounted: isUnmountedRef.current,
      hasTimer: !!restartTimerRef.current
    });

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    // Basic pre-check: don't schedule if clearly not needed
    if (isUnmountedRef.current) {
      airaVoiceDebug("15. restart blocked + exact reason", { reason: "isUnmountedRef is true" });
      return;
    }
    if (!shouldBeListeningRef.current) {
      airaVoiceDebug("15. restart blocked + exact reason", { reason: "shouldBeListeningRef is false" });
      return;
    }
    if (pausedByUserRef.current) {
      airaVoiceDebug("15. restart blocked + exact reason", { reason: "pausedByUserRef is true" });
      return;
    }

    const backoff =
      delayMs > 0
        ? delayMs
        : lastBackoffDelayRef.current > 0
        ? lastBackoffDelayRef.current
        : Math.min(100 * Math.pow(1.8, restartAttemptsRef.current), 3000);

    lastBackoffDelayRef.current = 0;

    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      airaVoiceDebug("14. restart actually executed (timer fired)", { backoff });
      if (startRecognitionRef.current) startRecognitionRef.current();
    }, backoff);
  }, []);

  startRecognitionRef.current = startRecognition;
  scheduleRestartRef.current = scheduleRestart;

  // Initialize Authoritative Speech Recognition Lifecycle
  useEffect(() => {
    isUnmountedRef.current = false;

    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      console.warn("[AIRA Voice] SpeechRecognition is not supported in this browser.");
      transitionState("error", "Speech recognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    const recognitionInstanceId = ++globalRecognitionInstanceCount;
    recognitionInstanceIdRef.current = recognitionInstanceId;
    airaVoiceDebug("10. RECOGNITION OBJECT CREATED", {
      recognitionInstanceId,
      continuous: recognition.continuous,
      interimResults: recognition.interimResults,
      lang: recognition.lang
    });

    let accumulatedTranscript = "";
    let interimDebounceTimer = null;

    clearMicBufferRef.current = () => {
      if (interimDebounceTimer) {
        clearTimeout(interimDebounceTimer);
        interimDebounceTimer = null;
      }
      accumulatedTranscript = "";
    };

    const finalizeTranscript = (transcriptText) => {
      clearTimeout(interimDebounceTimer);
      interimDebounceTimer = null;
      const cleaned = transcriptText.trim();
      accumulatedTranscript = "";

      airaVoiceDebug("17. finalizeTranscript()", { transcriptText, cleaned });

      if (!cleaned) return;

      // Stop recognition before triggering AI.
      // intentionalStopRef=true tells onend NOT to restart (CASE A).
      stopRecognition(true, "finalizeTranscript");

      const now = Date.now();
      const normCleaned = cleaned
        .toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "")
        .replace(/\s+/g, " ");
      const normLast = (lastSubmittedVoiceTranscriptRef.current?.text || "")
        .toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "")
        .replace(/\s+/g, " ");

      if (
        normCleaned &&
        normCleaned === normLast &&
        now - lastSubmittedVoiceTranscriptRef.current.timestamp <
          (VOICE_CONFIG.delays.duplicateTurnWindowMs || 1500)
      ) {
        console.log("[AIRA Voice] Suppressed duplicate voice transcript:", cleaned);
        if (shouldBeListeningRef.current && !pausedByUserRef.current) {
          transitionState("listening");
          scheduleRestart(100, "duplicateTranscriptRecovery");
        }
        return;
      }
      lastSubmittedVoiceTranscriptRef.current = { text: cleaned, timestamp: now };

      // Standalone Voice Commands Processing
      const matchedCommand = matchVoiceCommand(cleaned);

      if (matchedCommand) {
        console.log(`[AIRA Voice] Voice Command Executed: ${matchedCommand}`);

        if (matchedCommand === "STOP" || matchedCommand === "WAIT") {
          cancelActiveSpeech();
          if (onInterruptRef.current) onInterruptRef.current();
          transitionState("listening");
          scheduleRestart(100, "voiceCommandStopWait");
          return;
        }

        if (matchedCommand === "REPEAT") {
          if (lastSpokenTextRef.current) {
            cancelActiveSpeech();
            speak(lastSpokenTextRef.current);
          }
          return;
        }

        if (matchedCommand === "SLOWER") {
          setSpeakingRate((prev) => {
            const next = Math.max(
              VOICE_CONFIG.rates.min,
              Number((prev - VOICE_CONFIG.rates.step).toFixed(2))
            );
            return next;
          });
          speak("I'll speak a bit slower.");
          return;
        }

        if (matchedCommand === "FASTER") {
          setSpeakingRate((prev) => {
            const next = Math.min(
              VOICE_CONFIG.rates.max,
              Number((prev + VOICE_CONFIG.rates.step).toFixed(2))
            );
            return next;
          });
          speak("I'll speak a bit faster.");
          return;
        }

        if (matchedCommand === "STOP_INTERVIEW") {
          cancelActiveSpeech();
          if (onInterruptRef.current) onInterruptRef.current();
          transitionState("thinking");
          if (onUserSpeakRef.current) onUserSpeakRef.current("stop the interview");
          return;
        }

        if (matchedCommand === "SHORTER") {
          cancelActiveSpeech();
          if (onInterruptRef.current) onInterruptRef.current();
          transitionState("thinking");
          if (onUserSpeakRef.current)
            onUserSpeakRef.current(
              "Please make your previous answer much shorter and concise."
            );
          return;
        }

        if (matchedCommand === "DEEPER") {
          cancelActiveSpeech();
          if (onInterruptRef.current) onInterruptRef.current();
          transitionState("thinking");
          if (onUserSpeakRef.current)
            onUserSpeakRef.current("Please explain that in more detail and go deeper.");
          return;
        }
      }

      // Filter noise / single-character clicks
      if (
        cleaned.length < VOICE_CONFIG.noiseFilter.minNonCommandLength ||
        VOICE_CONFIG.noiseFilter.ignoredFragments.includes(cleaned.toLowerCase())
      ) {
        if (shouldBeListeningRef.current && !pausedByUserRef.current) {
          transitionState("listening");
          scheduleRestart(100, "noiseFilterRestart");
        }
        return;
      }

      // Transition to Thinking (PROCESSING) & trigger AI Request
      transitionState("thinking");

      if (onUserSpeakRef.current) {
        onUserSpeakRef.current(cleaned);
      }
    };

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // RECOGNITION EVENT HANDLERS
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    recognition.onstart = () => {
      airaVoiceDebug("9. recognition.onstart fired", {
        instanceId: recognitionInstanceId,
        currentState: voiceLifecycleStateRef.current
      });
      isRecognitionRunningRef.current = true;
      isStartingRef.current = false;
      restartAttemptsRef.current = 0;
      lastAudioEventTimeRef.current = Date.now();
      // Transition to listening only when not already in a more advanced state
      if (
        voiceLifecycleStateRef.current !== "thinking" &&
        voiceLifecycleStateRef.current !== "speaking" &&
        voiceLifecycleStateRef.current !== "stopping"
      ) {
        transitionState("listening");
      }
    };

    recognition.onaudiostart = () => {
      lastAudioEventTimeRef.current = Date.now();
    };

    recognition.onsoundstart = () => {
      lastAudioEventTimeRef.current = Date.now();
    };

    recognition.onspeechstart = () => {
      lastAudioEventTimeRef.current = Date.now();
    };

    recognition.onresult = (event) => {
      lastAudioEventTimeRef.current = Date.now();
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript + " ";
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      const heardWords = (interimTranscript + " " + finalTranscript).trim();
      airaVoiceDebug("10. recognition.onresult fired", {
        resultIndex: event.resultIndex,
        resultsLength: event.results.length,
        heardWords,
        finalTranscript: finalTranscript.trim(),
        interimTranscript: interimTranscript.trim(),
        isSpeaking: isSpeakingRef.current,
        state: voiceLifecycleStateRef.current
      });
      if (!heardWords) return;

      // â”€â”€ CASE: AIRA is actively speaking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Recognition runs during TTS for interruption support.
      // classifyMicrophoneInput distinguishes genuine user speech from acoustic echo.
      if (isSpeakingRef.current || (synthRef.current && synthRef.current.speaking)) {
        const elapsed = Date.now() - chunkStartTimeRef.current;
        const classification = classifyMicrophoneInput({
          heardText: heardWords,
          activeSpokenChunk: activeSpeechChunkRef.current,
          recentSpokenChunks: recentSpokenChunksRef.current,
          lastSpokenText: lastSpokenTextRef.current,
          isSpeaking: true,
          elapsedSinceChunkStartMs: elapsed,
        });

        if (classification.isEcho) {
          airaVoiceDebug("10. onresult classified as echo", { heardWords });
          return; // Discard AIRA's own voice picked up by the microphone
        }

        if (classification.isInterruption) {
          // User genuinely interrupted â€” cancel TTS and process the utterance
          airaVoiceDebug("10. onresult classified as interruption", { heardWords });
          cancelActiveSpeech();
          if (onInterruptRef.current) onInterruptRef.current();
          transitionState("interrupted");
          // Fall through: let the result be accumulated and finalized below
        }
      }

      // â”€â”€ CASE: Post-TTS trailing echo window â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Suppress acoustic echoes from reverb/speakers right after AIRA finishes.
      const isWithinTrailingEchoWindow =
        Date.now() - ttsFinishedTimestampRef.current <
        (VOICE_CONFIG.delays.trailingEchoImmunityMs || 1500);
      if (isWithinTrailingEchoWindow && lastSpokenTextRef.current) {
        const isTrailingEcho = isEchoTranscript(
          heardWords,
          lastSpokenTextRef.current,
          recentSpokenChunksRef.current
        );
        if (isTrailingEcho) {
          airaVoiceDebug("10. onresult suppressed trailing TTS acoustic echo", { heardWords });
          console.log("[AIRA Voice] Suppressed trailing TTS acoustic echo:", heardWords);
          return;
        }
      }

      // â”€â”€ Accumulate transcript & start grace-period timer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (finalTranscript.trim()) {
        accumulatedTranscript += finalTranscript;
      }

      clearTimeout(interimDebounceTimer);
      const textToEvaluate = (accumulatedTranscript + " " + interimTranscript).trim();

      if (textToEvaluate) {
        const isCommand = matchVoiceCommand(textToEvaluate);
        const graceTime = isCommand
          ? 180
          : finalTranscript.trim()
          ? VOICE_CONFIG.silence.finalGraceMs
          : VOICE_CONFIG.silence.interimGraceMs;

        interimDebounceTimer = setTimeout(() => {
          finalizeTranscript(textToEvaluate);
        }, graceTime);
      }
    };

    recognition.onspeechend = () => {
      lastAudioEventTimeRef.current = Date.now();
    };

    recognition.onsoundend = () => {
      lastAudioEventTimeRef.current = Date.now();
    };

    recognition.onaudioend = () => {
      lastAudioEventTimeRef.current = Date.now();
    };

    recognition.onerror = (e) => {
      isStartingRef.current = false;
      const errType = e.error;
      airaVoiceDebug("11. recognition.onerror", {
        error: errType,
        message: e.message,
        isRecognitionRunning: isRecognitionRunningRef.current,
        state: voiceLifecycleStateRef.current
      });

      // Normal silence timeout in Chrome/Android â€” let onend handle graceful restart
      if (errType === "no-speech" || errType === "aborted") {
        return;
      }

      console.warn(`[AIRA Voice] Recognition error: ${errType}`);

      if (
        errType === "not-allowed" ||
        errType === "service-not-allowed" ||
        errType === "audio-capture"
      ) {
        isRecognitionRunningRef.current = false;
        shouldBeListeningRef.current = false;
        transitionState("error", "Microphone access error");
        return;
      }

      if (errType === "network") {
        restartAttemptsRef.current += 1;
        lastBackoffDelayRef.current = VOICE_CONFIG.delays.networkBackoffMs || 1000;
        scheduleRestart(lastBackoffDelayRef.current, "networkError");
        return;
      }
    };

    /**
     * recognition.onend â€” Handle all cases explicitly:
     *
     * CASE A: Recognition ended because user submitted a final message.
     *   intentionalStopRef = true â†’ do NOT restart. Processing/TTS takes over.
     *
     * CASE B: Recognition ended unexpectedly while voice mode is active & AIRA NOT speaking.
     *   â†’ Restart safely with backoff.
     *
     * CASE C: Recognition ended because AIRA is speaking (TTS guard).
     *   isSpeakingRef = true â†’ do NOT restart here.
     *   TTS finalizeTtsCompletion will restart after speech ends.
     *
     * CASE D: Voice mode was manually disabled.
     *   shouldBeListeningRef = false â†’ do NOT restart.
     *
     * CASE E: Component was unmounted.
     *   isUnmountedRef = true â†’ do NOT restart.
     *
     * CASE F: System is thinking (not ready to listen yet).
     *   voiceLifecycleStateRef = "thinking" â†’ do NOT restart.
     *   speak() will restart recognition when TTS begins.
     */
    recognition.onend = () => {
      airaVoiceDebug("12. recognition.onend", {
        instanceId: recognitionInstanceId,
        isRecognitionRunning: isRecognitionRunningRef.current,
        intentionalStop: intentionalStopRef.current,
        shouldBeListening: shouldBeListeningRef.current,
        pausedByUser: pausedByUserRef.current,
        isUnmounted: isUnmountedRef.current,
        state: voiceLifecycleStateRef.current,
        isSpeaking: isSpeakingRef.current
      });
      isRecognitionRunningRef.current = false;
      isStartingRef.current = false;

      // CASE D: Voice mode manually disabled
      if (!shouldBeListeningRef.current) return;

      // CASE E: Component unmounted
      if (isUnmountedRef.current) return;

      // CASE A: User submitted a final utterance â€” processing or speaking is now in charge
      if (intentionalStopRef.current) return;

      // CASE F: System is thinking or stopping â€” speak() will handle recognition resume
      if (
        voiceLifecycleStateRef.current === "thinking" ||
        voiceLifecycleStateRef.current === "stopping"
      ) {
        return;
      }

      // CASE C: AIRA is speaking â€” TTS finalization will restart recognition after speech
      if (isSpeakingRef.current || (synthRef.current && synthRef.current.speaking)) {
        return;
      }

      // CASE B: Unexpected end while user listening was active â€” recover
      if (!pausedByUserRef.current) {
        const delay = lastBackoffDelayRef.current > 0 ? lastBackoffDelayRef.current : 100;
        lastBackoffDelayRef.current = 0;
        scheduleRestart(delay, "unexpectedEnd");
      }
    };

    recognitionRef.current = recognition;

    // Watchdog Timer: Periodically verifies recognition is alive when it should be.
    // Uses individual flag checks (not a single canStartRecognition) so the watchdog
    // correctly restarts recognition during TTS (for interruption support).
    watchdogTimerRef.current = setInterval(() => {
      airaVoiceDebug("WATCHDOG", {
        running: isRecognitionRunningRef.current,
        starting: isStartingRef.current,
        shouldBeListening: shouldBeListeningRef.current,
        paused: pausedByUserRef.current,
        lifecycleState: voiceLifecycleStateRef.current,
        speaking: isSpeakingRef.current,
        restartTimerExists: !!restartTimerRef.current
      });
      if (
        shouldBeListeningRef.current &&
        !pausedByUserRef.current &&
        !isUnmountedRef.current &&
        !isRecognitionRunningRef.current &&
        !isStartingRef.current &&
        voiceLifecycleStateRef.current !== "thinking" &&
        voiceLifecycleStateRef.current !== "stopping"
      ) {
        if (!restartTimerRef.current) {
          if (scheduleRestartRef.current) scheduleRestartRef.current(150, "watchdog");
        }
      }
    }, 2000);

    return () => {
      isUnmountedRef.current = true;
      shouldBeListeningRef.current = false;
      isRecognitionRunningRef.current = false;
      isStartingRef.current = false;
      currentSpeechSessionId.current += 1;
      clearMicBufferRef.current = null;
      clearTimeout(interimDebounceTimer);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);

      try {
        recognition.abort();
      } catch (_) {
        try {
          recognition.stop();
        } catch (_) {}
      }
      if (synthRef.current) {
        try {
          synthRef.current.cancel();
        } catch (_) {}
      }
    };
  }, [cancelActiveSpeech, scheduleRestart, startRecognition, stopRecognition, transitionState]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // USER ACTIONS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const startListening = useCallback(
    async () => {
      airaVoiceDebug("1. startListening() called", {
        shouldBeListening: shouldBeListeningRef.current,
        pausedByUser: pausedByUserRef.current,
        state: voiceLifecycleStateRef.current
      });
      pausedByUserRef.current = false;
      shouldBeListeningRef.current = true;
      intentionalStopRef.current = false;
      restartAttemptsRef.current = 0;

      // Pre-flight check
      const health = await checkMicrophoneHealth();
      if (!health.available && health.error === "NotAllowedError") {
        transitionState("error", "Microphone access denied");
        return;
      }

      // Note: transitionState("listening") is deliberately NOT called here.
      // It is called strictly inside recognition.onstart when the browser
      // confirms audio capture has actually begun, preventing false "LISTENING..." UI.
      startRecognition();
    },
    [transitionState, startRecognition]
  );

  const stopListening = useCallback(() => {
    airaVoiceDebug("stopListening() called");
    shouldBeListeningRef.current = false;
    pausedByUserRef.current = true;
    intentionalStopRef.current = true;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    transitionState("idle");
    stopRecognition(true, "stopListening");
  }, [stopRecognition, transitionState]);

  /**
   * toggleOrb â€” User interaction with VoiceOrb
   */
  const toggleOrb = useCallback(() => {
    unlock();

    // If AIRA is speaking, user clicking orb interrupts AIRA
    if (
      isSpeakingRef.current ||
      (synthRef.current && (synthRef.current.speaking || synthRef.current.pending))
    ) {
      cancelActiveSpeech();
      if (onInterruptRef.current) onInterruptRef.current();
      transitionState("interrupted");
      setTimeout(() => {
        if (!pausedByUserRef.current && !isUnmountedRef.current) {
          startListening();
        }
      }, 100);
      return;
    }

    if (shouldBeListeningRef.current && !pausedByUserRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [unlock, cancelActiveSpeech, transitionState, startListening, stopListening]);

  /**
   * speak â€” Speak response using sentence-level chunking.
   *
   * CRITICAL DESIGN (restored from pre-regression behavior):
   * - Recognition remains running during TTS so the user can interrupt AIRA.
   * - isSpeakingRef=true is set BEFORE speak() so the echo guard (classifyMicrophoneInput)
   *   in onresult is active from the very first moment of TTS.
   * - We do NOT call stopRecognition() before TTS starts. The echo guard handles
   *   self-listening suppression while TTS is active.
   * - After TTS finishes, finalizeTtsCompletion restarts recognition cleanly.
   */
  const speak = useCallback(
    (text, onEnd) => {
      if (!text || !synthRef.current) {
        if (onEnd) onEnd();
        return;
      }

      unlock();
      cancelActiveSpeech();

      // Set SPEAKING state BEFORE TTS starts so echo guard activates immediately
      isSpeakingRef.current = true;
      transitionState("speaking");

      // Store in history for echo matching & "repeat that" command
      lastSpokenTextRef.current = text;
      recentSpokenChunksRef.current = [];

      // Split text into natural sentence chunks
      const chunks = chunkSpeechText(text);
      if (chunks.length === 0) {
        isSpeakingRef.current = false;
        transitionState("idle");
        if (onEnd) onEnd();
        return;
      }

      const speechSessionId = ++currentSpeechSessionId.current;
      let currentChunkIndex = 0;

      // Recognition stays running during TTS for interruption support.
      // If recognition died during the thinking phase, restart it now.
      if (
        shouldBeListeningRef.current &&
        !pausedByUserRef.current &&
        !isRecognitionRunningRef.current &&
        !isStartingRef.current
      ) {
        startRecognition();
      }

      const finalizeTtsCompletion = () => {
        if (speechSessionId !== currentSpeechSessionId.current) return;
        ttsFinishedTimestampRef.current = Date.now();
        isSpeakingRef.current = false;
        activeSpeechChunkRef.current = "";

        // Clear accumulated microphone buffer captured while AIRA spoke
        if (clearMicBufferRef.current) {
          clearMicBufferRef.current();
        }

        if (onEnd) onEnd();

        // Auto-resume listening cleanly only if voice mode is still enabled
        if (
          !pausedByUserRef.current &&
          shouldBeListeningRef.current &&
          !isUnmountedRef.current
        ) {
          transitionState("listening");
          scheduleRestart(VOICE_CONFIG.delays.postSpeakListenDelayMs || 200);
        } else {
          transitionState("idle");
        }
      };

      const playNextChunk = () => {
        // If user interrupted or another speech session started, stop immediately
        if (speechSessionId !== currentSpeechSessionId.current) {
          isSpeakingRef.current = false;
          return;
        }

        if (currentChunkIndex >= chunks.length) {
          // Verify speech synthesis engine actually finished draining its audio buffer
          if (synthRef.current && synthRef.current.speaking) {
            const checkSpeakingDone = setInterval(() => {
              if (
                !synthRef.current ||
                !synthRef.current.speaking ||
                speechSessionId !== currentSpeechSessionId.current
              ) {
                clearInterval(checkSpeakingDone);
                finalizeTtsCompletion();
              }
            }, 40);
            setTimeout(() => {
              clearInterval(checkSpeakingDone);
              finalizeTtsCompletion();
            }, 800);
          } else {
            finalizeTtsCompletion();
          }
          return;
        }

        const chunkText = chunks[currentChunkIndex];
        currentChunkIndex++;

        activeSpeechChunkRef.current = chunkText;
        recentSpokenChunksRef.current = [
          ...recentSpokenChunksRef.current.slice(-5),
          chunkText,
        ];
        chunkStartTimeRef.current = Date.now();

        const utterance = new SpeechSynthesisUtterance(chunkText);
        const voice =
          activeVoiceRef.current || selectBestVoice(synthRef.current.getVoices());
        if (voice) utterance.voice = voice;

        utterance.rate = speakingRate;
        utterance.pitch = VOICE_CONFIG.pitch.default;
        utterance.volume = VOICE_CONFIG.volume.default;

        utterance.onstart = () => {
          if (speechSessionId === currentSpeechSessionId.current) {
            isSpeakingRef.current = true;
            transitionState("speaking");
          }
        };

        utterance.onend = () => {
          if (speechSessionId === currentSpeechSessionId.current) {
            playNextChunk();
          }
        };

        utterance.onerror = (e) => {
          if (e.error === "interrupted" || e.error === "canceled") return;
          console.warn("[AIRA Voice] Speech chunk error:", e.error);

          if (speechSessionId === currentSpeechSessionId.current) {
            playNextChunk();
          }
        };

        try {
          synthRef.current.speak(utterance);
        } catch (err) {
          console.warn("[AIRA Voice] Speak call failed:", err);
          isSpeakingRef.current = false;
          transitionState("idle");
          if (!pausedByUserRef.current && shouldBeListeningRef.current) {
            startListening();
          }
        }
      };

      // Play first chunk immediately (or after preSpeakMs if configured > 0)
      if (VOICE_CONFIG.delays.preSpeakMs > 0) {
        setTimeout(() => {
          if (speechSessionId === currentSpeechSessionId.current) {
            playNextChunk();
          }
        }, VOICE_CONFIG.delays.preSpeakMs);
      } else {
        playNextChunk();
      }
    },
    [
      unlock,
      cancelActiveSpeech,
      transitionState,
      speakingRate,
      scheduleRestart,
      startRecognition,
      startListening,
    ]
  );

  const setThinking = useCallback(
    (message = "") => {
      cancelActiveSpeech();
      transitionState("thinking", message);
    },
    [cancelActiveSpeech, transitionState]
  );

  const setErrorMessage = useCallback(
    (msg = "") => {
      cancelActiveSpeech();
      transitionState("error", msg);
    },
    [cancelActiveSpeech, transitionState]
  );

  return {
    state,
    thinkingMessage,
    speakingRate,
    setSpeakingRate,
    startListening,
    stopListening,
    toggleOrb,
    speak,
    setThinking,
    setErrorMessage,
    unlock,
    cancelActiveSpeech,
  };
}
