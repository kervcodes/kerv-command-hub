'use client';

import { useState } from 'react';
import { signIn } from '@/app/auth-actions';
import Link from 'next/link';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const result = await signIn(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
    // On success the server action redirects to /
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm p-8 bg-surface rounded-xl border border-line shadow-lg">
        <h1 className="text-2xl font-black text-ink mb-1">Kerv Command Hub</h1>
        <p className="text-sm text-ink-muted mb-6">Sign in to your dashboard</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-ink-secondary mb-1">Email</label>
            <input
              type="email"
              name="email"
              required
              autoFocus
              className="w-full bg-background border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slack-blue/50 focus:border-slack-blue text-sm text-ink"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-ink-secondary mb-1">Password</label>
            <input
              type="password"
              name="password"
              required
              className="w-full bg-background border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slack-blue/50 focus:border-slack-blue text-sm text-ink"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slack-green hover:bg-slack-green-hover text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="text-center text-sm text-ink-muted">
            Don't have an account?{' '}
            <Link href="/signup" className="text-slack-blue hover:underline font-bold">
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
