'use strict';
// Sends transactional email via Resend's HTTP API (https://resend.com) — one
// JSON POST over fetch() (built into Node 18+), no SMTP client / nodemailer
// / npm install required. Mirrors lib/stripe.js: gated behind an env var,
// and gracefully no-ops (just logs) when that var isn't set, so the site
// never breaks because email isn't configured yet.
//
// Needs RESEND_API_KEY set in the environment. EMAIL_FROM is optional
// (defaults below) — for real delivery it must be an address on a domain
// verified with Resend, not an arbitrary inbox.
const RESEND_API = 'https://api.resend.com/emails';

function isConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

async function sendEmail({ to, subject, html, text }) {
  if (!isConfigured()) {
    console.log(`[email] RESEND_API_KEY not set — skipping send of "${subject}" to ${to}`);
    return { skipped: true };
  }
  const from = process.env.EMAIL_FROM || 'AMOR <tickets@amorbath.com>';
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data && data.message) || 'Email send failed');
    err.resend = data;
    throw err;
  }
  return data;
}

module.exports = { isConfigured, sendEmail };
