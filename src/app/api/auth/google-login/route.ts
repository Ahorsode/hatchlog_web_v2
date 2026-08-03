import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { hatchlogProfileByIdentity } from "@/lib/hatchlog-api";
import { checkRateLimit, getRateLimitIp, rateLimitHeaders } from "@/lib/performance/rate-limit";

const client = new OAuth2Client(process.env.AUTH_GOOGLE_ID);

export async function POST(req: Request) {
  try {
    const googleClientId = process.env.AUTH_GOOGLE_ID;
    if (!googleClientId) {
      return NextResponse.json({ error: "Server auth configuration is missing" }, { status: 500 });
    }

    const json = await req.json();
    const { idToken } = json;

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

    const ticket = await client.verifyIdToken({
      idToken,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return NextResponse.json({ error: "Invalid token payload" }, { status: 401 });
    }

    const { email: rawEmail, name } = payload;
    const email = rawEmail.toLowerCase().trim();

    const existingUser = await hatchlogProfileByIdentity(email);

    if (!existingUser) {
      return NextResponse.json(
        { error: "No account found for this Google account. Please register via the web app first." },
        { status: 403 },
      );
    }

    // Phase 2: Google login now handled via Supabase OAuth.
    // This endpoint validates the token and confirms the user exists.
    // The actual session is managed by Supabase on the client side.
    return NextResponse.json({
      success: true,
      user: {
        id: existingUser.id,
        email: existingUser.email,
        name: [existingUser.firstname, existingUser.surname].filter(Boolean).join(' ') || name,
      },
    });
  } catch (error) {
    console.error("Error in google-login:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
