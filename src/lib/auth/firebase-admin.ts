/**
 * Firebase Admin SDK singleton (server-only).
 * Verifies ID tokens, mints session cookies, and reads user records.
 *
 * Credentials are stored as a base64-encoded service-account JSON in
 * FIREBASE_ADMIN_CREDENTIALS_B64 (see .env.local).
 */
import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { env } from '@/lib/env';

interface ServiceAccountJson {
  project_id: string;
  client_email: string;
  private_key: string;
}

function loadServiceAccount(): ServiceAccountJson {
  const b64 = env.FIREBASE_ADMIN_CREDENTIALS_B64;
  if (!b64) {
    throw new Error(
      'FIREBASE_ADMIN_CREDENTIALS_B64 is not set. Add the base64-encoded service account JSON to .env.local.'
    );
  }
  const raw = Buffer.from(b64, 'base64').toString('utf8');
  const parsed = JSON.parse(raw) as ServiceAccountJson;
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error('Service account JSON is missing required fields.');
  }
  return parsed;
}

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;

  const sa = loadServiceAccount();
  return initializeApp({
    credential: cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: sa.private_key,
    }),
  });
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}
