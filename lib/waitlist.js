'use strict';
// Ticket waitlist: when an event doesn't have a Fatsoma link live yet,
// visitors can leave their email instead of hitting a dead "not yet live"
// button. The moment an admin adds/updates that event's Fatsoma link from
// the admin panel, everyone still un-notified on the list gets emailed
// automatically (see notifyWaitlistForEvent, called from server.js's
// admin event-update route) — that's the "release a ticket, they get
// reminded" loop the feature exists for.
const db = require('./db');
const { escapeHtml, formatDate } = require('./util');
const email = require('./email');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

function addToWaitlist(eventId, rawEmail) {
  const clean = String(rawEmail || '').trim().toLowerCase();
  if (!isValidEmail(clean)) return { ok: false, error: 'Enter a valid email address.' };
  const now = new Date().toISOString();
  // INSERT OR IGNORE relies on the unique (event_id, email) index — signing
  // up twice for the same event is a no-op, not a duplicate row or an error.
  db.prepare(`INSERT OR IGNORE INTO waitlist (event_id, email, created_at) VALUES (?,?,?)`)
    .run(eventId, clean, now);
  return { ok: true };
}

function listWaitlist(eventId) {
  return db.prepare('SELECT * FROM waitlist WHERE event_id = ? ORDER BY created_at ASC').all(eventId);
}

function waitlistCount(eventId) {
  return db.prepare('SELECT COUNT(*) c FROM waitlist WHERE event_id = ?').get(eventId).c;
}

// Emails everyone on this event's waitlist who hasn't been notified yet,
// then marks them notified — called right after an admin save gives the
// event a Fatsoma link it didn't have before. Never throws: a broken email
// provider shouldn't break the admin's save action, so failures are caught
// and logged per-recipient and the function reports what happened instead.
async function notifyWaitlistForEvent(event, origin) {
  const pending = db.prepare('SELECT * FROM waitlist WHERE event_id = ? AND notified_at IS NULL').all(event.id);
  if (!pending.length) return { sent: 0, failed: 0, queued: 0, skipped: !email.isConfigured() };

  // No provider configured — leave notified_at untouched (not skipped-and-
  // forgotten) so these rows are still "pending" and get swept up the next
  // time someone calls this, e.g. once RESEND_API_KEY is added and an admin
  // uses the "Resend waitlist emails" button on the event's admin page.
  if (!email.isConfigured()) {
    console.log(`[waitlist] RESEND_API_KEY not set — ${pending.length} pending signup(s) for "${event.title}" left un-notified for now.`);
    return { sent: 0, failed: 0, queued: pending.length, skipped: true };
  }

  const eventUrl = origin ? `${origin}/events/${event.slug}` : `/events/${event.slug}`;
  let sent = 0;
  let failed = 0;
  for (const row of pending) {
    try {
      await email.sendEmail({
        to: row.email,
        subject: `Tickets are live — ${event.title}`,
        html: `
          <p>Good news — tickets for <strong>${escapeHtml(event.title)}</strong> are now on sale.</p>
          <p>${escapeHtml(formatDate(event.event_date))} &middot; ${escapeHtml(event.venue)}</p>
          <p><a href="${escapeHtml(eventUrl)}">Get your tickets</a></p>
          <p style="color:#888;font-size:12px;">You're getting this because you joined the waitlist for this event on the AMOR site.</p>
        `,
        text: `Tickets for ${event.title} (${formatDate(event.event_date)} at ${event.venue}) are now on sale: ${eventUrl}`,
      });
      db.prepare('UPDATE waitlist SET notified_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error(`[waitlist] failed to notify ${row.email} for event ${event.slug}:`, err.message);
    }
  }
  return { sent, failed, queued: 0, skipped: false };
}

module.exports = { isValidEmail, addToWaitlist, listWaitlist, waitlistCount, notifyWaitlistForEvent };
