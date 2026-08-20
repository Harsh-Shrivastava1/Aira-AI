/**
 * Universal Error Recovery Service for AIRA
 * 
 * Provides centralized error classification, bounded automatic retries,
 * and calm, actionable, voice-friendly recovery responses following the
 * standard: [WHAT HAPPENED] + [NEXT USEFUL ACTION].
 * 
 * Never exposes raw stack traces, HTTP codes, or technical jargon to the user.
 */

export const ERROR_MESSAGES = {
  // Network & Connectivity
  OFFLINE: "You're offline right now, so I can't reach the AI service.",
  ONLINE_RESTORED: "You're back online.",
  NETWORK_TRANSIENT: "I lost the connection for a moment. Let's try that again.",
  NETWORK_PERSISTENT: "I'm still having trouble reaching the server. Check your connection and try again.",
  TIMEOUT: "That took longer than expected. Let's try it again.",

  // API Client Errors (4xx)
  BAD_REQUEST_400: "The request wasn't quite right. Let's try that again.",
  UNAUTHORIZED_401: "Your session seems to have expired. Please sign in again.",
  FORBIDDEN_403: "I don't have permission to do that.",
  NOT_FOUND_404: "I couldn't find what you're looking for.",
  CONFLICT_409: "That conflicts with something already in progress. Let's try again.",
  RATE_LIMIT_429: "I'm temporarily hitting a usage limit. Give it a moment and try again.",
  PROVIDER_RATE_LIMIT: "I'm temporarily hitting the AI service limit. Give me a moment and we'll continue.",

  // API Server Errors (5xx)
  SERVER_ERROR_500: "Something went wrong on my side. Let's try that again.",
  GATEWAY_ERROR_502_504: "I can't reach the service right now. Give me a moment and try again.",

  // AI & Generation Failures
  AI_GENERATION_FAILED: "I couldn't generate that response right now. Give me another try.",
  AI_MALFORMED_RESPONSE: "I got an incomplete response. Let's try that again.",

  // Microphone & Speech Recognition
  MIC_PERMISSION_DENIED: "I can't access your microphone yet. Please allow microphone access and try again.",
  MIC_HARDWARE_NOT_FOUND: "I can't find a working microphone. Check your microphone connection and try again.",
  MIC_IN_USE: "I can't access the microphone right now. Check that another app isn't using it.",
  VOICE_RECOGNITION_UNAVAILABLE: "Voice recognition isn't available right now. We can try again in a moment.",
  VOICE_UNSUPPORTED_BROWSER: "Voice recognition isn't supported in this browser. Try a browser with voice recognition support, or use text input.",
  RECOGNITION_STOPPED_UNEXPECTEDLY: "Voice recognition stopped responding. Let's reconnect it.",

  // Speech Synthesis (TTS)
  TTS_FAILED_RETRY: "My voice didn't start properly. Let me try that again.",
  TTS_FAILED_FALLBACK_TEXT: "I’m having trouble with voice output right now. You can still continue by typing.",

  // Files & Uploads
  FILE_UPLOAD_FAILED: "I couldn't upload that file. Try it again.",
  FILE_UNSUPPORTED_TYPE: "I can't work with that file type yet.",
  FILE_TOO_LARGE: "That file is too large to upload. Try a smaller one.",

  // External Actions & Integrations
  EMAIL_SEND_FAILED: "I couldn't send that email. The message is still here, but it wasn't delivered.",
  AUTH_CONNECT_FAILED: "I couldn't connect to your account right now. Let's try again.",

  // Generic Fallback
  GENERIC_RETRY: "Something went wrong on my side. Let's try that again."
};

/**
 * Classifies any runtime or API error and determines recovery metadata
 * 
 * @param {Error|Object|string} error - The caught error
 * @param {Object} context - Optional context (status, endpoint, attempt)
 * @returns {Object} { category, statusCode, userMessage, shouldRetry, maxRetries, isUserInterruption }
 */
