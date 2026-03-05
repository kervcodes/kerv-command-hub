import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/appwrite';

export async function POST(request: NextRequest) {
  const session = request.cookies.get('appwrite-session');

  if (session?.value) {
    try {
      const { account } = createSessionClient(session.value);
      await account.deleteSession('current');
    } catch {
      // Session may already be invalid or expired.
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete('appwrite-session');
  return response;
}
