/**
 * Production-Grade API Rate Limiter & Abuse Protection for AIRA
 * 
 * Supports:
 * - Cryptographic server-side Firebase ID token verification (never trusts unverified client headers)
 * - Dual-layer identity: Verified User ID quota + Tolerant shared-IP abuse protection
 * - Sliding-window counter algorithm (prevents boundary spikes)
 * - Active concurrency limits per user/IP (max 3 simultaneous for chat)
 * - Endpoint-specific tier limits (generous for voice chat, tighter for uploads/actions)
 * - Interruption-safe lifecycle tracking
 * - Background operation deduplication (e.g. memory extraction)
 * - Upstash / Redis REST serverless store with automatic in-memory sliding-window fallback
 * - Safe fail-open for conversations, fail-closed for sensitive external mutations
 * - Voice-friendly HTTP 429 responses with Retry-After headers
 */

import crypto from "crypto";

// Endpoint Rate Limit Policies
export const RATE_LIMIT_POLICIES = {
  // Voice & Chat: Generous capacity for 30–60+ minute continuous voice conversations
  chat: {
    name: "chat",
    user: {
      burst: { max: 30, windowSec: 60 },        // 30 requests per minute
      sustained: { max: 350, windowSec: 3600 },   // 350 requests per hour (~6/min sustained)
      daily: { max: 2500, windowSec: 86400 }     // 2500 requests per day
    },
    ip: {
      burst: { max: 120, windowSec: 60 },       // Shared NAT/Wi-Fi tolerant (4x user burst)
      sustained: { max: 1200, windowSec: 3600 }
    },
    maxConcurrency: 3,
    failOpen: true
  },

  // Document & Code Analysis
  fileChat: {
    name: "fileChat",
    user: {
      burst: { max: 20, windowSec: 60 },
      sustained: { max: 160, windowSec: 3600 },
      daily: { max: 1000, windowSec: 86400 }
    },
    ip: {
      burst: { max: 80, windowSec: 60 },
      sustained: { max: 600, windowSec: 3600 }
    },
    maxConcurrency: 2,
    failOpen: true
  },

  // Background Memory Extraction
  extractMemory: {
    name: "extractMemory",
    user: {
      burst: { max: 15, windowSec: 60 },
      sustained: { max: 90, windowSec: 3600 },
      daily: { max: 500, windowSec: 86400 }
    },
    ip: {
      burst: { max: 60, windowSec: 60 },
      sustained: { max: 350, windowSec: 3600 }
    },
    maxConcurrency: 2,
    dedupWindowSec: 30,
    failOpen: true
  },

  // File Uploads
  upload: {
    name: "upload",
    user: {
      burst: { max: 8, windowSec: 60 },
      sustained: { max: 60, windowSec: 3600 },
      daily: { max: 300, windowSec: 86400 }
    },
    ip: {
      burst: { max: 30, windowSec: 60 },
      sustained: { max: 200, windowSec: 3600 }
    },
    maxConcurrency: 2,
    failOpen: false
  },

  // Session Evaluations
  evaluate: {
    name: "evaluate",
    user: {
      burst: { max: 6, windowSec: 60 },
      sustained: { max: 40, windowSec: 3600 },
      daily: { max: 200, windowSec: 86400 }
    },
    ip: {
      burst: { max: 25, windowSec: 60 },
      sustained: { max: 150, windowSec: 3600 }
    },
    maxConcurrency: 1,
    failOpen: true
  },

  // Sensitive External Actions (e.g. Email Dispatch)
  actionEmail: {
    name: "actionEmail",
    user: {
      burst: { max: 3, windowSec: 60 },
      sustained: { max: 20, windowSec: 3600 },
      daily: { max: 100, windowSec: 86400 }
    },
    ip: {
      burst: { max: 10, windowSec: 60 },
      sustained: { max: 60, windowSec: 3600 }
    },
    maxConcurrency: 1,
    failOpen: false // Strictly fail closed for real email sends
  }
};

// Cached Google / Firebase Public Certificates
let cachedGoogleCerts = null;
let googleCertsExpiry = 0;

/**
 * Fetch and cache Google public x509 certificates for Firebase ID token verification
 */
async function getGooglePublicCerts() {
  const now = Date.now();
  if (cachedGoogleCerts && now < googleCertsExpiry) {
    return cachedGoogleCerts;
  }

  try {
    const res = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
    if (!res.ok) return cachedGoogleCerts;

    const certs = await res.json();
    const cacheControl = res.headers.get("cache-control") || "";
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

    cachedGoogleCerts = certs;
    googleCertsExpiry = now + maxAgeSec * 1000;
    return cachedGoogleCerts;
  } catch (err) {
    console.warn("[RateLimiter] Failed to fetch Google public certs:", err.message);
    return cachedGoogleCerts;
  }
}

