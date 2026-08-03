import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { SECURITY_PERMISSION_UPDATE_MESSAGE } from '@/lib/auth-utils';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, revoked: false }, { status: 401 });
  }

  const sessionUser = session.user as any;

  if (sessionUser.securityInvalidated) {
    return NextResponse.json({
      ok: false,
      revoked: true,
      message: sessionUser.securityNotice || SECURITY_PERMISSION_UPDATE_MESSAGE
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      sessionVersion: true,
      securityNotice: true
    }
  });

  if (!user) {
    return NextResponse.json({ ok: false, revoked: false }, { status: 401 });
  }

  const sessionVersion = sessionUser.sessionVersion;
  const revoked = typeof sessionVersion === 'number' && sessionVersion < user.sessionVersion;

  return NextResponse.json({
    ok: !revoked,
    revoked,
    message: revoked ? (user.securityNotice || SECURITY_PERMISSION_UPDATE_MESSAGE) : null
  });
}
