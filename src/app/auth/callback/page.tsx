/**
 * Email-link sign-in callback.
 *
 * Firebase redirects the user here after they click the magic link.
 * We detect the link, complete `signInWithEmailLink`, exchange the ID
 * token for a session cookie, and route them onward.
 */
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { clientAuth } from '@/lib/auth/firebase-client';
import {
  consumeStoredEmailForSignIn,
  postAuthDestination,
} from '@/lib/ui-data/mockAuth';

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackContent />
    </Suspense>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get('returnTo');
  const [status, setStatus] = useState<'pending' | 'need_email' | 'error'>('pending');
  const [emailInput, setEmailInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function complete(email: string) {
      try {
        const cred = await signInWithEmailLink(clientAuth(), email, window.location.href);
        const idToken = await cred.user.getIdToken();
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) throw new Error('Server rejected session');
        router.replace(postAuthDestination(returnTo));
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    }

    if (!isSignInWithEmailLink(clientAuth(), window.location.href)) {
      setStatus('error');
      setErrorMessage('This link is invalid or has already been used.');
      return;
    }

    const stored = consumeStoredEmailForSignIn();
    if (stored) {
      void complete(stored);
    } else {
      setStatus('need_email');
    }
  }, [returnTo, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setStatus('pending');
    setErrorMessage(null);
    // Re-run the effect with the supplied email.
    void (async () => {
      try {
        const cred = await signInWithEmailLink(
          clientAuth(),
          emailInput.trim(),
          window.location.href
        );
        const idToken = await cred.user.getIdToken();
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) throw new Error('Server rejected session');
        router.replace(postAuthDestination(returnTo));
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    })();
  }

  return (
    <main className="min-h-[60vh] grid place-items-center px-6">
      <div className="max-w-sm w-full text-center">
        {status === 'pending' && (
          <>
            <h1 className="text-2xl font-medium tracking-tight mb-2">Signing you in…</h1>
            <p className="text-sm opacity-70">Finishing magic-link sign-in.</p>
          </>
        )}
        {status === 'need_email' && (
          <>
            <h1 className="text-2xl font-medium tracking-tight mb-2">Confirm your email</h1>
            <p className="text-sm opacity-70 mb-4">
              For security, please re-enter the email you used to request this link.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@studio.com"
                className="w-full h-11 rounded-md border px-3 text-sm bg-transparent"
              />
              <button
                type="submit"
                className="w-full h-11 rounded-md bg-white text-black text-sm font-medium"
              >
                Continue
              </button>
            </form>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-2xl font-medium tracking-tight mb-2">Couldn't sign in</h1>
            <p className="text-sm opacity-70 mb-4">{errorMessage ?? 'Try requesting a new link.'}</p>
            <button
              type="button"
              onClick={() => router.replace('/login')}
              className="h-11 px-5 rounded-md border text-sm"
            >
              Back to sign-in
            </button>
          </>
        )}
      </div>
    </main>
  );
}