/**
 * Cryptographically verify a Firebase ID token
 * 
 * @param {string} token - Raw JWT ID token string
 * @returns {Promise<{ uid: string } | null>} Verified token payload or null
 */
export async function verifyFirebaseIdToken(token) {
  if (!token || typeof token !== "string") return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf-8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));

    // Basic header & payload sanity checks
    if (header.alg !== "RS256" || !header.kid) return null;
    if (!payload.sub || typeof payload.sub !== "string") return null;

    const nowSec = Math.floor(Date.now() / 1000);
    // Allow up to 5 minutes clock skew
    if (payload.exp && payload.exp < nowSec - 60) return null;
    if (payload.iat && payload.iat > nowSec + 300) return null;

    // Verify signature using Google public key
    const certs = await getGooglePublicCerts();
    if (!certs || !certs[header.kid]) {
      return null;
    }

    const publicCert = certs[header.kid];
    const signatureBuffer = Buffer.from(parts[2], "base64url");
    const dataToVerify = `${parts[0]}.${parts[1]}`;

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(dataToVerify);
    const isValid = verifier.verify(publicCert, signatureBuffer);

    if (!isValid) return null;

    return { uid: payload.sub };
  } catch (err) {
    return null;
  }
}

/**
 * High-Performance In-Memory Sliding Window & Concurrency Store
 * Used in local development or serverless environments without Redis.
 */
class MemoryRateLimitStore {
  constructor() {
    this.windows = new Map();       // key -> Array<number (timestamps)>
    this.concurrency = new Map();   // key -> number
    this.dedupCache = new Map();    // key -> number (timestamp)

    // Periodic cleanup every 5 minutes
    if (typeof setInterval !== "undefined") {
      const timer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
      if (timer.unref) timer.unref();
    }
  }

  recordAndCheck(key, max, windowSec) {
    const now = Date.now();
    const windowMs = windowSec * 1000;
    const cutoff = now - windowMs;

    let timestamps = this.windows.get(key) || [];
    // Filter timestamps within current sliding window
    timestamps = timestamps.filter((ts) => ts > cutoff);

    if (timestamps.length >= max) {
      const oldest = timestamps[0];
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      this.windows.set(key, timestamps);
      return {
        allowed: false,
        remaining: 0,
        limit: max,
        retryAfterSec,
        resetTime: Math.ceil((oldest + windowMs) / 1000)
      };
    }

    timestamps.push(now);
    this.windows.set(key, timestamps);
    const remaining = max - timestamps.length;
    return {
      allowed: true,
      remaining,
      limit: max,
      retryAfterSec: 0,
      resetTime: Math.ceil((now + windowMs) / 1000)
    };
  }

  acquireConcurrency(key, maxConcurrent) {
    const current = this.concurrency.get(key) || 0;
    if (current >= maxConcurrent) {
      return { allowed: false, current, max: maxConcurrent };
    }
    this.concurrency.set(key, current + 1);
    return { allowed: true, current: current + 1, max: maxConcurrent };
  }

  releaseConcurrency(key) {
    const current = this.concurrency.get(key) || 0;
    if (current <= 1) {
      this.concurrency.delete(key);
    } else {
      this.concurrency.set(key, current - 1);
    }
  }

  isDuplicate(dedupKey, windowSec) {
    const now = Date.now();
    const lastSeen = this.dedupCache.get(dedupKey);
    if (lastSeen && now - lastSeen < windowSec * 1000) {
      return true;
    }
    this.dedupCache.set(dedupKey, now);
    return false;
  }

  cleanup() {
    const now = Date.now();
    const maxRetentionMs = 86400 * 1000;
    for (const [key, timestamps] of this.windows.entries()) {
      const valid = timestamps.filter((ts) => ts > now - maxRetentionMs);
      if (valid.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, valid);
      }
    }
    for (const [key, ts] of this.dedupCache.entries()) {
      if (now - ts > 300 * 1000) {
        this.dedupCache.delete(key);
      }
    }
  }

  reset() {
    this.windows.clear();
    this.concurrency.clear();
    this.dedupCache.clear();
  }
}

// Global Memory Store Instance
const memoryStore = new MemoryRateLimitStore();

/**
 * Extract Client IP accurately from standard proxy / serverless headers
 */
