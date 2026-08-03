import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateLimitPolicy = {
  limit: number;
  window: `${number} ${"s" | "m" | "h" | "d"}`;
  sensitivity: "public" | "authenticated" | "financial" | "admin";
};

export type RateLimitPolicyName =
  | "auth.signup"
  | "auth.signin"
  | "admin.login"
  | "farm.onboarding"
  | "farm.profile"
  | "team.invite"
  | "team.permissions"
  | "finance.write"
  | "inventory.write"
  | "production.write"
  | "feed.write"
  | "sales.write"
  | "orders.write"
  | "license.activate"
  | "audit.restore";

type RateLimitInput = {
  policy: RateLimitPolicyName;
  scope?: string;
  userId?: string | null;
  farmId?: string | null;
  ip?: string | null;
};

type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfterSec: number;
  key: string;
  policy: RateLimitPolicyName;
};

const RATE_LIMIT_POLICIES: Record<RateLimitPolicyName, RateLimitPolicy> = {
  "auth.signup": { limit: 8, window: "1 m", sensitivity: "public" },
  "auth.signin": { limit: 10, window: "15 m", sensitivity: "public" },
  "admin.login": { limit: 5, window: "15 m", sensitivity: "admin" },
  "farm.onboarding": { limit: 6, window: "1 m", sensitivity: "authenticated" },
  "farm.profile": { limit: 10, window: "1 m", sensitivity: "authenticated" },
  "team.invite": { limit: 10, window: "1 m", sensitivity: "authenticated" },
  "team.permissions": { limit: 20, window: "1 m", sensitivity: "admin" },
  "finance.write": { limit: 12, window: "1 m", sensitivity: "financial" },
  "inventory.write": { limit: 20, window: "1 m", sensitivity: "authenticated" },
  "production.write": { limit: 24, window: "1 m", sensitivity: "authenticated" },
  "feed.write": { limit: 20, window: "1 m", sensitivity: "authenticated" },
  "sales.write": { limit: 18, window: "1 m", sensitivity: "financial" },
  "orders.write": { limit: 18, window: "1 m", sensitivity: "financial" },
  "license.activate": { limit: 10, window: "1 m", sensitivity: "public" },
  "audit.restore": { limit: 8, window: "1 m", sensitivity: "admin" },
};

const memoryStore = new Map<string, { timestamps: number[] }>();
const limiterCache = new Map<RateLimitPolicyName, Ratelimit>();

function nowMs() {
  return Date.now();
}

function parseWindowMs(window: RateLimitPolicy["window"]) {
  const [amountText, unit] = window.split(" ") as [string, "s" | "m" | "h" | "d"];
  const amount = Number(amountText);
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * multipliers[unit];
}

function buildKey(input: RateLimitInput) {
  const principal = input.userId || input.ip || "anonymous";
  const farm = input.farmId || "global";
  const scope = input.scope || input.policy;
  return `rl:${input.policy}:${scope}:${farm}:${principal}`;
}

export function getRateLimitIp(req: Pick<Request, "headers">) {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    "unknown"
  );
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function getLimiter(policyName: RateLimitPolicyName) {
  const existing = limiterCache.get(policyName);
  if (existing) return existing;

  const redis = getRedis();
  if (!redis) return null;

  const policy = RATE_LIMIT_POLICIES[policyName];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(policy.limit, policy.window),
    analytics: true,
    prefix: "poultry-pms",
  });
  limiterCache.set(policyName, limiter);
  return limiter;
}

function productionFallbackResult(input: RateLimitInput, key: string, policy: RateLimitPolicy): RateLimitResult {
  const failClosed = process.env.RATE_LIMIT_FAIL_OPEN !== "true";
  return {
    ok: !failClosed,
    limit: policy.limit,
    remaining: failClosed ? 0 : policy.limit,
    reset: nowMs() + parseWindowMs(policy.window),
    retryAfterSec: failClosed ? 30 : 0,
    key,
    policy: input.policy,
  };
}

async function consumeMemoryLimit(input: RateLimitInput, key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  const windowMs = parseWindowMs(policy.window);
  const now = nowMs();
  const current = memoryStore.get(key)?.timestamps ?? [];
  const timestamps = current.filter((timestamp) => now - timestamp < windowMs);
  timestamps.push(now);
  memoryStore.set(key, { timestamps });

  const oldest = timestamps[0] ?? now;
  const reset = oldest + windowMs;
  const remaining = Math.max(0, policy.limit - timestamps.length);

  return {
    ok: timestamps.length <= policy.limit,
    limit: policy.limit,
    remaining,
    reset,
    retryAfterSec: Math.max(1, Math.ceil((reset - now) / 1000)),
    key,
    policy: input.policy,
  };
}

function isRateLimitDisabled() {
  // Only local development may bypass limits; production cannot be disabled by env toggle.
  return process.env.NODE_ENV === "development";
}

function allowResult(input: RateLimitInput, policy: RateLimitPolicy, key: string): RateLimitResult {
  return {
    ok: true,
    limit: policy.limit,
    remaining: policy.limit,
    reset: nowMs() + parseWindowMs(policy.window),
    retryAfterSec: 0,
    key,
    policy: input.policy,
  };
}

export async function checkRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const policy = RATE_LIMIT_POLICIES[input.policy];
  const key = buildKey(input);

  if (isRateLimitDisabled()) {
    return allowResult(input, policy, key);
  }

  const limiter = getLimiter(input.policy);

  if (!limiter) {
    if (process.env.NODE_ENV === "production") {
      const hasConfig = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
      if (!hasConfig) {
        console.warn("[rate-limit] Upstash Redis environment variables are missing in production. Bypassing rate limit check to prevent application lockout.");
        return allowResult(input, policy, key);
      }
      return productionFallbackResult(input, key, policy);
    }

    // Use in-memory sliding window outside production when Redis is unavailable.
    return consumeMemoryLimit(input, key, policy);
  }

  try {
    const result = await limiter.limit(key);
    return {
      ok: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      retryAfterSec: Math.max(1, Math.ceil((result.reset - nowMs()) / 1000)),
      key,
      policy: input.policy,
    };
  } catch (error) {
    console.error("[rate-limit] limiter failure", {
      policy: input.policy,
      key,
      error,
    });

    if (process.env.NODE_ENV === "production") {
      return productionFallbackResult(input, key, policy);
    }
    return consumeMemoryLimit(input, key, policy);
  }
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
    "Retry-After": String(result.retryAfterSec),
  };
}

export function rateLimitActionError(result: RateLimitResult) {
  return {
    success: false,
    error: "Too many requests. Please wait and try again.",
    code: 429,
    retryAfterSec: result.retryAfterSec,
  };
}
