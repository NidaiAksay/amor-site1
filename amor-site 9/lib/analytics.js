'use strict';
// Zero-dependency, privacy-light analytics: no third-party script, no
// fingerprinting. A random, non-identifying visitor id is set as a cookie
// on first visit and reused so we can count unique visitors and a rough
// conversion rate; nothing here ties back to a real identity unless the
// visitor is logged in (in which case we already have their user_id from
// the session, and we log it alongside — same as any first-party site
// analytics).
const crypto = require('crypto');
const db = require('./db');
const { parseCookies } = require('./auth');
const { addCookie } = require('./util');

const VISITOR_COOKIE = 'amor_vid';
const VISITOR_DAYS = 365;

// Paths we don't want cluttering pageview stats: admin's own usage, static
// assets (already filtered before this runs), and the tracking/webhook
// endpoints themselves.
function shouldLogPageView(pathname) {
  if (pathname.startsWith('/admin')) return false;
  if (pathname.startsWith('/api/')) return false;
  if (pathname.startsWith('/webhooks/')) return false;
  return true;
}

function ensureVisitorId(req, res) {
  const cookies = parseCookies(req);
  let vid = cookies[VISITOR_COOKIE];
  if (!vid || !/^[a-f0-9]{32}$/.test(vid)) {
    vid = crypto.randomBytes(16).toString('hex');
    addCookie(res, `${VISITOR_COOKIE}=${vid}; Path=/; SameSite=Lax; Max-Age=${VISITOR_DAYS * 24 * 60 * 60}`);
  }
  return vid;
}

function logPageView(pathname, visitorId, userId) {
  db.prepare('INSERT INTO page_views (path, visitor_id, user_id, created_at) VALUES (?,?,?,?)')
    .run(pathname, visitorId, userId || null, new Date().toISOString());
}

function logSiteEvent(kind, { path = null, eventId = null, repCode = null, visitorId = null } = {}) {
  db.prepare('INSERT INTO site_events (kind, path, event_id, rep_code, visitor_id, created_at) VALUES (?,?,?,?,?,?)')
    .run(kind, path, eventId, repCode, visitorId, new Date().toISOString());
}

module.exports = { shouldLogPageView, ensureVisitorId, logPageView, logSiteEvent, VISITOR_COOKIE };
