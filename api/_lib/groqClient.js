/**
 * Unified Groq API Client with Automatic Multi-Model Fallback,
 * Explicit Error Classification, and Automatic Dual-Key Failover
 * 
 * Accurately classifies provider rate limits (TPM / TPD / 429), upstream outages (5xx),
 * and authentication issues (401). If the primary API key encounters a qualifying 429
 * or key exhaustion, it automatically fails over to the secondary key without user intervention.
 */

// Prioritized model chain with active available models
const MODEL_CHAIN = [
  process.env.GROQ_MODEL || "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "groq/compound"
];

/**
 * Extracts retry-after seconds from Groq error text or response headers
 * 
 * @param {string} errorText 
 * @param {Response} response 
 * @returns {number|null}
 */
function extractRetryAfter(errorText = "", response = null) {
  const headerVal = response?.headers?.get?.("retry-after");
  if (headerVal && !isNaN(Number(headerVal))) {
    return Math.max(1, Math.min(Math.ceil(Number(headerVal)), 60));
  }
  const match = errorText.match(/try again in ([\d\.]+)s/i);
  if (match) {
    return Math.max(1, Math.min(Math.ceil(parseFloat(match[1])), 60));
  }
  return null;
}

/**
 * Resolves configured Groq API keys in priority order:
 * 1. GROQ_API_KEY_1 (Primary)
 * 2. GROQ_API_KEY_2 (Secondary failover)
 * 3. GROQ_API_KEY (Legacy fallback if KEY_1 is absent)
 * 
 * Never returns duplicate keys or empty/whitespace values.
 * Server-side only: never exposes keys to Vite or client code.
 * 
 * @returns {Array<{id: string, key: string}>}
 */
export function getGroqApiKeys() {
  const keys = [];
  const key1 = process.env.GROQ_API_KEY_1?.trim();
  const key2 = process.env.GROQ_API_KEY_2?.trim();
  const legacyKey = process.env.GROQ_API_KEY?.trim();

  const primary = key1 || legacyKey;
  if (primary) {
    keys.push({ id: "PRIMARY", key: primary });
  }

  if (key2 && key2 !== primary) {
    keys.push({ id: "SECONDARY", key: key2 });
  }

  return keys;
}

/**
 * Evaluates whether an error indicates that the current API key cannot serve the request
 * (e.g., rate-limited, quota exhausted, or invalid credential) rather than a request syntax
 * or upstream server issue.
 * 
 * @param {Error|Object} error 
 * @returns {boolean}
 */
export function isQualifyingKeyFailure(error) {
  if (!error) return false;

  const status = error.status || error.statusCode;
  const category = error.category;
  const message = (error.message || "").toLowerCase();
  const reason = (error.reason || "").toLowerCase();

  // 1. Explicit 429 Rate Limit or Quota Exhaustion
  if (status === 429 || category === "provider_rate_limit") {
    return true;
  }

  // 2. Authentication failure with the current key (401 / 403 invalid key)
  if (status === 401 || category === "auth_error") {
    return true;
  }

  // 3. Specific 403 quota or permission blocks indicating key unusable
  if (status === 403 && (message.includes("quota") || message.includes("restricted") || message.includes("permission"))) {
    return true;
  }

  // 4. Content matches known Groq rate limit / quota patterns
  const rateLimitPatterns = [
    /rate_limit_exceeded/i,
    /tokens per minute/i,
    /tokens per day/i,
    /requests per minute/i,
    /requests per day/i,
    /\btpm\b/i,
    /\btpd\b/i,
    /\brpm\b/i,
    /\brpd\b/i,
    /insufficient_quota/i,
    /quota exceeded/i,
    /exceeded your current quota/i,
    /resource_exhausted/i,
  ];

  if (rateLimitPatterns.some((pattern) => pattern.test(message) || pattern.test(reason))) {
    return true;
  }

  return false;
}

/**
 * Executes a Groq Chat Completion with clean single-pass model fallback for a specific key.
 * 
 * @param {string} apiKey - The Groq API key to use
 * @param {string} keyId - Log identifier ("PRIMARY" or "SECONDARY")
 * @param {Array} messages - Chat messages payload
 * @param {Object} options - Completion options (temperature, response_format, max_tokens)
 * @returns {Promise<{content: string, model: string, raw: Object}>}
 */
