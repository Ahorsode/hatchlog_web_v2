import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { passwordPolicyError } from '@/lib/password-policy';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { firstname, surname, newPassword } = await req.json();

    const passwordError = passwordPolicyError(newPassword);
    if (passwordError) {
      return NextResponse.json({ message: passwordError }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateData: any = {
      password: hashedPassword,
      mustChangePassword: false,
    };

    if (firstname) updateData.firstname = firstname;
    if (surname) updateData.surname = surname;

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    return NextResponse.json({ message: 'Password updated successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error changing password:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
