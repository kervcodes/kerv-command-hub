import 'server-only';

import { createSessionClient } from '@/lib/appwrite';
import { cookies } from 'next/headers';

export async function getLoggedInUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get('appwrite-session');
  if (!session?.value) return null;

  try {
    const { account } = createSessionClient(session.value);
    return await account.get();
  } catch {
    return null;
  }
}
