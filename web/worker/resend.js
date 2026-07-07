// Direct Resend API calls for our own custom emails (teammate invites, daily
// digest). (Supabase Auth's own emails — password reset — are routed through
// Resend separately, via Supabase's custom SMTP setting. That's dashboard
// config, not code — see README.)
async function sendEmail(env, { to, subject, html }) {
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
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
}

export async function sendInviteEmail(env, { to, companyName, inviterEmail, acceptUrl }) {
  await sendEmail(env, {
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
  });
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

// New public-form request → ping the workspace owners immediately (the daily
// digest is too slow for inbound work).
export async function sendIntakeNotificationEmail(
  env,
  { to, companyName, task, requesterName, requesterEmail, appUrl }
) {
  await sendEmail(env, {
    to,
    subject: `New request: ${task.title} (${companyName})`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#33281c;margin:0 0 12px">New request on the ${escapeHtml(companyName)} board</h2>
        <p style="color:#333;margin:0 0 4px"><strong>${escapeHtml(task.title)}</strong></p>
        <p style="color:#6b5a45;margin:0 0 4px">From ${escapeHtml(requesterName)} (${escapeHtml(requesterEmail)})</p>
        ${task.due_date ? `<p style="color:#6b5a45;margin:0">Needed by ${escapeHtml(task.due_date)}</p>` : ''}
        <p style="margin:24px 0">
          <a href="${appUrl}/app?task=${task.id}" style="display:inline-block;background:#ef6b4d;color:#fff;font-weight:700;padding:12px 24px;border-radius:999px;text-decoration:none">Open the request</a>
        </p>
      </div>
    `,
  });
}

// Morning digest of everything due today or overdue, sent to workspace owners.
export async function sendDigestEmail(env, { to, companyName, tasks, today, appUrl }) {
  const overdue = tasks.filter((t) => t.due_date < today);
  const dueToday = tasks.filter((t) => t.due_date === today);

  const row = (t, color) => {
    const who = t.requester_ref?.name || t.requester || '';
    const client = t.client?.name || '';
    const meta = [client, who].filter(Boolean).join(' · ');
    return `
      <tr>
        <td style="padding:6px 10px 6px 0;border-bottom:1px solid #eee">
          <strong>${escapeHtml(t.title)}</strong>
          ${meta ? `<br><span style="color:#888;font-size:13px">${escapeHtml(meta)}</span>` : ''}
        </td>
        <td style="padding:6px 0;border-bottom:1px solid #eee;color:${color};white-space:nowrap;font-size:13px;text-align:right">
          ${escapeHtml(t.due_date)}
        </td>
      </tr>`;
  };

  const section = (title, list, color) =>
    list.length === 0
      ? ''
      : `
        <h3 style="color:${color};margin:20px 0 6px;font-size:15px">${title} (${list.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333">
          ${list.map((t) => row(t, color)).join('')}
        </table>`;

  await sendEmail(env, {
    to,
    subject: `Friday digest — ${overdue.length} overdue, ${dueToday.length} due today (${companyName})`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#33281c;margin:0 0 4px">Good morning ☀️</h2>
        <p style="color:#6b5a45;margin:0 0 8px">Here's what needs attention on the ${escapeHtml(companyName)} board today.</p>
        ${section('Overdue', overdue, '#dc2626')}
        ${section('Due today', dueToday, '#d97706')}
        <p style="margin:24px 0">
          <a href="${appUrl}/app" style="display:inline-block;background:#ef6b4d;color:#fff;font-weight:700;padding:12px 24px;border-radius:999px;text-decoration:none">Open the board</a>
        </p>
      </div>
    `,
  });
}
