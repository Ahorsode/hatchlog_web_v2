import { describe, it, expect, vi, beforeEach } from "vitest";

describe("rate limiter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  });

  it("allows requests in development mode", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { checkRateLimit } = await import("../rate-limit");

    const result = await checkRateLimit({ policy: "auth.signup", scope: "test-key" });

    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(result.limit);
  });

  it("prefers x-real-ip over a spoofable x-forwarded-for header", async () => {
    const { getRateLimitIp } = await import("../rate-limit");
    const headers = new Headers({
      "x-real-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.1, 198.51.100.2",
    });

    expect(getRateLimitIp({ headers })).toBe("203.0.113.10");
  });

  it("uses the last forwarded-for hop only as a fallback", async () => {
    const { getRateLimitIp } = await import("../rate-limit");
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.1, 198.51.100.2",
    });

    expect(getRateLimitIp({ headers })).toBe("198.51.100.2");
  });

  it("fails closed in production when Redis is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { checkRateLimit } = await import("../rate-limit");

    const result = await checkRateLimit({
      policy: "auth.signup",
      scope: "test-production-fallback",
      ip: "203.0.113.20",
    });

    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSec).toBeGreaterThan(0);
  });
});
