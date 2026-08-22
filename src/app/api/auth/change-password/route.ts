import { NextResponse } from 'next/server';
import { getAppSessionUser } from '@/lib/supabase/session';
import { passwordPolicyError } from '@/lib/password-policy';
import { updatePasswordApi, updateProfileApi } from '@/lib/hatchlog-api';

export async function POST(req: Request) {
  try {
    const sessionUser = await getAppSessionUser();
    if (!sessionUser?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { firstname, surname, newPassword } = await req.json();

    if (!String(firstname || '').trim() || !String(surname || '').trim()) {
      return NextResponse.json(
        { message: 'First name and surname are required' },
        { status: 400 },
      );
    }

    const passwordError = passwordPolicyError(newPassword);
    if (passwordError) {
      return NextResponse.json({ message: passwordError }, { status: 400 });
    }

    await updateProfileApi({
      firstname: String(firstname).trim(),
      surname: String(surname).trim(),
    });
    await updatePasswordApi({ current: '', new: newPassword });

    return NextResponse.json({ message: 'Password updated successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { message: error?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
