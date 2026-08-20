/**
 * Unified Groq API Client with Automatic Multi-Model Fallback & Explicit Error Classification
 * 
 * Accurately classifies provider rate limits (TPM / TPD / 429), upstream outages (5xx),
 * and authentication issues without infinite retry loops or collapsing errors into generic 500s.
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
 * Executes a Groq Chat Completion with clean single-pass model fallback.
 * 
 * @param {Array} messages - Chat messages payload
 * @param {Object} options - Completion options (temperature, response_format, max_tokens)
 * @returns {Promise<{content: string, model: string, raw: Object}>}
 */
export async function createGroqChatCompletion(messages, options = {}) {
  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    const authErr = new Error("GROQ_API_KEY is not configured in environment.");
    authErr.status = 401;
    authErr.category = "auth_error";
    authErr.userMessage = "AI service is not configured properly. Please check the API key.";
    throw authErr;
  }

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
          console.log(`[Agent] Provider fallback succeeded | Primary: ${MODEL_CHAIN[0]} | Active: ${model}`);
        }
        return { content, model, raw: data };
      }

      lastStatus = response.status;
      const errData = await response.json().catch(() => ({}));
      lastErrorText = errData.error?.message || `Status ${response.status}`;

      // 1. Authentication failure (401 / 403) — STOP immediately, no model will work with bad key
      if (response.status === 401 || response.status === 403) {
        console.error(`[Agent] Provider authentication failure | Status: ${response.status}`);
        const authErr = new Error(`Groq authentication failed: ${lastErrorText}`);
        authErr.status = 401;
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

        console.warn(`[Agent] Provider rate limit | Model: ${model} | Reason: ${rateLimitReason} | RetryAfter: ${retrySec || "N/A"}`);

        // Try next fallback model in the chain
        continue;
      }

      // 3. Upstream Temporary Error (5xx)
      if (response.status >= 500) {
        console.warn(`[Agent] Provider temporary failure | Model: ${model} | Status: ${response.status}. Trying fallback...`);
        continue;
      }

      // 4. Bad Request / Decommissioned model (400 / 404)
      if (response.status === 400 || response.status === 404) {
        console.warn(`[Agent] Provider model error | Model: ${model} | Status: ${response.status}: ${lastErrorText}. Trying fallback...`);
        continue;
      }
    } catch (err) {
      if (err.category === "auth_error") throw err;
      lastErrorText = err.message;
      console.warn(`[Agent] Network exception on model ${model}: ${lastErrorText}. Trying fallback...`);
    }
  }

  // All eligible models in chain have been attempted
  if (rateLimitDetected) {
    console.error(`[Agent] Provider rate limited across all available models | Last Model: ${lastModel} | Reason: ${rateLimitReason}`);
    const rateLimitErr = new Error(`AI service temporarily rate limited: ${lastErrorText}`);
    rateLimitErr.status = 429;
    rateLimitErr.category = "provider_rate_limit";
    rateLimitErr.retryAfter = shortestRetryAfter || 5;
    rateLimitErr.reason = rateLimitReason;
    rateLimitErr.userMessage = "I'm temporarily hitting the AI service limit. Give me a moment and we'll continue.";
    throw rateLimitErr;
  }

  if (lastStatus >= 500) {
    console.error(`[Agent] Provider unavailable | All models returned temporary 5xx`);
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
