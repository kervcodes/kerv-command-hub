'use server';

import { createAdminClient, createSessionClient } from '@/lib/appwrite';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ID } from 'appwrite';

const SIGNUP_ACCESS_CODES = (process.env.NEXT_PUBLIC_SIGNUP_ACCESS_CODES || '').split(',').filter(Boolean);

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  try {
    const { account } = createAdminClient();
    const session = await account.createEmailPasswordSession(email, password);

    const cookieStore = await cookies();
    cookieStore.set('appwrite-session', session.secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid credentials';
    return { error: message };
  }

  redirect('/');
}

export async function signUp(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const accessCode = (formData.get('accessCode') as string)?.trim();

  if (!email || !password || !accessCode) {
    return { error: 'Email, password, and access code are required' };
  }

  // Validate access code
  if (!SIGNUP_ACCESS_CODES.includes(accessCode)) {
    return { error: 'Invalid access code' };
  }

  try {
    const { account } = createAdminClient();
    
    // Create the user
    await account.create(ID.unique(), email, password);
    
    // Create a session for the new user
    const session = await account.createEmailPasswordSession(email, password);

    const cookieStore = await cookies();
    cookieStore.set('appwrite-session', session.secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Signup failed';
    return { error: message };
  }

  redirect('/');
}

export async function signOut() {
  const cookieStore = await cookies();
  const session = cookieStore.get('appwrite-session');

  if (session?.value) {
    try {
      const { account } = createSessionClient(session.value);
      await account.deleteSession('current');
    } catch {
      // Session may already be expired — ignore
    }
  }

  cookieStore.delete('appwrite-session');
  redirect('/login');
}

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
