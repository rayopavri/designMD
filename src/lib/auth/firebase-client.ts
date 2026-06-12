/**
 * Firebase Web SDK singleton (browser).
 * Used for Google popup sign-in and email link (passwordless) sign-in.
 *
 * Pages that import this MUST be client components (`"use client"`).
 */
'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  type Auth,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

const clientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

function clientApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();
  const app = initializeApp(clientConfig);
  isSupported().then((yes) => { if (yes) getAnalytics(app); });
  return app;
}

let cachedAuth: Auth | null = null;

export function clientAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  const auth = getAuth(clientApp());
  // Persist auth state across reloads.
  void setPersistence(auth, browserLocalPersistence);
  cachedAuth = auth;
  return auth;
}

export function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}