export function classifyError(error, context = {}) {
  // 1. User Interruption via AbortController (NOT an error)
  if (error?.name === "AbortError" || error === "AbortError" || context.isInterrupted) {
    return {
      category: "interruption",
      statusCode: null,
      userMessage: null,
      shouldRetry: false,
      maxRetries: 0,
      isUserInterruption: true
    };
  }

  // 2. Offline check (browser environment only)
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      category: "offline",
      statusCode: null,
      userMessage: ERROR_MESSAGES.OFFLINE,
      shouldRetry: false,
      maxRetries: 0,
      isUserInterruption: false
    };
  }

  const rawMessage = (error?.message || String(error || "")).toLowerCase();
  const status = Number(error?.status || context.status || (rawMessage.match(/\b([45]\d{2})\b/) || [])[1] || 0);

  // 3. HTTP 4xx Errors (Deterministic client issues - do NOT blindly retry)
  if (status === 400) {
    return {
      category: "bad_request",
      statusCode: 400,
      userMessage: ERROR_MESSAGES.BAD_REQUEST_400,
      shouldRetry: false,
      maxRetries: 0,
      isUserInterruption: false
    };
  }

  if (status === 401) {
    return {
      category: "auth",
      statusCode: 401,
      userMessage: ERROR_MESSAGES.UNAUTHORIZED_401,
      shouldRetry: false,
      maxRetries: 0,
      isUserInterruption: false
    };
  }

  if (status === 403) {
    return {
      category: "auth",
      statusCode: 403,
      userMessage: ERROR_MESSAGES.FORBIDDEN_403,
      shouldRetry: false,
      maxRetries: 0,
      isUserInterruption: false
    };
  }

  if (status === 404) {
    return {
      category: "not_found",
      statusCode: 404,
      userMessage: ERROR_MESSAGES.NOT_FOUND_404,
      shouldRetry: false,
      maxRetries: 0,
      isUserInterruption: false
    };
  }

  if (status === 409) {
    return {
      category: "conflict",
      statusCode: 409,
      userMessage: ERROR_MESSAGES.CONFLICT_409,
      shouldRetry: false,
      maxRetries: 0,
      isUserInterruption: false
    };
  }

  if (status === 429 || context.category === "provider_rate_limit" || error?.category === "provider_rate_limit") {
    const isProvider = context.category === "provider_rate_limit" || error?.category === "provider_rate_limit" || rawMessage.includes("ai service") || rawMessage.includes("provider");
    return {
      category: isProvider ? "provider_rate_limit" : "rate_limit",
      statusCode: 429,
      userMessage: error?.userMessage || (isProvider ? ERROR_MESSAGES.PROVIDER_RATE_LIMIT : ERROR_MESSAGES.RATE_LIMIT_429),
      retryAfter: error?.retryAfter || context?.retryAfter || null,
      shouldRetry: false,
      maxRetries: 0,
      isUserInterruption: false
    };
  }

  // 4. HTTP 5xx Server Errors (Transient server issues - allow bounded retry)
  if (status === 503 || context.category === "provider_unavailable" || error?.category === "provider_unavailable") {
    return {
      category: "provider_unavailable",
      statusCode: 503,
      userMessage: error?.userMessage || ERROR_MESSAGES.GATEWAY_ERROR_502_504,
      shouldRetry: true,
      maxRetries: 1,
      isUserInterruption: false
    };
  }

  if (status === 502 || status === 504) {
    return {
      category: "gateway",
      statusCode: status,
      userMessage: error?.userMessage || ERROR_MESSAGES.GATEWAY_ERROR_502_504,
      shouldRetry: true,
      maxRetries: 2,
      isUserInterruption: false
    };
  }

  if (status >= 500) {
    return {
      category: "server",
      statusCode: status,
      userMessage: error?.userMessage || ERROR_MESSAGES.SERVER_ERROR_500,
      shouldRetry: true,
      maxRetries: 2,
      isUserInterruption: false
    };
  }

  // 5. Network / Fetch Failures
  if (rawMessage.includes("failed to fetch") || rawMessage.includes("networkerror") || rawMessage.includes("econnrefused")) {
    const isPersistent = (context.attempt || 1) > 2;
    return {
      category: "network",
      statusCode: null,
      userMessage: isPersistent ? ERROR_MESSAGES.NETWORK_PERSISTENT : ERROR_MESSAGES.NETWORK_TRANSIENT,
      shouldRetry: !isPersistent,
      maxRetries: 2,
      isUserInterruption: false
    };
  }

  // 6. Timeout
  if (rawMessage.includes("timeout") || rawMessage.includes("timed out")) {
    return {
      category: "timeout",
      statusCode: null,
      userMessage: ERROR_MESSAGES.TIMEOUT,
      shouldRetry: false,
      maxRetries: 0,
      isUserInterruption: false
    };
  }

  // 7. JSON Parsing / Malformed Output
  if (rawMessage.includes("json") || rawMessage.includes("unexpected token") || rawMessage.includes("syntaxerror")) {
    return {
      category: "ai_malformed",
      statusCode: null,
      userMessage: ERROR_MESSAGES.AI_MALFORMED_RESPONSE,
      shouldRetry: false,
      maxRetries: 0,
      isUserInterruption: false
    };
  }

  // 8. Microphone Permissions & Hardware
  if (rawMessage.includes("notallowederror") || rawMessage.includes("permission denied") || error === "not-allowed") {
    return {
      category: "mic_permission",
      statusCode: null,
      userMessage: ERROR_MESSAGES.MIC_PERMISSION_DENIED,
      shouldRetry: false,
      maxRetries: 0,
      isUserInterruption: false
    };
  }

  if (rawMessage.includes("notfounderror") || rawMessage.includes("devicesnotfounderror")) {
    return {
      category: "mic_hardware",
      statusCode: null,
      userMessage: ERROR_MESSAGES.MIC_HARDWARE_NOT_FOUND,
      shouldRetry: false,
      maxRetries: 0,
      isUserInterruption: false
    };
  }

  if (rawMessage.includes("notreadableerror") || rawMessage.includes("audio-capture") || error === "audio-capture") {
    return {
      category: "mic_in_use",
      statusCode: null,
      userMessage: ERROR_MESSAGES.MIC_IN_USE,
      shouldRetry: false,
      maxRetries: 0,
      isUserInterruption: false
    };
  }

  if (error === "service-not-allowed") {
    return {
      category: "voice_unavailable",
      statusCode: null,
      userMessage: ERROR_MESSAGES.VOICE_RECOGNITION_UNAVAILABLE,
      shouldRetry: false,
      maxRetries: 0,
      isUserInterruption: false
    };
  }

  // 9. Speech Synthesis
  if (rawMessage.includes("tts") || rawMessage.includes("synthesis")) {
    return {
      category: "tts",
      statusCode: null,
      userMessage: ERROR_MESSAGES.TTS_FAILED_RETRY,
      shouldRetry: true,
      maxRetries: 1,
      isUserInterruption: false
    };
  }

  // 10. File upload specific
  if (rawMessage.includes("file too large") || rawMessage.includes("payload too large")) {
    return {
      category: "file_size",
      statusCode: 413,
      userMessage: ERROR_MESSAGES.FILE_TOO_LARGE,
      shouldRetry: false,
      maxRetries: 0,
      isUserInterruption: false
    };
  }

  if (rawMessage.includes("unsupported file") || rawMessage.includes("invalid file type")) {
    return {
      category: "file_type",
      statusCode: 415,
      userMessage: ERROR_MESSAGES.FILE_UNSUPPORTED_TYPE,
      shouldRetry: false,
      maxRetries: 0,
      isUserInterruption: false
    };
  }

  // 11. Generic fallback
  return {
    category: "unknown",
    statusCode: status || 500,
    userMessage: ERROR_MESSAGES.GENERIC_RETRY,
    shouldRetry: false,
    maxRetries: 0,
    isUserInterruption: false
  };
}

/**
 * Sanitizes log information to prevent exposing sensitive tokens, passwords, or PII
 */
export function sanitizeLogDetails(details) {
  if (!details) return {};
  const sanitized = { ...details };
  const sensitiveKeys = ["password", "token", "key", "authorization", "apiKey", "phone", "phonenumber"];
  for (const k of Object.keys(sanitized)) {
    if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
      sanitized[k] = "[REDACTED]";
    }
  }
  return sanitized;
}
