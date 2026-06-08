/**
 * Resend transactional-email client (server-only).
 *
 * Lazily constructed so the app boots without RESEND_API_KEY set. Callers must
 * handle a null client (Resend not configured) — typically by falling back to
 * another path or skipping the email. See `src/app/api/auth/email-link`.
 *
 * Deliverability note: the EMAIL_FROM domain MUST be verified in Resend
 * (SPF/DKIM/DMARC) or messages land in spam / are rejected. Until uiuxskills.com
 * is verified, Resend only delivers to the account owner's own address.
 */
import { Resend } from 'resend';
import { env } from '@/lib/env';

let _resend: Resend | null = null;

export function resendClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (_resend) return _resend;
  _resend = new Resend(env.RESEND_API_KEY);
  return _resend;
}

/** Configured sender identity, e.g. `UIUXskills <hello@uiuxskills.com>`. */
export const EMAIL_FROM = env.EMAIL_FROM;
