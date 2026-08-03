import NextAuth from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authConfig } from './auth.config';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import {
  acceptPendingInvitationForUser,
  completeGoogleSignIn,
  findUserByLoginIdentifier,
  normalizePhoneNumber,
  recordUserSession,
  WORKER_PLACEHOLDER_PASSWORD,
} from '@/lib/auth-utils';
import { getCachedSessionVersion, setCachedSessionVersion } from '@/lib/performance/session-version-cache';
import { checkRateLimit } from '@/lib/performance/rate-limit';

const SECURITY_PERMISSION_UPDATE_MESSAGE = 'Your security permissions have been updated. Please sign in again to activate your new features.';

type SessionUpdatePayload = {
  mustChangePassword?: boolean;
  name?: string;
};

function splitName(name: string | null | undefined) {
  if (!name) return { firstname: '', surname: '', middleName: '' };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstname: parts[0], surname: '', middleName: '' };
  if (parts.length === 2) return { firstname: parts[0], surname: parts[1], middleName: '' };
  return {
    firstname: parts[0],
    surname: parts[parts.length - 1],
    middleName: parts.slice(1, -1).join(' ')
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  adapter: PrismaAdapter(prisma) as Adapter,
  session: { strategy: "jwt" },
  events: {
    async createUser({ user }) {
      if (!user.id) return

      if (user.name) {
        const { firstname, surname, middleName } = splitName(user.name);
        await prisma.user.update({
          where: { id: user.id },
          data: { firstname, surname, middleName }
        });
      }

      // Brand-new Google accounts may still need a pending email invite linked.
      if (user.email) {
        try {
          await acceptPendingInvitationForUser(user.id);
        } catch (err) {
          console.error('[auth] createUser invitation accept failed', {
            userId: user.id,
            err,
          });
        }
      }
    },
    async signIn({ user, account }) {
      if (user.id) {
        try {
          await recordUserSession(user.id, 'Web');
        } catch (err) {
          console.error('[auth] recordUserSession failed', {
            userId: user.id,
            provider: account?.provider,
            err,
          });
        }

        if (account?.provider === 'google') {
          try {
            await completeGoogleSignIn(user.id);
          } catch (err) {
            console.error('[auth] Google post-login setup failed', {
              userId: user.id,
              err,
            });
          }
        }

        console.log('[auth] signIn success', {
          userId: user.id,
          provider: account?.provider ?? 'credentials',
        });
      }
    }
  },
  callbacks: {
    ...authConfig.callbacks,
    // Never block OAuth here — DB work runs after auth in jwt/events handlers.
    async signIn() {
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      // On login, hydrate token from the database so OAuth sessions get farm access.
      if (user?.id) {
        let acceptedFarmId: string | null | undefined
        if (account?.provider === 'google') {
          try {
            acceptedFarmId = await completeGoogleSignIn(user.id);
          } catch (err) {
            console.error('[auth] Google JWT setup failed', {
              userId: user.id,
              err,
            });
          }
        }

        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            role: true,
            mustChangePassword: true,
            sessionVersion: true,
          },
        });
        const membership = await prisma.farmMember.findFirst({
          where: { userId: user.id },
          select: { farmId: true },
        });

        token.id = user.id;
        token.role = dbUser?.role ?? user.role;
        token.mustChangePassword = account?.provider === 'google'
          ? false
          : (dbUser?.mustChangePassword ?? false);
        token.sessionVersion = dbUser?.sessionVersion ?? 1;
        token.activeFarmId = membership?.farmId ?? acceptedFarmId ?? undefined;
        token.securityInvalidated = false;
        token.securityNotice = null;
      }

      if (trigger === "update" && session) {
        const update = session as SessionUpdatePayload;
        token.mustChangePassword = update.mustChangePassword;
        if (update.name) token.name = update.name;
      }

      if (token.id) {
        try {
          const userId = token.id as string;
          const tokenVersion = typeof token.sessionVersion === 'number' ? token.sessionVersion : null;
          const cachedVersion = await getCachedSessionVersion(userId);

          if (tokenVersion !== null && cachedVersion !== null && cachedVersion <= tokenVersion) {
            token.securityInvalidated = false;
            token.securityNotice = null;
          } else {
            const dbUser = await prisma.user.findUnique({
              where: { id: userId },
              select: {
                role: true,
                mustChangePassword: true,
                sessionVersion: true,
                securityNotice: true
              }
            });

            if (dbUser) {
              const currentTokenVersion = tokenVersion ?? dbUser.sessionVersion;
              const sessionWasRevoked = currentTokenVersion < dbUser.sessionVersion;

              token.role = dbUser.role;
              token.mustChangePassword = dbUser.mustChangePassword;
              await setCachedSessionVersion(userId, dbUser.sessionVersion);

              if (sessionWasRevoked) {
                token.securityInvalidated = true;
                token.securityNotice = dbUser.securityNotice || SECURITY_PERMISSION_UPDATE_MESSAGE;
              } else {
                token.sessionVersion = dbUser.sessionVersion;
                token.securityInvalidated = false;
                token.securityNotice = null;
              }
            }
          }
        } catch (err) {
          console.error('[JWT] Failed to refresh security metadata:', err);
        }
      }
      
      // If activeFarmId is missing from token (e.g. user onboarded after login)
      // refresh it from the database on every request
      if (token.id && !token.activeFarmId) {
        try {
          const membership = await prisma.farmMember.findFirst({
            where: { userId: token.id as string },
            select: { farmId: true }
          });
          if (membership?.farmId) {
            token.activeFarmId = membership.farmId;
          }
        } catch (err) {
          console.error('[JWT] Failed to refresh activeFarmId:', err);
        }
      }
      
      return token;
    },
  },
  providers: [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
        // Invited workers are pre-created by email before they link Google.
        allowDangerousEmailAccountLinking: true,
        profile(profile) {
          return {
            id: profile.sub,
            name: profile.name,
            email: profile.email?.toLowerCase().trim() ?? profile.email,
            image: profile.picture,
            role: 'OWNER',
          };
        },
      })
    ] : []),
    Credentials({
      name: 'Credentials',
      credentials: {
        identifier: { label: "Email or Phone", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.identifier || !credentials?.password) return null;
        
        // ── Retrieve IP address for rate-limiting ─────────────────────────
        let ip = 'unknown';
        try {
          if (req && req.headers) {
            if (typeof (req.headers as any).get === 'function') {
              ip = (req.headers as any).get('x-real-ip') || (req.headers as any).get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
            } else if (typeof req.headers === 'object') {
              const headersMap = req.headers as any;
              ip = headersMap['x-real-ip'] || headersMap['x-forwarded-for']?.split(',').at(-1)?.trim() || 'unknown';
            }
          } else {
            const { headers } = await import('next/headers');
            const reqHeaders = await headers();
            ip = reqHeaders.get('x-real-ip') || reqHeaders.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
          }
        } catch (e) {
          console.error('[auth] failed to retrieve client IP:', e);
        }

        // ── Rate-limit check (brute-force protection) ─────────────────────
        const rl = await checkRateLimit({
          policy: 'auth.signin',
          ip: ip,
        });
        if (!rl.ok) {
          console.warn('[auth] credentials signin rate-limited', { ip });
          return null;
        }
        // ─────────────────────────────────────────────────────────────────

        let identifier = credentials.identifier as string;
        const password = credentials.password as string;

        // If it's not an email, normalize it as a phone number
        if (!identifier.includes('@')) {
          identifier = normalizePhoneNumber(identifier) || identifier;
        }

        const user = await findUserByLoginIdentifier(identifier);

        if (user && user.password) {
          let isValid = await bcrypt.compare(password, user.password);

          // Legacy invited workers may still have a random temp hash from before
          // placeholder-password rollout. Accept the shared first-login password
          // and normalize the stored hash going forward.
          if (
            !isValid &&
            user.mustChangePassword &&
            password === WORKER_PLACEHOLDER_PASSWORD
          ) {
            const hashedPlaceholder = await bcrypt.hash(WORKER_PLACEHOLDER_PASSWORD, 10);
            await prisma.user.update({
              where: { id: user.id },
              data: {
                password: hashedPlaceholder,
                mustChangePassword: true,
              },
            });
            isValid = true;
          }

          if (!isValid) {
            console.warn('[auth] credentials signin failed: wrong password', {
              identifier: identifier.includes('@') ? identifier : '[phone]',
            });
            return null;
          }

          const acceptedFarmId = await acceptPendingInvitationForUser(user.id);

          const membership = await prisma.farmMember.findFirst({
            where: { userId: user.id },
          });
          
          return {
            id: user.id,
            email: user.email,
            name: `${user.firstname} ${user.surname}`,
            role: user.role,
            mustChangePassword: user.mustChangePassword,
            sessionVersion: user.sessionVersion,
            activeFarmId: membership?.farmId ?? acceptedFarmId ?? undefined,
          }; 
        }

        console.warn('[auth] credentials signin failed: user not found or no password', {
          identifier: identifier.includes('@') ? identifier : '[phone]',
        });
        return null;
      }
    }),
  ],
});
