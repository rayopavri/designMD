/**
 * Auth state store (client-side, real Firebase under the hood).
 *
 * Filename is historical — when this project was a Vite mock, every UI
 * component imported `@/lib/ui-data/mockAuth`. We kept the path stable
 * during the Next.js migration; the implementation now talks to Firebase
 * Auth + our `/api/auth/session` endpoint.
 *
 * Public surface (unchanged):
 *   - useAuth(), useAuthModal(), useAuthStorageSync()
 *   - openAuthModal(), closeAuthModal()
 *   - mockSignInGoogle()  (Google popup → session cookie)
 *   - mockSignInEmail()   (sends magic link; resolves when link is sent)
 *   - signOut()
 *   - postAuthDestination(), hasSeenWelcome(), markWelcomeSeen()
 *   - updateProfile()
 */
'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { clientAuth, googleProvider } from '@/lib/auth/firebase-client';

export type AuthProvider = 'google' | 'email';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  handle: string | null;
  preferredTools: string[];
  provider: AuthProvider;
  createdAt: string;
}

interface State {
  user: AuthUser | null;
  loading: boolean;
  isFirstSignIn: boolean;
  modal: {
    open: boolean;
    returnTo: string | null;
    /** Optional context line shown in the auth card (e.g. why the prompt appeared). */
    intent: string | null;
  };
}

const WELCOME_KEY_PREFIX = 'uiuxskills.welcomeSeen:';
const EMAIL_LINK_STORAGE_KEY = 'uiuxskills.emailForSignIn';

function welcomeKey(userId: string): string {
  return `${WELCOME_KEY_PREFIX}${userId}`;
}

export function hasSeenWelcome(userId: string | null | undefined): boolean {
  if (!userId || typeof window === 'undefined') return false;
  return window.localStorage.getItem(welcomeKey(userId)) === '1';
}

// --- Mapper: server User row → AuthUser the UI expects ---
interface ServerUserRow {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  handle: string | null;
  preferredTools: string[];
  authProvider: string;
  createdAt: string;
}

function mapServerUser(row: ServerUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName ?? row.email.split('@')[0] ?? 'Designer',
    avatarUrl: row.avatarUrl,
    handle: row.handle,
    preferredTools: row.preferredTools ?? [],
    provider: row.authProvider === 'google' ? 'google' : 'email',
    createdAt: row.createdAt,
  };
}

// --- Store ---
let state: State = {
  user: null,
  loading: true,
  isFirstSignIn: false,
  modal: { open: false, returnTo: null, intent: null },
};

const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => fn());
}

function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  emit();
}

function getSnapshot(): State {
  return state;
}

const SERVER_SNAPSHOT: State = Object.freeze({
  user: null,
  loading: true,
  isFirstSignIn: false,
  modal: Object.freeze({ open: false, returnTo: null, intent: null }),
}) as State;

function getServerSnapshot(): State {
  return SERVER_SNAPSHOT;
}

export function useAuth() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useAuthModal() {
  const s = useAuth();
  return {
    isOpen: s.modal.open,
    returnTo: s.modal.returnTo,
    intent: s.modal.intent,
    open: openAuthModal,
    close: closeAuthModal,
  };
}

export function openAuthModal(returnTo: string | null = null, intent: string | null = null) {
  setState({ modal: { open: true, returnTo, intent } });
}

export function closeAuthModal() {
  setState({ modal: { open: false, returnTo: null, intent: null } });
}

// --- Session bridge: exchange a Firebase ID token for an httpOnly cookie ---
async function exchangeIdTokenForSession(firebaseUser: FirebaseUser): Promise<AuthUser | null> {
  const idToken = await firebaseUser.getIdToken();
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { user: ServerUserRow };
  return mapServerUser(data.user);
}

async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: ServerUserRow | null };
    return data.user ? mapServerUser(data.user) : null;
  } catch {
    return null;
  }
}

// --- Initial hydration + auth state subscription (runs once in browser) ---
let initialized = false;

function ensureInitialized() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Hydrate from the session cookie first.
  fetchCurrentUser().then((user) => {
    if (user) {
      setState({ user, loading: false });
    } else {
      setState({ loading: false });
    }
  });

  // Subscribe to Firebase auth state changes (popup, redirect, email link).
  onAuthStateChanged(clientAuth(), async (firebaseUser) => {
    if (firebaseUser) {
      const user = await exchangeIdTokenForSession(firebaseUser);
      if (user) {
        const seen = hasSeenWelcome(user.id);
        setState({
          user,
          loading: false,
          isFirstSignIn: !seen,
          modal: { open: false, returnTo: null, intent: null },
        });
      } else {
        setState({ loading: false });
      }
    }
    // If firebaseUser is null we don't immediately clear — explicit signOut()
    // handles cookie clearing. Avoids a flash on initial load.
  });
}

