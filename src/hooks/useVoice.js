import { useState, useEffect, useRef, useCallback } from "react";
import { VOICE_CONFIG, matchVoiceCommand } from "../services/voiceConfig.js";
import {
  selectBestVoice,
  chunkSpeechText,
  classifyMicrophoneInput,
  checkMicrophoneHealth,
  isEchoTranscript,
} from "../services/voiceService.js";

/**
 * Enterprise-Grade Voice & Conversation Lifecycle Hook for AIRA
 * 
 * Provides:
 * - Authoritative SpeechRecognition lifecycle manager with mutex lock and watchdog
 * - Full Web Speech API event handling (onstart, onaudiostart, onspeechstart, onresult, onspeechend, onsoundend, onaudioend, onerror, onend)
 * - Multi-layer acoustic echo suppression with trailing post-TTS immunity window
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
  const lastBackoffDelayRef = useRef(0);
  const watchdogTimerRef = useRef(null);
  const lastAudioEventTimeRef = useRef(Date.now());
  const isSpeechUnlocked = useRef(false);
  const activeVoiceRef = useRef(null);

  // Active Speech & Echo Tracking
  const currentSpeechSessionId = useRef(0);
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
        // Synchronize internal refs to avoid repeated/infinite start() loops.
        isRecognitionRunningRef.current = true;
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

    const backoff = delayMs > 0 
      ? delayMs 
      : (lastBackoffDelayRef.current > 0 
          ? lastBackoffDelayRef.current 
          : Math.min(100 * Math.pow(1.8, restartAttemptsRef.current), 3000));
    
    lastBackoffDelayRef.current = 0; // reset once scheduled

    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (shouldBeListeningRef.current && !pausedByUserRef.current && !isRecognitionRunningRef.current && !isStartingRef.current) {
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

    clearMicBufferRef.current = () => {
      if (interimDebounceTimer) {
        clearTimeout(interimDebounceTimer);
        interimDebounceTimer = null;
      }
      accumulatedTranscript = "";
    };

    const finalizeTranscript = (transcriptText) => {
      clearTimeout(interimDebounceTimer);
      const cleaned = transcriptText.trim();
      accumulatedTranscript = "";

      if (!cleaned) return;

      const now = Date.now();
      const normCleaned = cleaned.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "").replace(/\s+/g, " ");
      const normLast = (lastSubmittedVoiceTranscriptRef.current?.text || "").toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "").replace(/\s+/g, " ");

      if (
        normCleaned &&
        normCleaned === normLast &&
        now - lastSubmittedVoiceTranscriptRef.current.timestamp < (VOICE_CONFIG.delays.duplicateTurnWindowMs || 1500)
      ) {
        console.log("[AIRA Voice] Suppressed duplicate voice transcript:", cleaned);
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
      if (!heardWords) return;

      const isCurrentlySpeaking = isSpeakingRef.current || (synthRef.current && synthRef.current.speaking);
      const isWithinTrailingEchoWindow = Date.now() - ttsFinishedTimestampRef.current < (VOICE_CONFIG.delays.trailingEchoImmunityMs || 1500);

      // Multi-Layer Acoustic Echo & Interruption Evaluation
      if (isCurrentlySpeaking) {
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
          // Suppress acoustic feedback from device speakers
          return;
        }

        if (classification.isInterruption) {
          console.log(`[AIRA Voice] User voice interruption detected (${classification.reason}):`, heardWords);
          cancelActiveSpeech();
          if (onInterruptRef.current) onInterruptRef.current();
          setState("interrupted");
          // Fall through so the genuine interruption is preserved, accumulated, and finalized!
        }
      } else if (isWithinTrailingEchoWindow && lastSpokenTextRef.current) {
        // Trailing window: verify if heardWords is acoustic echo of recently spoken text
        const isTrailingEcho = isEchoTranscript(heardWords, lastSpokenTextRef.current, recentSpokenChunksRef.current);
        if (isTrailingEcho) {
          console.log("[AIRA Voice] Suppressed trailing TTS acoustic echo:", heardWords);
          return;
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

      // Normal silence timeout in Chrome/Android — let onend handle graceful loop
      if (errType === "no-speech") {
        return;
      }

      if (errType === "aborted") {
        return;
      }

      console.warn(`[AIRA Voice] Recognition error: ${errType}`);

      if (errType === "not-allowed" || errType === "service-not-allowed" || errType === "audio-capture") {
        isRecognitionRunningRef.current = false;
        shouldBeListeningRef.current = false;
        setState("error");
        return;
      }

      if (errType === "network") {
        restartAttemptsRef.current += 1;
        lastBackoffDelayRef.current = VOICE_CONFIG.delays.networkBackoffMs || 1000;
        scheduleRestart(lastBackoffDelayRef.current);
        return;
      }
    };

    recognition.onend = () => {
      isRecognitionRunningRef.current = false;
      isStartingRef.current = false;

      // If recognition stopped unexpectedly while listening should be active -> recover
      if (shouldBeListeningRef.current && !pausedByUserRef.current && !intentionalStopRef.current) {
        // If AIRA is actively speaking, wait for speech synthesis completion to restart recognition cleanly
        if (isSpeakingRef.current || (synthRef.current && synthRef.current.speaking)) {
          return;
        }

        const delay = lastBackoffDelayRef.current > 0 ? lastBackoffDelayRef.current : 100;
        scheduleRestart(delay);
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
      clearMicBufferRef.current = null;
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

      // Store in history for echo matching & "repeat that" command
      lastSpokenTextRef.current = text;
      recentSpokenChunksRef.current = [];

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
      if (shouldBeListeningRef.current && !isRecognitionRunningRef.current && !isStartingRef.current) {
        startRecognition();
      }

      const finalizeTtsCompletion = () => {
        if (sessionId !== currentSpeechSessionId.current) return;
        ttsFinishedTimestampRef.current = Date.now();
        isSpeakingRef.current = false;
        activeSpeechChunkRef.current = "";

        // Clear accumulated microphone buffer captured while AIRA spoke
        if (clearMicBufferRef.current) {
          clearMicBufferRef.current();
        }

        setState("idle");
        if (onEnd) onEnd();

        // Auto-resume listening cleanly via scheduleRestart
        if (!pausedByUserRef.current && shouldBeListeningRef.current) {
          scheduleRestart(VOICE_CONFIG.delays.postSpeakListenDelayMs);
        }
      };

      const playNextChunk = () => {
        // If user interrupted or another speech session started, stop immediately
        if (sessionId !== currentSpeechSessionId.current) {
          isSpeakingRef.current = false;
          return;
        }

        if (currentChunkIndex >= chunks.length) {
          // Verify speech synthesis engine actually finished draining its audio buffer
          if (synthRef.current && synthRef.current.speaking) {
            const checkSpeakingDone = setInterval(() => {
              if (!synthRef.current || !synthRef.current.speaking || sessionId !== currentSpeechSessionId.current) {
                clearInterval(checkSpeakingDone);
                finalizeTtsCompletion();
              }
            }, 40);
            setTimeout(() => {
              clearInterval(checkSpeakingDone);
              finalizeTtsCompletion();
            }, 600);
          } else {
            finalizeTtsCompletion();
          }
          return;
        }

        const chunkText = chunks[currentChunkIndex];
        currentChunkIndex++;

        activeSpeechChunkRef.current = chunkText;
        recentSpokenChunksRef.current = [...recentSpokenChunksRef.current.slice(-5), chunkText];
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
    [unlock, cancelActiveSpeech, speakingRate, startListening, startRecognition, scheduleRestart]
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