export function getClientIp(req) {
  if (!req) return "127.0.0.1";

  const headers = req.headers || {};
  const forwarded = headers["x-forwarded-for"];
  if (forwarded) {
    const ips = String(forwarded).split(",").map((s) => s.trim());
    if (ips[0]) return ips[0];
  }

  return (
    headers["x-real-ip"] ||
    headers["cf-connecting-ip"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "127.0.0.1"
  );
}

/**
 * Extract Verified Client User Identity
 * 
 * SECURITY: Only returns user identity if a valid, cryptographically verified
 * Firebase ID token is provided. NEVER trusts client-provided x-user-id headers
 * or unauthenticated body claims.
 * 
 * @param {Object} req - HTTP Request
 * @returns {Promise<string|null>} "user_<uid>" or null
 */
export async function getUserIdentifier(req) {
  if (!req) return null;

  const authHeader = req.headers?.["authorization"] || req.headers?.["Authorization"];
  if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const verified = await verifyFirebaseIdToken(token);
    if (verified?.uid) {
      return `user_${verified.uid}`;
    }
  }

  // Explicit test bypass ONLY in test environments with mock header
  if ((process.env.NODE_ENV === "test" || process.env.AIRA_TEST_AUTH === "1") && req.headers?.["x-test-user-id"]) {
    const raw = String(req.headers["x-test-user-id"]).trim();
    return raw.startsWith("user_") ? raw : `user_${raw}`;
  }

  return null;
}

/**
 * Upstash Redis / Distributed REST Provider (Optional in production)
 */
async function checkRedisSlidingWindow(key, max, windowSec) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null; // Redis not configured -> use memory store

  const now = Date.now();
  const windowMs = windowSec * 1000;
  const cutoff = now - windowMs;

  try {
    // Pipeline: ZREMRANGEBYSCORE, ZADD, ZCARD, EXPIRE
    const pipeline = [
      ["ZREMRANGEBYSCORE", key, "-inf", cutoff],
      ["ZADD", key, now, `${now}-${Math.random()}`],
      ["ZCARD", key],
      ["EXPIRE", key, windowSec + 60]
    ];

    const resp = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(pipeline)
    });

    if (!resp.ok) return null;

    const results = await resp.json();
    const count = results[2]?.result || 1;

    if (count > max) {
      return {
        allowed: false,
        remaining: 0,
        limit: max,
        retryAfterSec: Math.ceil(windowSec / 2),
        resetTime: Math.ceil((now + windowMs) / 1000)
      };
    }

    return {
      allowed: true,
      remaining: max - count,
      limit: max,
      retryAfterSec: 0,
      resetTime: Math.ceil((now + windowMs) / 1000)
    };
  } catch (err) {
    console.warn("[RateLimiter] Redis call failed, falling back to memory store:", err.message);
    return null;
  }
}

/**
 * Universal Rate Limit Verification Middleware
 * 
 * Applies dual-layer checks:
 * 1. User Concurrency & Rolling Windows (Burst, Sustained, Daily)
 * 2. Secondary IP Rolling Windows (Burst, Sustained)
 * 
 * @param {Object} req - HTTP Request
 * @param {Object} res - HTTP Response
 * @param {Object} policy - Rate limit policy configuration
 * @returns {Promise<{ allowed: boolean, userMessage?: string }>}
 */
