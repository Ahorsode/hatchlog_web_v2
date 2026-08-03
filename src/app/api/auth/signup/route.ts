import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { normalizePhoneNumber } from '@/lib/auth-utils';
import { checkRateLimit, getRateLimitIp, rateLimitHeaders } from '@/lib/performance/rate-limit';
import { MAX_PASSWORD_LENGTH, passwordPolicyError } from '@/lib/password-policy';
import { z } from 'zod';

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

    // Ensure email is null if empty string to avoid unique constraint issues
    const cleanEmail = email ?? null;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: normalizedPhone || phoneNumber },
          ...(cleanEmail ? [{ email: cleanEmail }] : [])
        ]
      }
    });

    // If user exists and already has a password, it's a real duplicate.
    // If user exists and doesn't have a password (or is invited), we can update them.
    if (existingUser && existingUser.password && !existingUser.mustChangePassword) {
      return NextResponse.json({ message: 'User already exists and is fully registered' }, { status: 400 });
    }

    // Check for invitations
    const invitation = await prisma.invitation.findFirst({
      where: {
        OR: [
          { phoneNumber: normalizedPhone || phoneNumber },
          ...(cleanEmail ? [{ email: cleanEmail }] : [])
        ],
        status: 'PENDING'
      }
    });

    // Handle password
    // If invited, we use a secure random token as default if no password provided
    const rawPassword = password || (invitation ? randomBytes(16).toString('hex') : null);
    
    if (!rawPassword) {
      return NextResponse.json({ message: 'Password is required' }, { status: 400 });
    }

    const passwordError = passwordPolicyError(rawPassword);
    if (passwordError) {
      return NextResponse.json({ message: passwordError }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    
    // Invited users must set a password they know after the random temporary credential.
    const mustChangePassword = !!invitation;

    // Create or Update the user and associated resources in a transaction
    const user = await prisma.$transaction(async (tx) => {
      let txUser;
      if (existingUser) {
        txUser = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            firstname: firstname || '',
            surname: surname || '',
            email: cleanEmail || existingUser.email,
            password: hashedPassword,
            mustChangePassword,
            role: invitation?.role || existingUser.role || 'OWNER',
          }
        });
      } else {
        txUser = await tx.user.create({
          data: {
            firstname: firstname || '',
            surname: surname || '',
            email: cleanEmail,
            phoneNumber: normalizedPhone || phoneNumber,
            password: hashedPassword,
            mustChangePassword,
            role: invitation?.role || 'OWNER',
          }
        });
      }

      // If there's an invitation, link to farm and update invitation
      if (invitation) {
        await tx.farmMember.create({
          data: {
            farmId: invitation.farmId,
            userId: txUser.id,
            role: invitation.role
          }
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'ACCEPTED' }
        });
      } else if (!existingUser || !existingUser.password) {
        // Create default farm for new standalone owners
        const newFarm = await tx.farm.create({
          data: {
            name: `${firstname || 'My'}'s Farm`,
            userId: txUser.id,
            capacity: 0,
            location: '',
          }
        });

        await tx.farmMember.create({
          data: {
            farmId: newFarm.id,
            userId: txUser.id,
            role: 'OWNER'
          }
        });
      }

      return txUser;
    });

    return NextResponse.json({ 
      message: 'User created successfully', 
      user: {
        id: user.id,
        firstname: user.firstname,
        surname: user.surname,
        email: user.email,
        phoneNumber: user.phoneNumber,
        mustChangePassword: user.mustChangePassword
      } 
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error during signup:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
