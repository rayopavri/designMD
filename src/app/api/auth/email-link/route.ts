/**
 * POST /api/auth/email-link
 *
 * Sends a BRANDED magic-link sign-in email via Resend.
 *
 * Firebase's built-in passwordless email (noreply@<project>.firebaseapp.com)
 * has a fixed, non-customizable template and poor deliverability (lands in
 * spam). Instead we mint the same sign-in link with the Admin SDK
 * (generateSignInWithEmailLink) and send our own branded email from a verified
 * domain. The link is a standard Firebase email-link, so /auth/callback's
 * signInWithEmailLink completes it exactly as before.
 *
 * Body: { email: string }
 * Responses:
 *   200 { ok: true }          — branded email sent
 *   200 { fallback: true }    — Resend not configured; caller should fall back
 *                               to the Firebase client SDK send (keeps sign-in
 *                               working before the Resend domain is verified)
 *   4xx/5xx { error }         — validation / link / send failure
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { adminAuth } from '@/lib/auth/firebase-admin';
import { resendClient, EMAIL_FROM } from '@/lib/email/resend';
import { SIGN_IN_SUBJECT, signInEmailHtml, signInEmailText } from '@/lib/email/sign-in-email';
import { env } from '@/lib/env';
import { rateLimitEmailLink } from '@/lib/rate-limit/auth-email';
import { safeDiagnosticErrorDetail } from '@/lib/security/diagnostics';
import { readJsonBodyWithinLimit } from '@/lib/security/request-body';

export const runtime = 'nodejs';

const BodySchema = z.object({ email: z.string().email() });
const MAX_EMAIL_LINK_BODY_BYTES = 8 * 1024;

export async function POST(req: NextRequest) {
  const parsedBody = await readJsonBodyWithinLimit(req, MAX_EMAIL_LINK_BODY_BYTES);
  if (!parsedBody.ok && parsedBody.error === 'body_too_large') {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  const body = BodySchema.safeParse(parsedBody.ok ? parsedBody.value : undefined);
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const rateLimit = await rateLimitEmailLink(req, body.data.email);
  if (!rateLimit.ok) {
    if (rateLimit.unavailable) {
      return NextResponse.json({ error: 'rate_limit_unavailable' }, { status: 503 });
    }
    // Do not reveal whether a link would otherwise be sent to this address.
    return NextResponse.json({ ok: true });
  }

  // Resend not configured yet — tell the client to fall back to Firebase's
  // built-in (unbranded) email so sign-in keeps working before setup is done.
  const resend = resendClient();
  if (!resend) {
    return NextResponse.json({ fallback: true });
  }

  // Mint the sign-in link with the Admin SDK. The continue URL must be in the
  // Firebase authorized-domains list (Authentication → Settings).
  let link: string;
  try {
    link = await adminAuth().generateSignInWithEmailLink(body.data.email, {
      url: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      handleCodeInApp: true,
    });
  } catch (err) {
    console.error('[auth/email-link] generateSignInWithEmailLink failed:', safeDiagnosticErrorDetail(err));
    return NextResponse.json({ error: 'Could not create sign-in link' }, { status: 500 });
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: body.data.email,
      subject: SIGN_IN_SUBJECT,
      html: signInEmailHtml(link),
      text: signInEmailText(link),
    });
    if (error) {
      // Common during setup: domain not verified, or sending to a non-owner
      // address while still in Resend's test mode.
      console.error('[auth/email-link] resend send error:', safeDiagnosticErrorDetail(error));
      return NextResponse.json({ error: 'Could not send email' }, { status: 502 });
    }
  } catch (err) {
    console.error('[auth/email-link] resend threw:', safeDiagnosticErrorDetail(err));
    return NextResponse.json({ error: 'Could not send email' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
