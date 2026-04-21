import { useState, useEffect, useRef, useCallback } from "react";

export function useVoice(onUserSpeak) {
  const [state, setState] = useState("idle"); // idle | listening | thinking | speaking
  const [thinkingMessage, setThinkingMessage] = useState("");
  const recognitionRef   = useRef(null);
  const synthRef         = useRef(window.speechSynthesis);
  const isListeningRef   = useRef(false);
  const shouldRestartRef = useRef(false);
  const onUserSpeakRef   = useRef(onUserSpeak);
  const pausedByUserRef  = useRef(false); // tracks manual orb-tap pause

  // Keep callback ref fresh without causing re-renders
  useEffect(() => {
    onUserSpeakRef.current = onUserSpeak;
  }, [onUserSpeak]);

  // Pick the best available voice
  const getVoice = useCallback(() => {
    const voices = synthRef.current.getVoices();
    const preferred = [
      "Google US English",
      "Microsoft Aria",
      "Microsoft Zira",
      "Samantha",
      "Karen",
      "Moira",
      "Tessa",
    ];
    for (const name of preferred) {
      const found = voices.find((v) => v.name.includes(name));
      if (found) return found;
    }
    return voices.find((v) => v.lang === "en-US") || voices[0] || null;
  }, []);

  // Initialize speech recognition once
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous     = false;
    recognition.interimResults = false;
    recognition.lang           = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListeningRef.current = true;
      pausedByUserRef.current = false;
      setState("listening");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (!transcript) return;

      // If AIRA is speaking, interrupt her
      if (synthRef.current.speaking) {
        synthRef.current.cancel();
      }

      shouldRestartRef.current = false;
      isListeningRef.current   = false;
      pausedByUserRef.current  = false;
      setState("thinking");
      onUserSpeakRef.current(transcript);
    };

    recognition.onerror = (e) => {
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
      if (shouldRestartRef.current) {
        try { recognition.start(); } catch (_) {}
      }
    };

    recognitionRef.current = recognition;

    // Preload voices
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = () => {};
    }

    return () => {
      shouldRestartRef.current = false;
      isListeningRef.current   = false;
      try { recognition.stop(); } catch (_) {}
      synthRef.current.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListeningRef.current) return;
    pausedByUserRef.current  = false;
    shouldRestartRef.current = true;
    setState("listening");
    try { recognitionRef.current.start(); } catch (_) {}
  }, []);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    isListeningRef.current   = false;
    setState("idle");
    try { recognitionRef.current?.stop(); } catch (_) {}
  }, []);

  /**
   * toggleOrb — called when user taps the orb.
   * Behaviour:
   *  • If AIRA is speaking  → cancel speech, start listening (interrupt)
   *  • If listening          → stop listening (manual pause), go idle
   *  • If idle / thinking    → start listening
   */
  const toggleOrb = useCallback(() => {
    if (synthRef.current.speaking) {
      // User tapped while AIRA speaks → interrupt + listen
      synthRef.current.cancel();
      pausedByUserRef.current  = true;
      shouldRestartRef.current = true;
      setState("listening");
      try { recognitionRef.current?.start(); } catch (_) {}
      return;
    }

    if (isListeningRef.current || shouldRestartRef.current) {
      // Currently listening → pause
      shouldRestartRef.current = false;
      isListeningRef.current   = false;
      pausedByUserRef.current  = true;
      setState("idle");
      try { recognitionRef.current?.stop(); } catch (_) {}
    } else {
      // Idle → start listening
      pausedByUserRef.current  = false;
      shouldRestartRef.current = true;
      setState("listening");
      try { recognitionRef.current?.start(); } catch (_) {}
    }
  }, []);

  const speak = useCallback((text, onEnd) => {
    if (!text) return;

    synthRef.current.cancel();
    shouldRestartRef.current = false;
    try { recognitionRef.current?.stop(); } catch (_) {}

    setState("speaking");

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = getVoice();
      if (voice) utterance.voice = voice;

      utterance.rate   = 1.05;  // natural, slightly brisk
      utterance.pitch  = 1.1;   // warmer / friendlier
      utterance.volume = 1.0;

      utterance.onend = () => {
        setState("idle");
        if (onEnd) onEnd();
        // Auto-resume listening after speaking (unless user manually paused)
        if (!pausedByUserRef.current) {
          startListening();
        }
      };

      utterance.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") return;
        console.warn("Speech synthesis error:", e.error);
        setState("idle");
        if (!pausedByUserRef.current) startListening();
      };

      synthRef.current.speak(utterance);
    }, 80);
  }, [getVoice, startListening]);

  const setThinking = useCallback((message = "") => {
    shouldRestartRef.current = false;
    try { recognitionRef.current?.stop(); } catch (_) {}
    setThinkingMessage(message);
    setState("thinking");
  }, []);

  return { state, thinkingMessage, startListening, stopListening, toggleOrb, speak, setThinking };
}
