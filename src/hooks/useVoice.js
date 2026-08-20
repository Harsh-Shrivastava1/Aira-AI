import { useState, useEffect, useRef, useCallback } from "react";
import { VOICE_CONFIG, matchVoiceCommand } from "../services/voiceConfig.js";
import {
  selectBestVoice,
  chunkSpeechText,
  classifyMicrophoneInput,
  checkMicrophoneHealth,
} from "../services/voiceService.js";

/**
 * Enterprise-Grade Voice & Conversation Lifecycle Hook for AIRA
 * 
 * Provides:
 * - Authoritative SpeechRecognition lifecycle manager with mutex lock and watchdog
 * - Full Web Speech API event handling (onstart, onaudiostart, onspeechstart, onresult, onspeechend, onsoundend, onaudioend, onerror, onend)
 * - Multi-layer acoustic echo suppression to prevent AIRA from self-triggering on her own speaker output
 * - Instant, sensitive mid-speech user voice interruption and command matching
 * - Exponential backoff retry for network/temporary recognition drops
 * - Pre-flight microphone permission and health validation
 * - Stale session ID protection for sentence-level TTS chunking
 * - Deterministic conversation state machine: idle | listening | thinking | speaking | interrupted | error
 */
export function useVoice(onUserSpeak, onInterrupt) {
  // Authoritative conversation state
  const [state, setState] = useState("idle"); // idle | listening | thinking | speaking | interrupted | error
  const [thinkingMessage, setThinkingMessage] = useState("");
  const [speakingRate, setSpeakingRate] = useState(VOICE_CONFIG.rates.default);

  // References & Mutexes
  const recognitionRef = useRef(null);
  const synthRef = useRef(typeof window !== "undefined" ? window.speechSynthesis : null);
  
  // Authoritative Lifecycle Flags
  const isRecognitionRunningRef = useRef(false);
  const isStartingRef = useRef(false);
  const shouldBeListeningRef = useRef(false);
  const pausedByUserRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const restartAttemptsRef = useRef(0);
  const restartTimerRef = useRef(null);
  const watchdogTimerRef = useRef(null);
  const lastAudioEventTimeRef = useRef(Date.now());
  const isSpeechUnlocked = useRef(false);
  const activeVoiceRef = useRef(null);

  // Active Speech & Echo Tracking
  const currentSpeechSessionId = useRef(0);
  const activeSpeechChunkRef = useRef("");
  const chunkStartTimeRef = useRef(0);
  const lastSpokenTextRef = useRef("");
  const isSpeakingRef = useRef(false);

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
    if (synthRef.current) {
      try {
        synthRef.current.cancel();
      } catch (_) {}
    }
  }, []);

  const startRecognitionRef = useRef(null);
  const scheduleRestartRef = useRef(null);

  // Controlled, Mutex-Protected SpeechRecognition Start
  const startRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isRecognitionRunningRef.current || isStartingRef.current) {
      return;
    }

    try {
      isStartingRef.current = true;
      intentionalStopRef.current = false;
      recognitionRef.current.start();
    } catch (err) {
      isStartingRef.current = false;
      if (err.name === "InvalidStateError") {
        // Recognition engine is transitioning or already active in browser.
        // Never fabricate state; defer to onstart/onend for real confirmation and schedule retry if needed.
        if (shouldBeListeningRef.current && !pausedByUserRef.current && !restartTimerRef.current) {
          if (scheduleRestartRef.current) scheduleRestartRef.current(150);
        }
      } else {
        console.warn("[AIRA Voice] recognition.start error:", err);
      }
    }
  }, []);

  // Controlled SpeechRecognition Stop
  const stopRecognition = useCallback((intentional = true) => {
    if (!recognitionRef.current) return;
    intentionalStopRef.current = intentional;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    try {
      recognitionRef.current.stop();
    } catch (_) {}
  }, []);

  // Exponential Backoff Controlled Restart Scheduler
  const scheduleRestart = useCallback((delayMs = 0) => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (!shouldBeListeningRef.current || pausedByUserRef.current) {
      return;
    }

    const backoff = delayMs > 0 ? delayMs : Math.min(100 * Math.pow(1.8, restartAttemptsRef.current), 3000);

    restartTimerRef.current = setTimeout(() => {
      if (shouldBeListeningRef.current && !pausedByUserRef.current && !isRecognitionRunningRef.current) {
        if (startRecognitionRef.current) startRecognitionRef.current();
      }
    }, backoff);
  }, []);

  startRecognitionRef.current = startRecognition;
  scheduleRestartRef.current = scheduleRestart;

  // Initialize Authoritative Speech Recognition Lifecycle
  useEffect(() => {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      console.warn("[AIRA Voice] SpeechRecognition is not supported in this browser.");
      setState("error");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    let accumulatedTranscript = "";
    let interimDebounceTimer = null;

    const finalizeTranscript = (transcriptText) => {
      clearTimeout(interimDebounceTimer);
      const cleaned = transcriptText.trim();
      accumulatedTranscript = "";

      if (!cleaned) return;

      const now = Date.now();
      if (
        lastSubmittedVoiceTranscriptRef.current &&
        cleaned.toLowerCase() === lastSubmittedVoiceTranscriptRef.current.text.toLowerCase() &&
        now - lastSubmittedVoiceTranscriptRef.current.timestamp < 1200
      ) {
        return;
      }
      lastSubmittedVoiceTranscriptRef.current = { text: cleaned, timestamp: now };

      // 1. Standalone Voice Commands Processing
      const matchedCommand = matchVoiceCommand(cleaned);

      if (matchedCommand) {
        console.log(`[AIRA Voice] Voice Command Executed: ${matchedCommand}`);

        if (matchedCommand === "STOP" || matchedCommand === "WAIT") {
          cancelActiveSpeech();
          if (onInterruptRef.current) onInterruptRef.current();
          setState("listening");
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
            const next = Math.max(VOICE_CONFIG.rates.min, Number((prev - VOICE_CONFIG.rates.step).toFixed(2)));
            return next;
          });
          speak("I'll speak a bit slower.");
          return;
        }

        if (matchedCommand === "FASTER") {
          setSpeakingRate((prev) => {
            const next = Math.min(VOICE_CONFIG.rates.max, Number((prev + VOICE_CONFIG.rates.step).toFixed(2)));
            return next;
          });
          speak("I'll speak a bit faster.");
          return;
        }

        if (matchedCommand === "STOP_INTERVIEW") {
          cancelActiveSpeech();
          if (onInterruptRef.current) onInterruptRef.current();
          setState("thinking");
          if (onUserSpeakRef.current) onUserSpeakRef.current("stop the interview");
          return;
        }

        if (matchedCommand === "SHORTER") {
          cancelActiveSpeech();
          if (onInterruptRef.current) onInterruptRef.current();
          setState("thinking");
          if (onUserSpeakRef.current) onUserSpeakRef.current("Please make your previous answer much shorter and concise.");
          return;
        }

        if (matchedCommand === "DEEPER") {
          cancelActiveSpeech();
          if (onInterruptRef.current) onInterruptRef.current();
          setState("thinking");
          if (onUserSpeakRef.current) onUserSpeakRef.current("Please explain that in more detail and go deeper.");
          return;
        }
      }

      // 2. Filter noise / single-character clicks
      if (
        cleaned.length < VOICE_CONFIG.noiseFilter.minNonCommandLength ||
        VOICE_CONFIG.noiseFilter.ignoredFragments.includes(cleaned.toLowerCase())
      ) {
        return;
      }

      // 3. User Speech Interruption Handling
      if (synthRef.current && synthRef.current.speaking) {
        console.log("[AIRA Voice] Interrupting active speech for user turn");
        cancelActiveSpeech();
        if (onInterruptRef.current) onInterruptRef.current();
      }

      // 4. Transition to Thinking & trigger AI Request
      setState("thinking");

      if (onUserSpeakRef.current) {
        onUserSpeakRef.current(cleaned);
      }
    };

    // Full Lifecycle Event Handlers
    recognition.onstart = () => {
      isRecognitionRunningRef.current = true;
      isStartingRef.current = false;
      restartAttemptsRef.current = 0;
      lastAudioEventTimeRef.current = Date.now();

      if (shouldBeListeningRef.current && !pausedByUserRef.current) {
        setState((prev) => (prev === "speaking" || prev === "thinking" ? prev : "listening"));
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

      // Multi-Layer Acoustic Echo & Interruption Evaluation
      if (isSpeakingRef.current || (synthRef.current && synthRef.current.speaking)) {
        const elapsed = Date.now() - chunkStartTimeRef.current;
        const classification = classifyMicrophoneInput({
          heardText: heardWords,
          activeSpokenChunk: activeSpeechChunkRef.current,
          lastSpokenText: lastSpokenTextRef.current,
          isSpeaking: true,
          elapsedSinceChunkStartMs: elapsed,
        });

        if (classification.isEcho) {
          // Suppress acoustic feedback from device speakers
          return;
        }

        if (classification.isInterruption) {
          console.log(`[AIRA Voice] User voice interruption detected (${classification.reason}):`, heardWords);
          cancelActiveSpeech();
          if (onInterruptRef.current) onInterruptRef.current();
          setState("interrupted");
        }
      }

      if (finalTranscript.trim()) {
        accumulatedTranscript += finalTranscript;
      }

      // Silence handling with grace periods
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

      // Normal silence timeout in Chrome/Edge — let onend handle graceful loop
      if (errType === "no-speech") {
        return;
      }

      if (errType === "aborted") {
        return;
      }

      console.warn(`[AIRA Voice] Recognition error: ${errType}`);

      if (errType === "not-allowed" || errType === "service-not-allowed") {
        isRecognitionRunningRef.current = false;
        shouldBeListeningRef.current = false;
        setState("error");
        return;
      }

      if (errType === "audio-capture") {
        isRecognitionRunningRef.current = false;
        shouldBeListeningRef.current = false;
        setState("error");
        return;
      }

      if (errType === "network") {
        restartAttemptsRef.current += 1;
        scheduleRestart(1000);
      }
    };

    recognition.onend = () => {
      isRecognitionRunningRef.current = false;
      isStartingRef.current = false;

      // If recognition stopped unexpectedly while listening should be active -> recover
      if (shouldBeListeningRef.current && !pausedByUserRef.current && !intentionalStopRef.current) {
        scheduleRestart(100);
      }
    };

    recognitionRef.current = recognition;

    // Watchdog Timer: Periodically verifies that recognition is alive when intended
    watchdogTimerRef.current = setInterval(() => {
      if (
        shouldBeListeningRef.current &&
        !pausedByUserRef.current &&
        !isRecognitionRunningRef.current &&
        !isStartingRef.current
      ) {
        if (!restartTimerRef.current) {
          scheduleRestart(150);
        }
      }
    }, 2000);

    return () => {
      shouldBeListeningRef.current = false;
      isRecognitionRunningRef.current = false;
      isStartingRef.current = false;
      clearTimeout(interimDebounceTimer);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);

      try {
        recognition.stop();
      } catch (_) {}
      if (synthRef.current) {
        try {
          synthRef.current.cancel();
        } catch (_) {}
      }
    };
  }, [cancelActiveSpeech, scheduleRestart, startRecognition]);

  // User Actions
  const startListening = useCallback(async () => {
    pausedByUserRef.current = false;
    shouldBeListeningRef.current = true;
    intentionalStopRef.current = false;
    restartAttemptsRef.current = 0;

    // Pre-flight check
    const health = await checkMicrophoneHealth();
    if (!health.available && health.error === "NotAllowedError") {
      setState("error");
      return;
    }

    setState("listening");
    startRecognition();
  }, [startRecognition]);

  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false;
    pausedByUserRef.current = true;
    intentionalStopRef.current = true;
    setState("idle");
    stopRecognition(true);
  }, [stopRecognition]);

  /**
   * toggleOrb — User interaction with VoiceOrb
   */
  const toggleOrb = useCallback(() => {
    unlock();

    if (isSpeakingRef.current || (synthRef.current && synthRef.current.speaking)) {
      cancelActiveSpeech();
      if (onInterruptRef.current) onInterruptRef.current();
      setState("interrupted");
      setTimeout(() => {
        startListening();
      }, 100);
      return;
    }

    if (shouldBeListeningRef.current && !pausedByUserRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [unlock, cancelActiveSpeech, startListening, stopListening]);

  /**
   * Speak response using sentence-level chunking and active chunk tracking
   */
  const speak = useCallback(
    (text, onEnd) => {
      if (!text || !synthRef.current) return;

      unlock();
      cancelActiveSpeech();

      // Store in history for "repeat that" command
      lastSpokenTextRef.current = text;

      // Split text into natural sentence chunks
      const chunks = chunkSpeechText(text);
      if (chunks.length === 0) {
        setState("idle");
        if (onEnd) onEnd();
        return;
      }

      setState("speaking");
      isSpeakingRef.current = true;
      const sessionId = ++currentSpeechSessionId.current;
      let currentChunkIndex = 0;

      // Keep recognition running so user can interrupt via voice
      if (shouldBeListeningRef.current && !isRecognitionRunningRef.current) {
        startRecognition();
      }

      const playNextChunk = () => {
        // If user interrupted or another speech session started, stop immediately
        if (sessionId !== currentSpeechSessionId.current) {
          isSpeakingRef.current = false;
          return;
        }

        if (currentChunkIndex >= chunks.length) {
          isSpeakingRef.current = false;
          activeSpeechChunkRef.current = "";
          setState("idle");
          if (onEnd) onEnd();

          // Auto-resume listening if not manually paused by user
          if (!pausedByUserRef.current && shouldBeListeningRef.current) {
            setTimeout(() => {
              if (sessionId === currentSpeechSessionId.current && !pausedByUserRef.current) {
                startListening();
              }
            }, VOICE_CONFIG.delays.postSpeakListenDelayMs);
          }
          return;
        }

        const chunkText = chunks[currentChunkIndex];
        currentChunkIndex++;

        activeSpeechChunkRef.current = chunkText;
        chunkStartTimeRef.current = Date.now();

        const utterance = new SpeechSynthesisUtterance(chunkText);
        const voice = activeVoiceRef.current || selectBestVoice(synthRef.current.getVoices());
        if (voice) utterance.voice = voice;

        utterance.rate = speakingRate;
        utterance.pitch = VOICE_CONFIG.pitch.default;
        utterance.volume = VOICE_CONFIG.volume.default;

        utterance.onstart = () => {
          if (sessionId === currentSpeechSessionId.current) {
            setState("speaking");
            isSpeakingRef.current = true;
          }
        };

        utterance.onend = () => {
          if (sessionId === currentSpeechSessionId.current) {
            playNextChunk();
          }
        };

        utterance.onerror = (e) => {
          if (e.error === "interrupted" || e.error === "canceled") return;
          console.warn("[AIRA Voice] Speech chunk error:", e.error);

          if (sessionId === currentSpeechSessionId.current) {
            playNextChunk();
          }
        };

        try {
          synthRef.current.speak(utterance);
        } catch (err) {
          console.warn("[AIRA Voice] Speak call failed:", err);
          isSpeakingRef.current = false;
          setState("idle");
          if (!pausedByUserRef.current) startListening();
        }
      };

      // Buffer before speech starts for natural conversational transition
      setTimeout(() => {
        if (sessionId === currentSpeechSessionId.current) {
          playNextChunk();
        }
      }, VOICE_CONFIG.delays.preSpeakMs);
    },
    [unlock, cancelActiveSpeech, speakingRate, startListening, startRecognition]
  );

  const setThinking = useCallback((message = "") => {
    cancelActiveSpeech();
    setThinkingMessage(message);
    setState("thinking");
  }, [cancelActiveSpeech]);

  const setErrorMessage = useCallback((msg = "") => {
    cancelActiveSpeech();
    setThinkingMessage(msg);
    setState("error");
  }, [cancelActiveSpeech]);

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
