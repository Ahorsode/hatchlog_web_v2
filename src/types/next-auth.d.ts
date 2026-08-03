import NextAuth, { type DefaultSession, type DefaultUser } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      activeFarmId?: string;
      mustChangePassword?: boolean;
      sessionVersion?: number;
      securityInvalidated?: boolean;
      securityNotice?: string | null;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role: string;
    activeFarmId?: string;
    mustChangePassword?: boolean;
    sessionVersion?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    activeFarmId?: string;
    mustChangePassword?: boolean;
    sessionVersion?: number;
    securityInvalidated?: boolean;
    securityNotice?: string | null;
  }
}