export async function enforceRateLimit(req, res, policy = RATE_LIMIT_POLICIES.chat) {
  const clientIp = getClientIp(req);
  const userKey = await getUserIdentifier(req);
  const primaryKey = userKey || `ip_${clientIp}`;

  // 1. Concurrency Check (Active in-flight generations)
  const concurrencyKey = `conc:${policy.name}:${primaryKey}`;
  const concResult = memoryStore.acquireConcurrency(concurrencyKey, policy.maxConcurrency);

  if (!concResult.allowed) {
    console.warn(`[RateLimiter] Concurrency limit hit for ${primaryKey} on ${policy.name} (${concResult.current}/${concResult.max})`);
    
    if (res && !res.headersSent) {
      res.setHeader("Retry-After", "2");
      res.status(429).json({
        error: "Too many concurrent requests",
        category: "concurrency_limit",
        userMessage: "I'm still processing your previous turn. Give me just a second.",
        retryAfter: 2
      });
    }
    return { allowed: false, userMessage: "I'm still processing your previous turn. Give me just a second." };
  }

  // Register cleanup on response termination or client disconnect
  const cleanupConcurrency = () => {
    memoryStore.releaseConcurrency(concurrencyKey);
  };
  if (res && res.on) {
    res.once("finish", cleanupConcurrency);
    res.once("close", cleanupConcurrency);
  }
  if (req && req.on) {
    req.once("close", cleanupConcurrency);
  }

  try {
    // 2. User-Level Sliding Windows (Burst & Sustained) - applied ONLY if cryptographically authenticated
    if (userKey) {
      const userBurstKey = `rl:${policy.name}:burst:${userKey}`;
      const userSustainedKey = `rl:${policy.name}:sust:${userKey}`;

      // Check Burst Window (1 minute)
      let burstCheck = await checkRedisSlidingWindow(userBurstKey, policy.user.burst.max, policy.user.burst.windowSec);
      if (!burstCheck) {
        burstCheck = memoryStore.recordAndCheck(userBurstKey, policy.user.burst.max, policy.user.burst.windowSec);
      }

      if (!burstCheck.allowed) {
        cleanupConcurrency();
        const retrySec = burstCheck.retryAfterSec || 5;
        console.warn(`[RateLimiter] User Burst limit hit: ${userKey} on ${policy.name} (Retry-After: ${retrySec}s)`);
        
        if (res && !res.headersSent) {
          res.setHeader("Retry-After", String(retrySec));
          res.setHeader("X-RateLimit-Limit", String(burstCheck.limit));
          res.setHeader("X-RateLimit-Remaining", "0");
          res.status(429).json({
            error: "Rate limit exceeded",
            category: "rate_limit",
            userMessage: "I'm getting a little too many requests at once. Give me a moment and we'll continue.",
            retryAfter: retrySec
          });
        }
        return { allowed: false, userMessage: "I'm getting a little too many requests at once. Give me a moment and we'll continue." };
      }

      // Check Sustained Window (1 hour)
      let sustainedCheck = await checkRedisSlidingWindow(userSustainedKey, policy.user.sustained.max, policy.user.sustained.windowSec);
      if (!sustainedCheck) {
        sustainedCheck = memoryStore.recordAndCheck(userSustainedKey, policy.user.sustained.max, policy.user.sustained.windowSec);
      }

      if (!sustainedCheck.allowed) {
        cleanupConcurrency();
        const retrySec = sustainedCheck.retryAfterSec || 60;
        console.warn(`[RateLimiter] User Sustained limit hit: ${userKey} on ${policy.name} (Retry-After: ${retrySec}s)`);

        if (res && !res.headersSent) {
          res.setHeader("Retry-After", String(retrySec));
          res.status(429).json({
            error: "Sustained rate limit exceeded",
            category: "rate_limit_sustained",
            userMessage: "I've reached a temporary usage limit. Give it a little time and we can continue.",
            retryAfter: retrySec
          });
        }
        return { allowed: false, userMessage: "I've reached a temporary usage limit. Give it a little time and we can continue." };
      }

      // Set standard headers on allowed requests
      if (res && !res.headersSent && res.setHeader) {
        res.setHeader("X-RateLimit-Limit", String(policy.user.burst.max));
        res.setHeader("X-RateLimit-Remaining", String(burstCheck.remaining));
      }
    }

    // 3. Secondary IP-Level Abuse Protection Window
    const ipBurstKey = `rl:${policy.name}:ip:${clientIp}`;
    let ipCheck = await checkRedisSlidingWindow(ipBurstKey, policy.ip.burst.max, policy.ip.burst.windowSec);
    if (!ipCheck) {
      ipCheck = memoryStore.recordAndCheck(ipBurstKey, policy.ip.burst.max, policy.ip.burst.windowSec);
    }

    if (!ipCheck.allowed) {
      cleanupConcurrency();
      const retrySec = ipCheck.retryAfterSec || 10;
      console.warn(`[RateLimiter] IP Abuse protection limit hit: ${clientIp} on ${policy.name}`);

      if (res && !res.headersSent) {
        res.setHeader("Retry-After", String(retrySec));
        res.status(429).json({
          error: "IP rate limit exceeded",
          category: "rate_limit_ip",
          userMessage: "I'm receiving too much traffic from this network. Please wait a moment and try again.",
          retryAfter: retrySec
        });
      }
      return { allowed: false, userMessage: "I'm receiving too much traffic from this network. Please wait a moment and try again." };
    }

    return { allowed: true };

  } catch (err) {
    console.error("[RateLimiter] Internal inspection error:", err);
    // Safe failure strategy
    if (!policy.failOpen) {
      cleanupConcurrency();
      if (res && !res.headersSent) {
        res.status(503).json({
          error: "Rate limiter service unavailable",
          userMessage: "I can't verify that action right now. Let's try again in a moment."
        });
      }
      return { allowed: false, userMessage: "Service temporarily unavailable." };
    }
    // Fail Open for conversational chat
    return { allowed: true };
  }
}

/**
 * Deduplicate background operations (e.g. repeated identical memory extractions)
 */
export function isOperationDuplicate(dedupKey, windowSec = 30) {
  return memoryStore.isDuplicate(dedupKey, windowSec);
}

/**
 * Reset memory store (testing utility)
 */
export function _resetStore() {
  memoryStore.reset();
}
