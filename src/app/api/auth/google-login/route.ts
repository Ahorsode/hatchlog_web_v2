import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import prisma from "@/lib/db";
import { encode } from "next-auth/jwt";
import { completeGoogleSignIn, recordUserSession } from "@/lib/auth-utils";
import { checkRateLimit, getRateLimitIp, rateLimitHeaders } from "@/lib/performance/rate-limit";

const client = new OAuth2Client(process.env.AUTH_GOOGLE_ID);

export async function POST(req: Request) {
  try {
    const authSecret = process.env.AUTH_SECRET;
    const googleClientId = process.env.AUTH_GOOGLE_ID;
    if (!authSecret || !googleClientId) {
      return NextResponse.json({ error: "Server auth configuration is missing" }, { status: 500 });
    }

    const json = await req.json();
    const { idToken, deviceType } = json;

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    const limit = await checkRateLimit({
      policy: "auth.signup",
      scope: "google-login",
      ip: getRateLimitIp(req),
    });

    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: rateLimitHeaders(limit) },
      );
    }

    // Verify the ID token from Flutter
    const ticket = await client.verifyIdToken({
      idToken,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return NextResponse.json({ error: "Invalid token payload" }, { status: 401 });
    }

    const { email: rawEmail, name, picture, sub: googleId } = payload;
    const email = rawEmail.toLowerCase().trim();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          {
            accounts: {
              some: { provider: "google", providerAccountId: googleId },
            },
          },
        ],
      },
      select: { id: true },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "No account found for this Google account. Please register via the web app first." },
        { status: 403 },
      );
    }

    await completeGoogleSignIn(existingUser.id);

    const user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name,
        image: picture,
        mustChangePassword: false,
      },
    });

    const membership = await prisma.farmMember.findFirst({
      where: { userId: user.id },
      select: { farmId: true, role: true }
    });

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, mustChangePassword: true, sessionVersion: true }
    });

    // Create a NextAuth session JWT
    const token = await encode({
      token: {
        sub: user.id,
        email: user.email,
        name: user.name,
        picture: user.image,
        role: dbUser?.role ?? 'OWNER',
        activeFarmId: membership?.farmId ?? null,
        mustChangePassword: dbUser?.mustChangePassword ?? false,
        sessionVersion: dbUser?.sessionVersion ?? 1,
        securityInvalidated: false,
        securityNotice: null,
      },
      secret: authSecret,
      salt: "authjs.session-token",
    });
    
    // Record the session (Web if cookie set, else Desktop/Mobile from deviceType)
    await recordUserSession(user.id, deviceType || 'Desktop');

    const response = NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token: token // For Flutter to use in Authorization header
    });

    // Set cookie for browser-based access (useful if Flutter uses a webview or for testing)
    response.cookies.set("authjs.session-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;

  } catch (error) {
    console.error("Error in google-login:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
