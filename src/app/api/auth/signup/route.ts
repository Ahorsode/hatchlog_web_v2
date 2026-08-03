import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { normalizePhoneNumber } from '@/lib/auth-utils';
import { checkRateLimit, getRateLimitIp, rateLimitHeaders } from '@/lib/performance/rate-limit';
import { MAX_PASSWORD_LENGTH, passwordPolicyError } from '@/lib/password-policy';
import { z } from 'zod';
import { hatchlogBootstrapProfile, hatchlogProfileByIdentity } from '@/lib/hatchlog-api';

const signupSchema = z.object({
  firstname: z.string().trim().min(1, 'First name is required').max(100),
  surname: z.string().trim().max(100).optional().default(''),
  email: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().email('Invalid email address').max(255).nullable().optional(),
  ),
  phoneNumber: z.string().trim().min(7, 'Phone number too short').max(20),
  password: z.preprocess(
    (value) => (typeof value === 'string' && value.length === 0 ? undefined : value),
    z.string().max(MAX_PASSWORD_LENGTH, `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer`).optional(),
  ),
});

export async function POST(req: Request) {
  try {
    const limit = await checkRateLimit({
      policy: 'auth.signup',
      scope: 'api-signup',
      ip: getRateLimitIp(req),
    });

    if (!limit.ok) {
      return NextResponse.json(
        {
          message: 'Too many signup attempts. Please wait and try again.',
          code: 429,
          retryAfterSec: limit.retryAfterSec,
        },
        { status: 429, headers: rateLimitHeaders(limit) },
      );
    }

    const body = await req.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    const { firstname, surname, email, phoneNumber, password } = parsed.data;
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const cleanEmail = email ?? undefined;

    const existing = await hatchlogProfileByIdentity(cleanEmail, normalizedPhone || phoneNumber);
    if (existing && existing.id) {
      return NextResponse.json({ message: 'User already exists' }, { status: 400 });
    }

    const rawPassword = password;
    if (!rawPassword) {
      return NextResponse.json({ message: 'Password is required' }, { status: 400 });
    }

    const passwordError = passwordPolicyError(rawPassword);
    if (passwordError) {
      return NextResponse.json({ message: passwordError }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const result = await hatchlogBootstrapProfile({
      email: cleanEmail,
      phoneNumber: normalizedPhone || phoneNumber,
      firstname: firstname || '',
      surname: surname || '',
      passwordHash: hashedPassword,
    });

    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: result.userId,
        firstname,
        surname,
        email: cleanEmail || null,
        phoneNumber: normalizedPhone || phoneNumber,
        mustChangePassword: false,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error during signup:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
