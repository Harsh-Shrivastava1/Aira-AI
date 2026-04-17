import { useState, useEffect, useRef, useCallback } from "react";

export function useVoice(onUserSpeak) {
  const [state, setState] = useState("idle"); // idle | listening | thinking | speaking
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const isListeningRef = useRef(false);
  const shouldRestartRef = useRef(false);
  const onUserSpeakRef = useRef(onUserSpeak);

  // Keep callback ref fresh without causing re-renders
  useEffect(() => {
    onUserSpeakRef.current = onUserSpeak;
  }, [onUserSpeak]);

  // Pick the best available female voice
  const getFemaleVoice = useCallback(() => {
    const voices = synthRef.current.getVoices();
    const preferred = [
      "Google US English",
      "Microsoft Zira",
      "Microsoft Aria",
      "Samantha",
      "Karen",
      "Moira",
      "Tessa"
    ];
    for (const name of preferred) {
      const found = voices.find(v => v.name.includes(name));
      if (found) return found;
    }
    // Fallback: any en-US female-sounding voice
    return voices.find(v => v.lang === "en-US") || voices[0] || null;
  }, []);

  // Initialize speech recognition once
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // single-shot, we restart manually for stability
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListeningRef.current = true;
      setState("listening");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (!transcript) return;

      // Interrupt AI if it's speaking
      if (synthRef.current.speaking) {
        synthRef.current.cancel();
      }

      shouldRestartRef.current = false;
      isListeningRef.current = false;
      setState("thinking");
      onUserSpeakRef.current(transcript);
    };

    recognition.onerror = (e) => {
      // 'no-speech' and 'aborted' are expected — silently restart
      if (e.error === "no-speech") {
        if (shouldRestartRef.current) {
          try { recognition.start(); } catch (_) {}
        }
        return;
      }
      if (e.error === "aborted") return;

      console.warn("Speech recognition error:", e.error);
      isListeningRef.current = false;
      setState("idle");
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      // Auto-restart only if we're supposed to keep listening
      if (shouldRestartRef.current) {
        try {
          recognition.start();
        } catch (_) {}
      }
    };

    recognitionRef.current = recognition;

    // Preload voices
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = () => {};
    }

    return () => {
      shouldRestartRef.current = false;
      isListeningRef.current = false;
      try { recognition.stop(); } catch (_) {}
      synthRef.current.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    // Don't start if currently in a non-listenable state
    if (isListeningRef.current) return;

    shouldRestartRef.current = true;
    setState("listening");
    try {
      recognitionRef.current.start();
    } catch (_) {
      // Already started — that's fine
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    isListeningRef.current = false;
    setState("idle");
    try { recognitionRef.current?.stop(); } catch (_) {}
  }, []);

  const speak = useCallback((text, onEnd) => {
    if (!text) return;

    // Cancel anything currently speaking
    synthRef.current.cancel();
    // Also stop listening while AIRA speaks
    shouldRestartRef.current = false;
    try { recognitionRef.current?.stop(); } catch (_) {}

    setState("speaking");

    // Small delay to ensure cancel is processed
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = getFemaleVoice();
      if (voice) utterance.voice = voice;

      utterance.rate = 1.0;   // Natural pace
      utterance.pitch = 1.1;  // Slightly higher = warmer/friendlier
      utterance.volume = 1.0;

      utterance.onend = () => {
        setState("idle");
        if (onEnd) onEnd();
        // Automatically resume listening after speaking
        startListening();
      };

      utterance.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") return;
        console.warn("Speech synthesis error:", e.error);
        setState("idle");
        startListening();
      };

      synthRef.current.speak(utterance);
    }, 100);
  }, [getFemaleVoice, startListening]);

  const setThinking = useCallback(() => {
    shouldRestartRef.current = false;
    try { recognitionRef.current?.stop(); } catch (_) {}
    setState("thinking");
  }, []);

  return { state, startListening, stopListening, speak, setThinking };
}
