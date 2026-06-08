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

export const runtime = 'nodejs';

const BodySchema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
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
    link = await adminAuth().generateSignInWithEmailLink(body.email, {
      url: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      handleCodeInApp: true,
    });
  } catch (err) {
    console.error('[auth/email-link] generateSignInWithEmailLink failed:', err);
    return NextResponse.json({ error: 'Could not create sign-in link' }, { status: 500 });
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: body.email,
      subject: SIGN_IN_SUBJECT,
      html: signInEmailHtml(link),
      text: signInEmailText(link),
    });
    if (error) {
      // Common during setup: domain not verified, or sending to a non-owner
      // address while still in Resend's test mode.
      console.error('[auth/email-link] resend send error:', error);
      return NextResponse.json({ error: 'Could not send email' }, { status: 502 });
    }
  } catch (err) {
    console.error('[auth/email-link] resend threw:', err);
    return NextResponse.json({ error: 'Could not send email' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
