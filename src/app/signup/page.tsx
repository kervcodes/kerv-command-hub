'use client';

import { useState } from 'react';
import { signUp } from '@/app/auth-actions';
import Link from 'next/link';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    formData.append('accessCode', accessCode);

    const result = await signUp(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
    // If no error, signUp will redirect to home
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface dark:bg-surface">
      <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-8 text-ink dark:text-slate-50">Create Account</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-100 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink dark:text-slate-200 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-2 border border-secondary dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-ink dark:text-slate-50 placeholder-tertiary dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink dark:text-slate-200 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2 border border-secondary dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-ink dark:text-slate-50 placeholder-tertiary dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink dark:text-slate-200 mb-1">Access Code</label>
            <input
              type="password"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Enter access code"
              required
              className="w-full px-4 py-2 border border-secondary dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-ink dark:text-slate-50 placeholder-tertiary dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-primary dark:bg-blue-600 text-white font-semibold rounded hover:bg-primary-dark dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-tertiary dark:text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-primary dark:text-blue-400 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