// --- Sign-in: Google popup ---
export async function mockSignInGoogle(): Promise<AuthUser> {
  ensureInitialized();
  setState({ loading: true });
  try {
    const cred = await signInWithPopup(clientAuth(), googleProvider());
    const user = await exchangeIdTokenForSession(cred.user);
    if (!user) throw new Error('Server rejected sign-in');
    const seen = hasSeenWelcome(user.id);
    setState({
      user,
      loading: false,
      isFirstSignIn: !seen,
      modal: { open: false, returnTo: null, intent: null },
    });
    return user;
  } catch (err) {
    setState({ loading: false });
    throw err;
  }
}

// --- Sign-in: email magic link ---
// Sends the link; the user clicks it, lands on /auth/callback, which completes.
export async function mockSignInEmail(email: string): Promise<void> {
  ensureInitialized();
  setState({ loading: true });
  try {
    // Prefer our branded email (Resend, via /api/auth/email-link). The endpoint
    // returns { fallback: true } when Resend isn't configured yet; we also fall
    // back on any error, so sign-in keeps working with Firebase's built-in
    // (unbranded) send until the Resend domain is verified.
    let useFirebaseFallback = false;
    try {
      const res = await fetch('/api/auth/email-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { fallback?: boolean };
        if (data.fallback) useFirebaseFallback = true;
      } else {
        useFirebaseFallback = true;
      }
    } catch (err) {
      console.error('[auth] branded email-link request failed; falling back:', err);
      useFirebaseFallback = true;
    }

    if (useFirebaseFallback) {
      await sendSignInLinkToEmail(clientAuth(), email, {
        url: `${window.location.origin}/auth/callback`,
        handleCodeInApp: true,
      });
    }

    window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
    setState({ loading: false });
  } catch (err) {
    // Log the real error (e.g. Firebase auth/operation-not-allowed) so failures
    // are diagnosable instead of silently surfacing a generic UI message.
    console.error('[auth] email sign-in send failed:', err);
    setState({ loading: false });
    throw err;
  }
}

// --- Sign-out ---
export async function signOut() {
  try {
    await firebaseSignOut(clientAuth());
  } catch {
    // ignore — we still want to clear server session
  }
  try {
    await fetch('/api/auth/session', { method: 'DELETE' });
  } catch {
    // ignore
  }
  setState({ user: null, isFirstSignIn: false });
}

export function markWelcomeSeen() {
  const userId = state.user?.id;
  if (userId && typeof window !== 'undefined') {
    window.localStorage.setItem(welcomeKey(userId), '1');
  }
  setState({ isFirstSignIn: false });
}

/**
 * Compute where to send a user after sign-in. Single source of truth.
 */
export function postAuthDestination(returnTo: string | null | undefined): string {
  const dest = returnTo && returnTo.startsWith('/') ? returnTo : '/generate';
  const userId = state.user?.id;
  if (userId && !hasSeenWelcome(userId)) {
    return `/welcome?returnTo=${encodeURIComponent(dest)}`;
  }
  return dest;
}

/**
 * Update profile fields optimistically, then persist to the server.
 * On error the local state rolls back. Existing call sites that don't
 * await will still see the optimistic update immediately.
 */
export async function updateProfile(
  patch: Partial<Pick<AuthUser, 'displayName' | 'handle' | 'preferredTools'>>
): Promise<void> {
  if (!state.user) return;
  const prev = state.user;
  setState({ user: { ...prev, ...patch } });
  try {
    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setState({ user: prev });
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const data = await res.json() as { user: ServerUserRow };
    setState({ user: mapServerUser(data.user) });
  } catch (err) {
    setState({ user: prev });
    throw err;
  }
}

/** Triggers cross-tab hydration. */
export function useAuthStorageSync() {
  useEffect(() => {
    ensureInitialized();
  }, []);
}

// Helper for the email-link callback page.
export function consumeStoredEmailForSignIn(): string | null {
  if (typeof window === 'undefined') return null;
  const email = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
  if (email) window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
  return email;
}
