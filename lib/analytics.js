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

// Crawlers, link-preview fetchers, and uptime/security scanners don't
// send/keep cookies, so every hit from one used to mint a brand-new
// "unique visitor" — badly inflating the Admin → Analytics numbers even
// though a real human never saw the page. This is a plain substring check
// against the User-Agent (no npm dependency needed) covering the crawlers
// most likely to actually hit a small site like this one: search engines,
// chat-app link previews, and common uptime monitors. Not exhaustive —
// there's no way to catch every bot this way — but it removes the biggest,
// most common sources of fake traffic.
const BOT_UA_PATTERN = /bot|spider|crawl|slurp|facebookexternalhit|whatsapp|telegrambot|discordbot|slackbot|linkedinbot|pinterest|redditbot|bingpreview|embedly|quora link preview|w3c_validator|uptimerobot|pingdom|statuscake|headlesschrome|phantomjs|curl\/|wget\/|python-requests|go-http-client|monitor/i;

function isBot(userAgent) {
  if (!userAgent) return true; // no UA at all is almost always a script/bot, not a browser
  return BOT_UA_PATTERN.test(userAgent);
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

module.exports = { shouldLogPageView, isBot, ensureVisitorId, logPageView, logSiteEvent, VISITOR_COOKIE };
