/**
 * Branded sign-in (magic link) email — subject, HTML, and plaintext.
 *
 * Sent via Resend from a verified sender so it reaches the inbox instead of
 * spam, and carries a real brand + subject instead of Firebase's default
 * `noreply@…firebaseapp.com` template (which isn't customizable in the console).
 *
 * Kept deliberately plain: inline styles only (clients strip <style>), no
 * remote images, and a plaintext alternative — all of which improve spam
 * scoring and inbox placement.
 */

export const SIGN_IN_SUBJECT = 'Welcome to UIUXskills — your sign-in link';

const LIME = '#C5E96A';
const INK = '#0A0A0B';
const MUTED = '#6B6B70';
const BORDER = '#E6E6E3';

export function signInEmailHtml(link: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F5F5F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F2;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="width:440px;max-width:92%;background:#FFFFFF;border:1px solid ${BORDER};border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:${MUTED};font-weight:600;">UIUXskills</div>
                <h1 style="margin:14px 0 0 0;font-size:24px;line-height:1.2;color:${INK};font-weight:600;">Sign in to UIUXskills</h1>
                <p style="margin:12px 0 0 0;font-size:15px;line-height:1.55;color:#3C3C40;">
                  Tap the button below to finish signing in. This link works once and expires shortly.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px 32px;">
                <a href="${link}" style="display:inline-block;background:${LIME};color:${INK};text-decoration:none;font-size:15px;font-weight:600;padding:13px 26px;border-radius:999px;">
                  Sign in &rarr;
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px 32px;">
                <p style="margin:0;font-size:12.5px;line-height:1.55;color:${MUTED};">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin:8px 0 0 0;font-size:12px;line-height:1.5;word-break:break-all;">
                  <a href="${link}" style="color:#3A6EA5;">${link}</a>
                </p>
                <p style="margin:18px 0 0 0;font-size:12px;line-height:1.55;color:${MUTED};">
                  Didn't request this? You can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
          <div style="margin-top:18px;font-size:11.5px;color:#9A9AA0;">UIUXskills · uiuxskills.com</div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function signInEmailText(link: string): string {
  return [
    'Sign in to UIUXskills',
    '',
    'Open the link below to finish signing in. It works once and expires shortly.',
    '',
    link,
    '',
    "Didn't request this? You can safely ignore this email.",
    '',
    'UIUXskills · uiuxskills.com',
  ].join('\n');
}
