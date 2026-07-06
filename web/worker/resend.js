// Direct Resend API call for our own custom "invite a teammate" email.
// (Supabase Auth's own emails — password reset — are routed through Resend
// separately, via Supabase's custom SMTP setting. That's dashboard config,
// not code — see README.)
export async function sendInviteEmail(env, { to, companyName, inviterEmail, acceptUrl }) {
  if (!env.RESEND_API_KEY) {
    throw new Error('Missing RESEND_API_KEY — set it via `wrangler secret put RESEND_API_KEY`.');
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL || 'ezyFriday <onboarding@resend.dev>',
      to,
      subject: `${inviterEmail} invited you to join ${companyName} on ezyFriday`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#33281c;margin:0 0 12px">You're invited to ${companyName}</h2>
          <p style="color:#6b5a45">${inviterEmail} invited you to join their team's board on ezyFriday.</p>
          <p style="margin:24px 0">
            <a href="${acceptUrl}" style="display:inline-block;background:#ef6b4d;color:#fff;font-weight:700;padding:12px 24px;border-radius:999px;text-decoration:none">Accept invite</a>
          </p>
          <p style="color:#a08d75;font-size:13px">This link expires in 7 days.</p>
        </div>
      `,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
}
