import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  farmMemberFindFirst: vi.fn(),
  checkRateLimit: vi.fn(),
  encode: vi.fn(),
  recordUserSession: vi.fn(),
  acceptPendingInvitationForUser: vi.fn(),
  completeGoogleSignIn: vi.fn(),
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn(function OAuth2Client() {
    return {
      verifyIdToken: mocks.verifyIdToken,
    };
  }),
}));

vi.mock("@/lib/db", () => ({
  default: {
    user: {
      findFirst: mocks.userFindFirst,
      update: mocks.userUpdate,
      findUnique: mocks.userFindUnique,
    },
    farmMember: {
      findFirst: mocks.farmMemberFindFirst,
    },
  },
}));

vi.mock("next-auth/jwt", () => ({
  encode: mocks.encode,
}));

vi.mock("@/lib/auth-utils", () => ({
  recordUserSession: mocks.recordUserSession,
  acceptPendingInvitationForUser: mocks.acceptPendingInvitationForUser,
  completeGoogleSignIn: mocks.completeGoogleSignIn,
}));

vi.mock("@/lib/performance/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/performance/rate-limit")>(
    "@/lib/performance/rate-limit",
  );

  return {
    ...actual,
    checkRateLimit: mocks.checkRateLimit,
  };
});

describe("google-login route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("AUTH_SECRET", "test-auth-secret-value");
    vi.stubEnv("AUTH_GOOGLE_ID", "google-client-id");
    mocks.checkRateLimit.mockResolvedValue({
      ok: true,
      limit: 8,
      remaining: 7,
      reset: Date.now() + 60_000,
      retryAfterSec: 0,
      key: "rl:auth.signup:google-login:global:203.0.113.1",
      policy: "auth.signup",
    });
    mocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "user@example.com",
        name: "Example User",
        picture: "https://example.com/avatar.png",
        sub: "google-subject",
      }),
    });
  });

  function request() {
    return new Request("https://example.com/api/auth/google-login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-real-ip": "203.0.113.1",
        "x-forwarded-for": "198.51.100.1",
      },
      body: JSON.stringify({ idToken: "google-id-token", deviceType: "Mobile" }),
    });
  }

  it("rejects valid Google tokens that do not map to an existing account", async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(request());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/No account found/i),
    });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.encode).not.toHaveBeenCalled();
  });

  it("updates and signs in an existing account without creating a user", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: "user-1" });
    mocks.userUpdate.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "Example User",
      image: "https://example.com/avatar.png",
    });
    mocks.farmMemberFindFirst.mockResolvedValue({ farmId: "farm-1", role: "OWNER" });
    mocks.userFindUnique.mockResolvedValue({
      role: "OWNER",
      mustChangePassword: false,
      sessionVersion: 3,
    });
    mocks.encode.mockResolvedValue("signed-session-token");
    mocks.completeGoogleSignIn.mockResolvedValue("farm-1");
    const { POST } = await import("./route");

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      token: "signed-session-token",
      user: { id: "user-1", email: "user@example.com" },
    });
    expect(mocks.userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true },
      }),
    );
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        name: "Example User",
        image: "https://example.com/avatar.png",
        mustChangePassword: false,
      },
    });
    expect(mocks.recordUserSession).toHaveBeenCalledWith("user-1", "Mobile");
    expect(mocks.completeGoogleSignIn).toHaveBeenCalledWith("user-1");
  });
});