async function executeChatCompletionWithKey(apiKey, keyId, messages, options = {}) {
  let lastErrorText = "";
  let lastStatus = 500;
  let lastModel = MODEL_CHAIN[0];
  let rateLimitDetected = false;
  let shortestRetryAfter = null;
  let rateLimitReason = "TPM";

  // Single pass through prioritized models — never hammer exhausted models repeatedly
  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const model = MODEL_CHAIN[i];
    lastModel = model;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.65,
          response_format: options.response_format ?? { type: "json_object" },
          max_tokens: options.max_tokens ?? 800
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "{}";
        if (i > 0) {
          console.log(`[Agent] Provider fallback succeeded | Key: ${keyId} | Primary: ${MODEL_CHAIN[0]} | Active: ${model}`);
        }
        return { content, model, raw: data };
      }

      lastStatus = response.status;
      const errData = await response.json().catch(() => ({}));
      lastErrorText = errData.error?.message || `Status ${response.status}`;

      // 1. Authentication failure (401 / 403) — STOP immediately, no model will work with bad key
      if (response.status === 401 || response.status === 403) {
        console.error(`[Agent] Provider authentication failure | Key: ${keyId} | Status: ${response.status}`);
        const authErr = new Error(`Groq authentication failed: ${lastErrorText}`);
        authErr.status = response.status;
        authErr.category = "auth_error";
        authErr.userMessage = "AI service authentication failed. Please verify your API key.";
        throw authErr;
      }

      // 2. Rate Limited (429) — TPM, TPD, or RPM
      if (response.status === 429) {
        rateLimitDetected = true;
        const isTpd = /tokens per day|TPD/i.test(lastErrorText);
        const isTpm = /tokens per minute|TPM/i.test(lastErrorText);
        rateLimitReason = isTpd ? "TPD (Daily Limit)" : (isTpm ? "TPM (Minute Limit)" : "Rate Limit");
        
        const retrySec = extractRetryAfter(lastErrorText, response);
        if (retrySec && (shortestRetryAfter === null || retrySec < shortestRetryAfter)) {
          shortestRetryAfter = retrySec;
        }

        console.warn(`[Agent] Provider rate limit | Key: ${keyId} | Model: ${model} | Reason: ${rateLimitReason} | RetryAfter: ${retrySec || "N/A"}`);

        // If daily limit (TPD), other models on this key will also be exhausted — break early to fail over key
        if (isTpd) {
          break;
        }

        // Try next fallback model in the chain
        continue;
      }

      // 3. Upstream Temporary Error (5xx)
      if (response.status >= 500) {
        console.warn(`[Agent] Provider temporary failure | Key: ${keyId} | Model: ${model} | Status: ${response.status}. Trying fallback...`);
        continue;
      }

      // 4. Bad Request / Decommissioned model (400 / 404)
      if (response.status === 400 || response.status === 404) {
        console.warn(`[Agent] Provider model error | Key: ${keyId} | Model: ${model} | Status: ${response.status}: ${lastErrorText}. Trying fallback...`);
        continue;
      }
    } catch (err) {
      if (err.category === "auth_error") throw err;
      lastErrorText = err.message;
      console.warn(`[Agent] Network exception on key ${keyId}, model ${model}: ${lastErrorText}. Trying fallback...`);
    }
  }

  // All eligible models in chain have been attempted for this key
  if (rateLimitDetected) {
    console.error(`[Agent] Provider rate limited across available models | Key: ${keyId} | Last Model: ${lastModel} | Reason: ${rateLimitReason}`);
    const rateLimitErr = new Error(`AI service temporarily rate limited: ${lastErrorText}`);
    rateLimitErr.status = 429;
    rateLimitErr.category = "provider_rate_limit";
    rateLimitErr.retryAfter = shortestRetryAfter || 5;
    rateLimitErr.reason = rateLimitReason;
    rateLimitErr.userMessage = "I'm temporarily hitting the AI service limit. Give me a moment and we'll continue.";
    throw rateLimitErr;
  }

  if (lastStatus >= 500) {
    console.error(`[Agent] Provider unavailable | Key: ${keyId} | All models returned temporary 5xx`);
    const outageErr = new Error(`AI service temporarily unavailable: ${lastErrorText}`);
    outageErr.status = 503;
    outageErr.category = "provider_unavailable";
    outageErr.userMessage = "The AI service is temporarily unavailable right now. Give me a moment and try again.";
    throw outageErr;
  }

  const genericErr = new Error(`Groq API failure: ${lastErrorText}`);
  genericErr.status = lastStatus || 500;
  genericErr.category = "server";
  genericErr.userMessage = "Something went wrong on my side. Let's try that again.";
  throw genericErr;
}

/**
 * Executes a Groq Chat Completion with automatic dual-key failover and model fallback.
 * 
 * Hierarchy:
 * 1. Primary key attempts the request (with prioritized model fallback).
 * 2. If primary succeeds -> returns response.
 * 3. If primary fails with a qualifying key issue (429 rate limit or 401 auth error)
 *    and a secondary key is configured -> logs transition and retries the SAME request with secondary key.
 * 4. If secondary succeeds -> returns response.
 * 5. If secondary fails (or error is non-qualifying like 400) -> returns existing error.
 * 
 * @param {Array} messages - Chat messages payload
 * @param {Object} options - Completion options (temperature, response_format, max_tokens)
 * @returns {Promise<{content: string, model: string, raw: Object}>}
 */
export async function createGroqChatCompletion(messages, options = {}) {
  const keys = getGroqApiKeys();
  if (keys.length === 0) {
    const authErr = new Error("GROQ_API_KEY is not configured in environment.");
    authErr.status = 401;
    authErr.category = "auth_error";
    authErr.userMessage = "AI service is not configured properly. Please check the API key.";
    throw authErr;
  }

  const primaryKey = keys[0];
  const secondaryKey = keys.length > 1 ? keys[1] : null;

  try {
    return await executeChatCompletionWithKey(primaryKey.key, primaryKey.id, messages, options);
  } catch (primaryError) {
    // If no secondary key is configured or the error does not qualify for key failover, propagate immediately
    if (!secondaryKey || !isQualifyingKeyFailure(primaryError)) {
      throw primaryError;
    }

    const failureReason = primaryError.status || primaryError.reason || "429";
    console.warn(`[Groq] Primary key failed with ${failureReason}; attempting secondary key`);

    try {
      const secondaryResult = await executeChatCompletionWithKey(secondaryKey.key, secondaryKey.id, messages, options);
      console.log(`[Groq] Secondary key succeeded`);
      return secondaryResult;
    } catch (secondaryError) {
      console.error(`[Groq] Secondary key also failed with ${secondaryError.status || 500}`);
      throw secondaryError;
    }
  }
}
