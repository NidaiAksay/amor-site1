'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

loadDotEnv();

const db = require('./lib/db');
const auth = require('./lib/auth');
const stripeLib = require('./lib/stripe');
const analytics = require('./lib/analytics');
const { getSetting, setSetting } = require('./lib/settings');
const { parseFormBody, readBody, escapeHtml, slugify, randomCode, formatMoney, toCsv } = require('./lib/util');
const { seed } = require('./lib/seed');
const waitlist = require('./lib/waitlist');
const emailLib = require('./lib/email');

const { homePage } = require('./views/home');
const { aboutPage } = require('./views/about');
const { eventsListPage, pastEventsListPage, eventDetailPage, pastEventDetailPage } = require('./views/events');
const { membershipPage } = require('./views/membership');
const { teamJoinPage, teamDashboardPage, teamShareCardPage } = require('./views/team');
const { musicPage } = require('./views/music');
const { faqPage } = require('./views/faq');
const { contactPage } = require('./views/contact');
const { privacyPage } = require('./views/privacy');
const { CONTACT_EMAIL } = require('./lib/contact');
const { loginPage, signupPage } = require('./views/auth');
const { accountPage } = require('./views/account');
const {
  adminDashboard, adminAnalyticsPage, adminEventsPage, adminEventDetailPage,
  adminMembersPage, adminMembershipsPage, adminRepsPage,
  adminApplicationsPage, adminSuggestionsPage, adminTestimonialsPage, adminMessagesPage,
  adminTicketsPage,
} = require('./views/admin');

function loadDotEnv() {
  // Tiny dependency-free stand-in for the `dotenv` package: reads a local
  // .env file (if present) into process.env without needing npm install.
  // Real hosts (Railway/Render/Fly) inject env vars directly, so this is
  // mainly for local testing.
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

seed();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
// Uploaded photos live under data/uploads (NOT public/uploads) so that a
// single persistent volume mounted at /app/data covers both the SQLite
// database and every uploaded photo. Hosts like Railway only need one
// volume this way — earlier we asked for two (data/ and public/uploads/
// separately), which turned out to be a real sticking point in Railway's
// UI, so this collapses it down to one.
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// The real event photos are still committed to the repo under
// public/uploads/ (as build-time "seed" assets) so a completely fresh
// volume — e.g. the very first deploy, or a brand new environment — comes
// up with all the real content already in place. This copy is additive
// and idempotent: it only ever fills in files that are missing, so it
// never overwrites or duplicates anything an admin has since uploaded for
// real (including a same-named file, which would simply be left alone).
const SEED_UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
if (fs.existsSync(SEED_UPLOADS_DIR)) {
  for (const file of fs.readdirSync(SEED_UPLOADS_DIR)) {
    const dest = path.join(UPLOADS_DIR, file);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(SEED_UPLOADS_DIR, file), dest);
    }
  }
}

// A correlated subquery, not a JOIN, so it stays a single row per event
// (a JOIN against event_photos would multiply each event row by its photo
// count). Picks the first photo by sort order — i.e. whatever an admin
// uploaded and put first in the event's gallery — as that event's card
// cover image everywhere it's listed. Falls back to the brand gradient +
// letter mark (see views/components.js: cover()) when an event has no
// photos yet, which is the common case for a brand-new upcoming event.
const EVENT_COVER_SQL = `(SELECT image_path FROM event_photos WHERE event_photos.event_id = events.id ORDER BY sort_order ASC, id ASC LIMIT 1) AS cover_photo`;

const POINTS_PER_TICKET = 50;
// Flat rate rather than a % of revenue: admin-logged sales (the common
// path, since Fatsoma's own Reps feature is what actually processes the
// payment) don't carry reliable revenue figures, so a percentage would
// under- or over-pay depending on whether a sale happened to have a price
// attached. Top 3 reps by tickets sold at a given event also earn a bonus
// on top of commission.
const COMMISSION_PER_TICKET_CENTS = 100; // £1 per ticket
const BONUS_TIERS_CENTS = [3000, 1500, 750]; // 1st / 2nd / 3rd place at an event

// ---------------------------------------------------------------- helpers
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}

function redirect(res, location, extraHeaders = {}) {
  res.writeHead(302, { Location: location, ...extraHeaders });
  res.end();
}

function withQuery(basePath, params) {
  const qs = new URLSearchParams(params).toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

const MIME = {
  '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon',
};

// Resolves a stored "/uploads/filename.ext" DB value to its real path on
// disk (inside UPLOADS_DIR). Anything not under /uploads/ falls back to
// PUBLIC_DIR, since some older records could in principle point at a
// bundled /img asset instead of an uploaded one.
function resolveMediaPath(imagePath) {
  const clean = String(imagePath || '').replace(/^\//, '');
  if (clean.startsWith('uploads/')) {
    return path.join(UPLOADS_DIR, clean.slice('uploads/'.length));
  }
  return path.join(PUBLIC_DIR, clean);
}

function serveStatic(req, res, pathname) {
  // /uploads/* is served from UPLOADS_DIR (the persistent data volume);
  // everything else (/css, /js, /img) comes from the static PUBLIC_DIR
  // that ships with the app code.
  const isUpload = pathname.startsWith('/uploads/');
  const baseDir = isUpload ? UPLOADS_DIR : PUBLIC_DIR;
  const rel = isUpload
    ? pathname.slice('/uploads/'.length)
    : pathname.replace(/^\/(css|js|img)\//, '$1/');
  const filePath = path.join(baseDir, rel);
  if (!filePath.startsWith(baseDir)) return false;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

// Auto-flips events from 'upcoming' to 'past' once their date has gone by,
// so the homepage "Events run" counter (and the /events/past listing) stay
// correct on their own — no need for the admin to remember to flip the
// status dropdown by hand after every night. Throttled to once a minute
// (module-level, resets on restart) rather than run on literally every
// request, since it's a write and the exact minute it flips doesn't matter.
// Only ever moves 'upcoming' -> 'past' — a 'cancelled' event is never
// touched, so cancelling still overrides the date-based check.
let lastPastEventCheck = 0;
function promotePastEventsIfNeeded() {
  const nowMs = Date.now();
  if (nowMs - lastPastEventCheck < 60000) return;
  lastPastEventCheck = nowMs;
  const today = new Date().toISOString().slice(0, 10);
  db.prepare("UPDATE events SET status='past' WHERE status='upcoming' AND event_date < ?").run(today);
}

function computePoints(quantity, membershipPlanSlug) {
  const multiplier = ['plus', 'all-access', 'unlimited'].includes(membershipPlanSlug) ? 2 : 1;
  return quantity * POINTS_PER_TICKET * multiplier;
}

function getActiveMembership(userId) {
  return db.prepare(`
    SELECT m.*, p.name as plan_name, p.slug as plan_slug FROM memberships m
    JOIN membership_plans p ON p.id = m.plan_id
    WHERE m.user_id = ? ORDER BY m.id DESC LIMIT 1
  `).get(userId);
}

function pointsBalanceFor(userId) {
  const r = db.prepare('SELECT COALESCE(SUM(delta),0) as total FROM points_ledger WHERE user_id = ?').get(userId);
  return r.total;
}
function creditsBalanceFor(userId) {
  const r = db.prepare('SELECT COALESCE(SUM(delta),0) as total FROM credits_ledger WHERE user_id = ?').get(userId);
  return r.total;
}

function leaderboardRows() {
  return db.prepare(`
    SELECT reps.id, reps.rep_code, reps.status, reps.photo_path, reps.instagram_handle, users.name,
      COALESCE(SUM(rep_sales.tickets_sold), 0) as total_sold
    FROM reps
    JOIN users ON users.id = reps.user_id
    LEFT JOIN rep_sales ON rep_sales.rep_id = reps.id
    GROUP BY reps.id
    ORDER BY total_sold DESC, reps.rep_code ASC
  `).all();
}

// Monday of the week containing `date`, as YYYY-MM-DD — the bucket key
// for weekly rank snapshots.
function weekKeyFor(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7; // Mon=1 .. Sun=7
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

// Lazily backfills this week's leaderboard snapshot the first time anyone
// hits the team dashboard in a new week — no cron needed for a site this
// size. Returns the current week's key either way.
function ensureWeeklySnapshot() {
  const weekKey = weekKeyFor(new Date());
  const exists = db.prepare('SELECT 1 FROM rank_snapshots WHERE week_key = ? LIMIT 1').get(weekKey);
  if (!exists) {
    const rows = leaderboardRows();
    const now = new Date().toISOString();
    rows.forEach((r, i) => {
      db.prepare('INSERT OR IGNORE INTO rank_snapshots (rep_id, rank, total_sold, week_key, created_at) VALUES (?,?,?,?,?)')
        .run(r.id, i + 1, r.total_sold, weekKey, now);
    });
  }
  return weekKey;
}

// Positive = moved up since the last recorded week, negative = moved
// down, null = no prior snapshot yet (first week live, or a brand new rep).
function rankChangeFor(repId, currentWeekKey) {
  const current = db.prepare('SELECT rank FROM rank_snapshots WHERE rep_id = ? AND week_key = ?').get(repId, currentWeekKey);
  const prev = db.prepare('SELECT rank FROM rank_snapshots WHERE rep_id = ? AND week_key < ? ORDER BY week_key DESC LIMIT 1').get(repId, currentWeekKey);
  if (!current || !prev) return null;
  return prev.rank - current.rank;
}

// A rep's personal dashboard: lifetime totals plus how they did at the
// most recent event that has any rep sales recorded against it (not
// necessarily one this rep personally sold at — "last event" from the
// business's perspective, so a rep who sold zero at the latest night still
// sees an honest #0 rather than an old event pretending to be current).
function repDashboardStats(repInfo) {
  const totalSold = db.prepare('SELECT COALESCE(SUM(tickets_sold),0) c FROM rep_sales WHERE rep_id=?').get(repInfo.id).c;
  const lifetimeCommissionCents = totalSold * COMMISSION_PER_TICKET_CENTS;
  const eventsSoldAt = db.prepare('SELECT COUNT(DISTINCT event_id) c FROM rep_sales WHERE rep_id=? AND event_id IS NOT NULL').get(repInfo.id).c;

  const lastEvent = db.prepare(`
    SELECT events.* FROM events
    JOIN rep_sales ON rep_sales.event_id = events.id
    GROUP BY events.id
    ORDER BY events.event_date DESC
    LIMIT 1
  `).get();

  let lastEventStats = null;
  let progressToNextRank = null;
  if (lastEvent) {
    const ranking = db.prepare(`
      SELECT reps.id as rep_id, COALESCE(SUM(rep_sales.tickets_sold),0) as sold
      FROM reps
      LEFT JOIN rep_sales ON rep_sales.rep_id = reps.id AND rep_sales.event_id = ?
      GROUP BY reps.id
      ORDER BY sold DESC
    `).all(lastEvent.id);
    const idx = ranking.findIndex((r) => r.rep_id === repInfo.id);
    const mySold = idx >= 0 ? ranking[idx].sold : 0;
    const rank = idx >= 0 ? idx + 1 : ranking.length + 1;
    const bonusCents = mySold > 0 && rank <= BONUS_TIERS_CENTS.length ? BONUS_TIERS_CENTS[rank - 1] : 0;
    lastEventStats = {
      event: lastEvent,
      ticketsSold: mySold,
      rank,
      totalReps: ranking.length,
      commissionCents: mySold * COMMISSION_PER_TICKET_CENTS,
      bonusCents,
    };
    if (rank > 1 && ranking[rank - 2]) {
      const ticketsNeeded = Math.max(1, ranking[rank - 2].sold - mySold + 1);
      progressToNextRank = { ticketsNeeded, targetRank: rank - 1 };
    }
  }

  const weekKey = ensureWeeklySnapshot();
  const rankChange = rankChangeFor(repInfo.id, weekKey);

  const badges = [
    { id: 'first-sale', label: 'First sale', achieved: totalSold >= 1 },
    { id: 'ten-club', label: '10+ tickets', achieved: totalSold >= 10 },
    { id: 'twentyfive-club', label: '25+ tickets', achieved: totalSold >= 25 },
    { id: 'multi-event', label: 'Sold at 3+ events', achieved: eventsSoldAt >= 3 },
    { id: 'top-3', label: 'Top 3 at an event', achieved: !!(lastEventStats && lastEventStats.bonusCents > 0) },
  ];

  return { totalSold, lifetimeCommissionCents, lastEventStats, progressToNextRank, rankChange, badges };
}

function activateMembership(membership) {
  const plan = db.prepare('SELECT * FROM membership_plans WHERE id = ?').get(membership.plan_id);
  const now = new Date().toISOString();
  const expires = new Date();
  expires.setMonth(expires.getMonth() + (plan.period === 'year' ? 12 : 4));
  db.prepare('UPDATE memberships SET status=?, activated_at=?, expires_at=? WHERE id=?')
    .run('active', now, expires.toISOString(), membership.id);
}

// Called from the Stripe success redirect — confirms payment directly against
// Stripe (rather than trusting the redirect alone) before activating.
async function activateMembershipIfPaid(membership) {
  const session = await stripeLib.retrieveSession(membership.stripe_session_id);
  if (session.payment_status === 'paid') {
    activateMembership(membership);
  }
}

// ---------------------------------------------------------------- server
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);
    const query = Object.fromEntries(url.searchParams.entries());
    const user = auth.currentUser(req);
    const visitorId = analytics.ensureVisitorId(req, res);
    promotePastEventsIfNeeded();

    if (req.method === 'GET' && /^\/(css|js|uploads|img)\//.test(pathname)) {
      if (serveStatic(req, res, pathname)) return;
      return send(res, 404, 'Not found');
    }

    if (req.method === 'POST' && pathname === '/api/track') {
      return handleTrack(req, res, visitorId);
    }

    if (req.method === 'GET' && analytics.shouldLogPageView(pathname) && !analytics.isBot(req.headers['user-agent'])) {
      analytics.logPageView(pathname, visitorId, user ? user.id : null);
      if (query.rep) {
        analytics.logSiteEvent('rep_link_hit', { path: pathname, repCode: String(query.rep).toUpperCase(), visitorId });
      }
    }

    const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
    await route(req, res, { pathname, query, user, visitorId, origin });
  } catch (err) {
    console.error(err);
    send(res, 500, `<pre>${escapeHtml(err.stack || String(err))}</pre>`);
  }
});

// Beacon target for client-side "real purchase intent" events (see
// public/js/ticket-modal.js). Deliberately tiny and forgiving — a bad or
// missing payload just gets dropped, never an error back to the page,
// since analytics must never be able to break a real ticket purchase.
async function handleTrack(req, res, visitorId) {
  try {
    const raw = await readBody(req, 64 * 1024);
    let payload = {};
    try { payload = JSON.parse(raw.toString('utf8') || '{}'); } catch { /* ignore bad payload */ }
    if (payload.kind === 'ticket_click') {
      const event = payload.event_slug ? db.prepare('SELECT id FROM events WHERE slug = ?').get(payload.event_slug) : null;
      analytics.logSiteEvent('ticket_click', {
        path: typeof payload.path === 'string' ? payload.path.slice(0, 200) : null,
        eventId: event ? event.id : null,
        visitorId,
      });
    }
  } catch (err) {
    console.error('track error:', err.message);
  }
  res.writeHead(204).end();
}

async function route(req, res, ctx) {
  const { pathname, query, user, origin } = ctx;
  const method = req.method;

  // ---------------- SEO ----------------
  if (method === 'GET' && pathname === '/robots.txt') {
    const body = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /account',
      'Disallow: /login',
      'Disallow: /signup',
      `Sitemap: ${origin}/sitemap.xml`,
      '',
    ].join('\n');
    return send(res, 200, body, { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  if (method === 'GET' && pathname === '/sitemap.xml') {
    // Static pages plus every real event — public pages only, nothing
    // behind login (matches robots.txt's Disallow list above).
    const staticPaths = ['/', '/events', '/events/past', '/membership', '/music', '/team', '/about', '/faq', '/contact', '/privacy'];
    const events = db.prepare('SELECT slug, status FROM events').all();
    const urls = [
      ...staticPaths.map((p) => ({ loc: `${origin}${p}`, priority: p === '/' ? '1.0' : '0.7' })),
      ...events.map((e) => ({
        loc: `${origin}/events/${e.status === 'past' ? 'past/' : ''}${e.slug}`,
        priority: '0.6',
      })),
    ];
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeHtml(u.loc)}</loc><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
    return send(res, 200, body, { 'Content-Type': 'application/xml; charset=utf-8' });
  }

  // ---------------- Public pages ----------------
  if (method === 'GET' && pathname === '/') {
    const upcoming = db.prepare(`SELECT events.*, ${EVENT_COVER_SQL} FROM events WHERE status='upcoming' ORDER BY event_date ASC LIMIT 3`).all();
    const pastFeatured = db.prepare(`SELECT events.*, ${EVENT_COVER_SQL} FROM events WHERE status='past' ORDER BY event_date DESC LIMIT 1`).get();
    const eventsRun = db.prepare("SELECT COUNT(*) c FROM events WHERE status='past'").get().c;
    // Real in-app ticket claims, plus an admin-editable baseline for sales
    // that happened before this site tracked them (edit in Admin →
    // Dashboard settings — defaults to 0, not a hidden magic number).
    const ticketsBaseline = parseInt(getSetting('tickets_sold_baseline', '0'), 10) || 0;
    const ticketsSold = db.prepare("SELECT COALESCE(SUM(quantity),0) c FROM tickets WHERE status='verified'").get().c + ticketsBaseline;
    const repCount = db.prepare("SELECT COUNT(*) c FROM reps WHERE status='active'").get().c;
    const heroPhotos = db.prepare('SELECT * FROM hero_photos ORDER BY sort_order ASC, id ASC').all();
    return send(res, 200, homePage({
      user, query, upcoming, pastFeatured, stats: { eventsRun, ticketsSold, repCount }, heroPhotos, origin,
    }));
  }

  if (method === 'GET' && pathname === '/about') {
    const testimonials = db.prepare('SELECT * FROM testimonials WHERE published = 1 ORDER BY sort_order ASC, id DESC').all();
    return send(res, 200, aboutPage({ user, query, origin, testimonials }));
  }

  if (method === 'GET' && pathname === '/events') {
    const events = db.prepare(`SELECT events.*, ${EVENT_COVER_SQL} FROM events WHERE status='upcoming' ORDER BY event_date ASC`).all();
    return send(res, 200, eventsListPage({ user, query, events }));
  }

  if (method === 'GET' && pathname === '/events/past') {
    const events = db.prepare(`SELECT events.*, ${EVENT_COVER_SQL} FROM events WHERE status='past' ORDER BY event_date DESC`).all();
    return send(res, 200, pastEventsListPage({ user, query, events }));
  }

  let m;
  if (method === 'GET' && (m = pathname.match(/^\/events\/past\/([^/]+)$/))) {
    const event = db.prepare("SELECT * FROM events WHERE slug = ? AND status='past'").get(m[1]);
    if (!event) return send(res, 404, 'Event not found');
    const photos = db.prepare('SELECT * FROM event_photos WHERE event_id = ? ORDER BY sort_order ASC, id ASC').all(event.id);
    event.cover_photo = photos.length ? photos[0].image_path : null;
    return send(res, 200, pastEventDetailPage({ user, query, event, photos, origin }));
  }

  if (method === 'GET' && (m = pathname.match(/^\/events\/([^/]+)$/))) {
    const event = db.prepare("SELECT * FROM events WHERE slug = ?").get(m[1]);
    if (!event) return send(res, 404, 'Event not found');
    if (event.status === 'past') return redirect(res, `/events/past/${event.slug}`);
    const attendeeCount = db.prepare("SELECT COALESCE(SUM(quantity),0) c FROM tickets WHERE event_id = ? AND status != 'rejected'").get(event.id).c;
    const photo = db.prepare('SELECT * FROM event_photos WHERE event_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1').get(event.id);
    event.cover_photo = photo ? photo.image_path : null;
    const waitlistJoined = query.waitlist === 'joined';
    // AMOR Unlimited members get one free "comp" entry per event (see the
    // /claim-membership route below) instead of buying via Fatsoma —
    // capacity is first-come-first-served same as anyone else, so a member
    // can still miss out on a sold-out night.
    let membershipComp = null;
    if (user) {
      const membership = getActiveMembership(user.id);
      if (membership && membership.status === 'active' && membership.plan_slug === 'unlimited') {
        const alreadyClaimed = Boolean(
          db.prepare('SELECT 1 FROM tickets WHERE user_id = ? AND event_id = ? AND is_membership_comp = 1').get(user.id, event.id)
        );
        const atCapacity = event.capacity != null && attendeeCount >= event.capacity;
        membershipComp = { eligible: true, alreadyClaimed, atCapacity };
      }
    }
    return send(res, 200, eventDetailPage({ user, query, event, attendeeCount, photo, origin, waitlistJoined, membershipComp }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/events\/([^/]+)\/claim-membership$/))) {
    if (!user) return redirect(res, `/login?next=/events/${m[1]}`);
    const event = db.prepare('SELECT * FROM events WHERE slug = ?').get(m[1]);
    if (!event) return send(res, 404, 'Event not found');
    const membership = getActiveMembership(user.id);
    if (!membership || membership.status !== 'active' || membership.plan_slug !== 'unlimited') {
      return redirect(res, withQuery(`/events/${event.slug}`, { error: 'AMOR Unlimited membership required for free entry.' }));
    }
    const alreadyClaimed = db.prepare('SELECT 1 FROM tickets WHERE user_id = ? AND event_id = ? AND is_membership_comp = 1').get(user.id, event.id);
    if (alreadyClaimed) {
      return redirect(res, withQuery(`/events/${event.slug}`, { error: 'You already claimed your free entry for this event.' }));
    }
    const attendeeCount = db.prepare("SELECT COALESCE(SUM(quantity),0) c FROM tickets WHERE event_id = ? AND status != 'rejected'").get(event.id).c;
    if (event.capacity != null && attendeeCount >= event.capacity) {
      return redirect(res, withQuery(`/events/${event.slug}`, { error: "This event just hit capacity, so free entries are full too — message us and we'll see what we can do." }));
    }
    const points = computePoints(1, membership.plan_slug);
    const now = new Date().toISOString();
    const code = randomCode('TKT');
    // Auto-verified, unlike a self-reported Fatsoma claim below — there's
    // no order reference to fake here, the only thing gating this is an
    // active paid membership, which is already verified by Stripe/admin.
    db.prepare(`INSERT INTO tickets (user_id, event_id, quantity, redeem_code, points_awarded, is_membership_comp, status, created_at)
      VALUES (?,?,?,?,?,1,'verified',?)`).run(user.id, event.id, 1, code, points, now);
    db.prepare(`INSERT INTO points_ledger (user_id, delta, reason, created_at) VALUES (?,?,?,?)`)
      .run(user.id, points, `Free entry via AMOR Unlimited — ${event.title}`, now);
    return redirect(res, withQuery('/account', { ok: `You're in — free entry to "${event.title}" claimed. Show your account page (or code ${code}) at the door.` }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/events\/([^/]+)\/waitlist$/))) {
    const event = db.prepare('SELECT * FROM events WHERE slug = ?').get(m[1]);
    if (!event) return send(res, 404, 'Event not found');
    const { fields } = await parseFormBody(req);
    const result = waitlist.addToWaitlist(event.id, fields.email);
    if (!result.ok) {
      return redirect(res, withQuery(`/events/${event.slug}`, { error: result.error }));
    }
    return redirect(res, withQuery(`/events/${event.slug}`, { waitlist: 'joined' }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/events\/([^/]+)\/claim$/))) {
    if (!user) return redirect(res, `/login?next=/events/${m[1]}`);
    const event = db.prepare("SELECT * FROM events WHERE slug = ?").get(m[1]);
    if (!event) return send(res, 404, 'Event not found');
    const { fields } = await parseFormBody(req);
    const quantity = Math.max(1, Math.min(10, parseInt(fields.quantity, 10) || 1));
    const orderRef = (fields.order_ref || '').trim();
    const repCode = (fields.rep_code || '').trim().toUpperCase();

    if (!orderRef) {
      return redirect(res, withQuery(`/events/${event.slug}`, { error: 'Enter your Fatsoma order reference to claim.' }));
    }

    // Anti-fraud: typing literally anything in here used to instantly bank
    // real points and (if a rep code was attached) real commission — no
    // check against Fatsoma at all. Two guards now: the same order
    // reference can't be claimed twice for this event (unique index in
    // lib/db.js), and every claim lands as 'pending' rather than paying
    // out immediately — an admin has to verify it against the actual
    // Fatsoma order list at /admin/tickets before points/commission land.
    const duplicate = db.prepare('SELECT 1 FROM tickets WHERE event_id = ? AND order_ref = ?').get(event.id, orderRef);
    if (duplicate) {
      return redirect(res, withQuery(`/events/${event.slug}`, { error: 'That order reference has already been claimed on an AMOR account.' }));
    }

    let rep = null;
    if (repCode) rep = db.prepare('SELECT * FROM reps WHERE rep_code = ?').get(repCode);

    const now = new Date().toISOString();
    const code = randomCode('TKT');
    db.prepare(`INSERT INTO tickets (user_id, event_id, rep_id, quantity, redeem_code, order_ref, status, points_awarded, created_at)
      VALUES (?,?,?,?,?,?,'pending',0,?)`).run(user.id, event.id, rep ? rep.id : null, quantity, code, orderRef, now);

    return redirect(res, withQuery('/account', { ok: "Claim submitted — we check every order reference against Fatsoma before points and rep credit land, so it may take a little while to show as verified." }));
  }

  // ---------------- Membership ----------------
  if (method === 'GET' && pathname === '/membership') {
    const plans = db.prepare('SELECT * FROM membership_plans WHERE is_active = 1 ORDER BY sort_order ASC').all();
    const currentMembership = user ? getActiveMembership(user.id) : null;
    return send(res, 200, membershipPage({ user, query, plans, currentMembership }));
  }

  if (method === 'POST' && pathname === '/membership/subscribe') {
    if (!user) return redirect(res, '/login?next=/membership');
    const { fields } = await parseFormBody(req);
    const planId = parseInt(fields.plan_id, 10);
    const plan = db.prepare('SELECT * FROM membership_plans WHERE id = ? AND is_active = 1').get(planId);
    if (!plan) return redirect(res, withQuery('/membership', { error: 'That plan is no longer available.' }));
    const existing = getActiveMembership(user.id);
    if (existing && (existing.status === 'active' || existing.status === 'pending')) {
      return redirect(res, withQuery('/membership', { error: 'You already have a membership on file.' }));
    }
    const now = new Date().toISOString();
    const info = db.prepare(`INSERT INTO memberships (user_id, plan_id, status, requested_at) VALUES (?,?,?,?)`)
      .run(user.id, plan.id, 'pending', now);
    const membershipId = Number(info.lastInsertRowid);

    if (!stripeLib.isConfigured()) {
      // No STRIPE_SECRET_KEY set yet — fall back to the request/admin-approve flow.
      return redirect(res, withQuery('/membership', { ok: `Requested ${plan.name} — AMOR will confirm once payment is received.` }));
    }

    try {
      const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
      const session = await stripeLib.createCheckoutSession({
        priceCents: plan.price_cents,
        productName: `AMOR — ${plan.name} membership`,
        successUrl: `${origin}/membership/success?membership_id=${membershipId}`,
        cancelUrl: withQuery(`${origin}/membership`, { error: 'Checkout cancelled — no payment taken.' }),
        customerEmail: user.email,
        metadata: { membership_id: String(membershipId), user_id: String(user.id), plan_slug: plan.slug },
      });
      db.prepare('UPDATE memberships SET stripe_session_id = ? WHERE id = ?').run(session.id, membershipId);
      return redirect(res, session.url);
    } catch (err) {
      console.error('Stripe checkout error:', err.message);
      return redirect(res, withQuery('/membership', { error: "Couldn't start checkout — try again shortly." }));
    }
  }

  if (method === 'GET' && pathname === '/membership/success') {
    const membership = query.membership_id
      ? db.prepare('SELECT * FROM memberships WHERE id = ?').get(query.membership_id)
      : null;
    if (membership && membership.status !== 'active' && membership.stripe_session_id && stripeLib.isConfigured()) {
      try {
        await activateMembershipIfPaid(membership);
      } catch (err) {
        console.error('Stripe session check failed:', err.message);
      }
    }
    return redirect(res, withQuery('/account', { ok: 'Payment received — your membership is active.' }));
  }

  if (method === 'POST' && pathname === '/webhooks/stripe') {
    const raw = await readBody(req);
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = req.headers['stripe-signature'];
    if (!secret || !stripeLib.verifyWebhookSignature(raw.toString('utf8'), signature, secret)) {
      return send(res, 400, 'Invalid signature', { 'Content-Type': 'text/plain' });
    }
    let event;
    try {
      event = JSON.parse(raw.toString('utf8'));
    } catch {
      return send(res, 400, 'Bad payload', { 'Content-Type': 'text/plain' });
    }
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const membershipId = session.metadata && session.metadata.membership_id;
      const membership = membershipId ? db.prepare('SELECT * FROM memberships WHERE id = ?').get(membershipId) : null;
      if (membership && membership.status !== 'active') {
        activateMembership(membership);
      }
    }
    return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });
  }

  // ---------------- Team ----------------
  if (method === 'GET' && pathname === '/team') {
    const repInfo = user ? db.prepare('SELECT * FROM reps WHERE user_id = ?').get(user.id) : null;
    if (repInfo) {
      return send(res, 200, teamDashboardPage({
        user, query, leaderboard: leaderboardRows(), repInfo, dashStats: repDashboardStats(repInfo),
      }));
    }
    return send(res, 200, teamJoinPage({ user, query, leaderboard: leaderboardRows() }));
  }

  if (method === 'GET' && pathname === '/team/share-card') {
    const repInfo = user ? db.prepare('SELECT * FROM reps WHERE user_id = ?').get(user.id) : null;
    if (!repInfo) return redirect(res, '/team');
    return send(res, 200, teamShareCardPage({ user, repInfo, dashStats: repDashboardStats(repInfo) }));
  }

  if (method === 'POST' && pathname === '/team/apply') {
    const { fields } = await parseFormBody(req);
    const name = (fields.name || '').trim();
    const email = (fields.email || '').trim().toLowerCase();
    if (!name || !email) {
      return redirect(res, withQuery('/team', { error: 'Name and email are required.' }));
    }
    db.prepare(`INSERT INTO rep_applications (name, email, university, social_handle, message, status, created_at)
      VALUES (?,?,?,?,?,?,?)`).run(
      name, email, (fields.university || '').trim(), (fields.social_handle || '').trim(),
      (fields.message || '').trim(), 'pending', new Date().toISOString()
    );
    return redirect(res, withQuery('/team', { ok: "Application sent — we'll be in touch soon." }));
  }

  // ---------------- Music ----------------
  if (method === 'GET' && pathname === '/music') {
    const playlistUrl = getSetting('spotify_playlist_url', '');
    const suggestions = db.prepare('SELECT * FROM song_suggestions ORDER BY created_at DESC LIMIT 24').all();
    return send(res, 200, musicPage({ user, query, playlistUrl, suggestions }));
  }

  if (method === 'GET' && pathname === '/faq') {
    return send(res, 200, faqPage({ user, query }));
  }

  // ---------------- Contact ----------------
  if (method === 'GET' && pathname === '/contact') {
    return send(res, 200, contactPage({ user, query }));
  }

  if (method === 'POST' && pathname === '/contact') {
    const { fields } = await parseFormBody(req);
    const name = (fields.name || '').trim();
    const email = (fields.email || '').trim();
    const message = (fields.message || '').trim();
    if (!message) {
      return redirect(res, withQuery('/contact', { error: 'Enter a message.', name, email }));
    }
    db.prepare('INSERT INTO contact_messages (name, email, message, created_at) VALUES (?,?,?,?)')
      .run(name, email, message, new Date().toISOString());
    // Best-effort notification email — never blocks the save above, and
    // silently no-ops if RESEND_API_KEY isn't set (see lib/email.js). The
    // contact_messages row is the durable copy either way; check
    // /admin/messages if email isn't configured.
    emailLib.sendEmail({
      to: CONTACT_EMAIL,
      subject: `New contact message${name ? ` from ${name}` : ''}`,
      html: `
        <p><strong>From:</strong> ${escapeHtml(name || '(no name given)')} ${email ? `&lt;${escapeHtml(email)}&gt;` : '(no email given)'}</p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      `,
      text: `From: ${name || '(no name given)'} ${email ? `<${email}>` : '(no email given)'}\n\n${message}`,
    }).catch((err) => console.error('[contact] notification email failed:', err.message));
    return redirect(res, withQuery('/contact', { ok: "Message sent — we'll reply by email soon." }));
  }

  if (method === 'GET' && pathname === '/privacy') {
    return send(res, 200, privacyPage({ user, query }));
  }

  if (method === 'POST' && pathname === '/music/suggest') {
    const { fields } = await parseFormBody(req);
    const song = (fields.song || '').trim();
    if (!song) return redirect(res, withQuery('/music', { error: 'Enter a song title.' }));
    db.prepare(`INSERT INTO song_suggestions (song, artist, note, submitted_by, status, created_at) VALUES (?,?,?,?,?,?)`)
      .run(song, (fields.artist || '').trim(), (fields.note || '').trim(), (fields.submitted_by || '').trim(), 'new', new Date().toISOString());
    return redirect(res, withQuery('/music', { ok: 'Thanks — added to the list.' }));
  }

  // ---------------- Auth ----------------
  if (method === 'GET' && pathname === '/login') return send(res, 200, loginPage({ user, query }));
  if (method === 'GET' && pathname === '/signup') return send(res, 200, signupPage({ user, query }));

  if (method === 'POST' && pathname === '/login') {
    const { fields } = await parseFormBody(req);
    const found = auth.getUserByEmail(fields.email || '');
    const next = fields.next || '/account';
    if (!found || !auth.verifyPassword(fields.password || '', found.password_salt, found.password_hash)) {
      return redirect(res, withQuery('/login', { error: 'Incorrect email or password.', next }));
    }
    const session = auth.createSession(found.id);
    auth.setSessionCookie(res, session.token);
    return redirect(res, next);
  }

  if (method === 'POST' && pathname === '/signup') {
    const { fields } = await parseFormBody(req);
    const next = fields.next || '/account';
    const email = (fields.email || '').trim().toLowerCase();
    if (!email || !fields.password || fields.password.length < 8 || !fields.name) {
      return redirect(res, withQuery('/signup', { error: 'Fill in all fields — password needs 8+ characters.', next }));
    }
    if (auth.getUserByEmail(email)) {
      return redirect(res, withQuery('/signup', { error: 'An account with that email already exists.', next }));
    }
    const newUser = auth.createUser({ email, password: fields.password, name: fields.name, university: fields.university, role: 'member' });
    const session = auth.createSession(newUser.id);
    auth.setSessionCookie(res, session.token);
    return redirect(res, next);
  }

  if (method === 'POST' && pathname === '/logout') {
    const cookies = auth.parseCookies(req);
    auth.destroySession(cookies[auth.SESSION_COOKIE]);
    auth.clearSessionCookie(res);
    return redirect(res, '/');
  }

  // ---------------- Account ----------------
  if (method === 'GET' && pathname === '/account') {
    if (!user) return redirect(res, '/login?next=/account');
    const membership = getActiveMembership(user.id);
    const plan = membership ? db.prepare('SELECT * FROM membership_plans WHERE id = ?').get(membership.plan_id) : null;
    const tickets = db.prepare(`
      SELECT tickets.*, events.title, events.event_date FROM tickets
      JOIN events ON events.id = tickets.event_id
      WHERE tickets.user_id = ? ORDER BY tickets.created_at DESC
    `).all(user.id);
    const repInfo = db.prepare('SELECT * FROM reps WHERE user_id = ?').get(user.id);
    const repSales = repInfo ? db.prepare(`
      SELECT rep_sales.*, events.title FROM rep_sales
      LEFT JOIN events ON events.id = rep_sales.event_id
      WHERE rep_id = ? ORDER BY rep_sales.created_at DESC
    `).all(repInfo.id) : [];
    // Point a rep's shareable link at whatever's actually on sale right now,
    // so sharing it drops a buyer straight onto a claimable event with their
    // code prefilled, rather than the generic events list.
    const nextEvent = repInfo
      ? db.prepare("SELECT slug FROM events WHERE status='upcoming' ORDER BY event_date ASC LIMIT 1").get()
      : null;
    return send(res, 200, accountPage({
      user, query,
      pointsBalance: pointsBalanceFor(user.id),
      creditsBalance: creditsBalanceFor(user.id),
      membership, plan, tickets, repInfo, repSales, nextEvent,
    }));
  }

  if (method === 'POST' && pathname === '/account/password') {
    if (!user) return redirect(res, '/login?next=/account');
    const { fields } = await parseFormBody(req);
    const current = fields.current_password || '';
    const next = fields.new_password || '';
    const confirm = fields.new_password_confirm || '';
    if (!auth.verifyPassword(current, user.password_salt, user.password_hash)) {
      return redirect(res, withQuery('/account', { error: 'Current password is incorrect.' }));
    }
    if (next.length < 8) {
      return redirect(res, withQuery('/account', { error: 'New password needs 8+ characters.' }));
    }
    if (next !== confirm) {
      return redirect(res, withQuery('/account', { error: "New passwords don't match." }));
    }
    const { hash, salt } = auth.hashPassword(next);
    db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, user.id);
    return redirect(res, withQuery('/account', { ok: 'Password updated.' }));
  }

  // ---------------- Admin ----------------
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!user) return redirect(res, `/login?next=${encodeURIComponent(pathname)}`);
    if (user.role !== 'admin') return send(res, 403, 'Forbidden — admin access only.');
    return adminRoute(req, res, ctx);
  }

  send(res, 404, notFoundPage());
}

async function adminRoute(req, res, ctx) {
  const { pathname, query, user, origin } = ctx;
  const method = req.method;
  let m;

  if (method === 'GET' && pathname === '/admin') {
    const stats = {
      members: db.prepare("SELECT COUNT(*) c FROM users WHERE role='member'").get().c,
      upcomingEvents: db.prepare("SELECT COUNT(*) c FROM events WHERE status='upcoming'").get().c,
      ticketsClaimed: db.prepare("SELECT COALESCE(SUM(quantity),0) c FROM tickets WHERE status='verified'").get().c,
      pendingMemberships: db.prepare("SELECT COUNT(*) c FROM memberships WHERE status='pending'").get().c,
      activeReps: db.prepare("SELECT COUNT(*) c FROM reps WHERE status='active'").get().c,
      creditsOutstanding: db.prepare('SELECT COALESCE(SUM(delta),0) c FROM credits_ledger').get().c,
    };
    const settings = {
      spotifyPlaylistUrl: getSetting('spotify_playlist_url', ''),
      ticketsSoldBaseline: getSetting('tickets_sold_baseline', '0'),
    };
    const attention = {
      pendingMemberships: stats.pendingMemberships,
      pendingApplications: db.prepare("SELECT COUNT(*) c FROM rep_applications WHERE status='pending'").get().c,
      newSuggestions: db.prepare("SELECT COUNT(*) c FROM song_suggestions WHERE status='new'").get().c,
      unreadMessages: db.prepare('SELECT COUNT(*) c FROM contact_messages WHERE read_at IS NULL').get().c,
      pendingTicketClaims: db.prepare("SELECT COUNT(*) c FROM tickets WHERE status='pending'").get().c,
    };
    const heroPhotos = db.prepare('SELECT * FROM hero_photos ORDER BY sort_order ASC, id ASC').all();
    return send(res, 200, adminDashboard({ user, query, stats, settings, attention, heroPhotos }));
  }

  if (method === 'POST' && pathname === '/admin/hero-photos') {
    const { files } = await parseFormBody(req);
    if (files.photo && files.photo.data && files.photo.data.length) {
      const ext = path.extname(files.photo.filename) || '.jpg';
      const filename = `${crypto.randomBytes(8).toString('hex')}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), files.photo.data);
      const sortOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0) c FROM hero_photos').get().c + 1;
      db.prepare('INSERT INTO hero_photos (image_path, sort_order, created_at) VALUES (?,?,?)')
        .run(`/uploads/${filename}`, sortOrder, new Date().toISOString());
      return redirect(res, withQuery('/admin', { ok: 'Hero photo uploaded.' }));
    }
    return redirect(res, withQuery('/admin', { error: 'No photo received.' }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/hero-photos\/(\d+)\/delete$/))) {
    const photo = db.prepare('SELECT * FROM hero_photos WHERE id = ?').get(m[1]);
    if (photo) {
      const filePath = resolveMediaPath(photo.image_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      db.prepare('DELETE FROM hero_photos WHERE id = ?').run(m[1]);
    }
    return redirect(res, withQuery('/admin', { ok: 'Hero photo removed.' }));
  }

  if (method === 'GET' && pathname === '/admin/export/members.csv') {
    const members = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    const rows = [['Name', 'Email', 'Role', 'University', 'Points', 'Credits (£)', 'Joined']];
    for (const m of members) {
      rows.push([m.name, m.email, m.role, m.university || '', pointsBalanceFor(m.id), (creditsBalanceFor(m.id) / 100).toFixed(2), m.created_at]);
    }
    return send(res, 200, toCsv(rows), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="amor-members.csv"' });
  }

  if (method === 'GET' && pathname === '/admin/export/tickets.csv') {
    const tickets = db.prepare(`
      SELECT tickets.*, events.title as event_title, users.name as member_name, users.email as member_email
      FROM tickets
      JOIN events ON events.id = tickets.event_id
      LEFT JOIN users ON users.id = tickets.user_id
      ORDER BY tickets.created_at DESC
    `).all();
    const rows = [['Event', 'Member', 'Email', 'Quantity', 'Order ref', 'Status', 'Points awarded', 'Redeem code', 'Claimed at']];
    for (const t of tickets) {
      rows.push([t.event_title, t.member_name || '', t.member_email || '', t.quantity, t.order_ref || '', t.status, t.points_awarded, t.redeem_code, t.created_at]);
    }
    return send(res, 200, toCsv(rows), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="amor-tickets.csv"' });
  }

  if (method === 'GET' && pathname === '/admin/tickets') {
    const tickets = db.prepare(`
      SELECT tickets.*, events.title as event_title, users.name as member_name, users.email as member_email, reps.rep_code
      FROM tickets
      JOIN events ON events.id = tickets.event_id
      LEFT JOIN users ON users.id = tickets.user_id
      LEFT JOIN reps ON reps.id = tickets.rep_id
      WHERE tickets.is_membership_comp = 0
      ORDER BY (tickets.status = 'pending') DESC, tickets.created_at DESC
    `).all();
    return send(res, 200, adminTicketsPage({ user, query, tickets }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/tickets\/(\d+)\/verify$/))) {
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(m[1]);
    if (ticket && ticket.status === 'pending') {
      const membership = getActiveMembership(ticket.user_id);
      const isActive = membership && membership.status === 'active';
      const points = computePoints(ticket.quantity, isActive ? membership.plan_slug : null);
      const now = new Date().toISOString();
      db.prepare("UPDATE tickets SET status='verified', points_awarded=? WHERE id=?").run(points, ticket.id);
      db.prepare('INSERT INTO points_ledger (user_id, delta, reason, created_at) VALUES (?,?,?,?)')
        .run(ticket.user_id, points, 'Claimed ticket — verified against Fatsoma', now);
      if (ticket.rep_id) {
        const event = db.prepare('SELECT * FROM events WHERE id = ?').get(ticket.event_id);
        db.prepare(`INSERT INTO rep_sales (rep_id, event_id, tickets_sold, revenue_cents, note, created_at) VALUES (?,?,?,?,?,?)`)
          .run(ticket.rep_id, ticket.event_id, ticket.quantity, (event.price_from_cents || 0) * ticket.quantity,
            `Verified ticket claim (order ${ticket.order_ref})`, now);
      }
    }
    return redirect(res, withQuery('/admin/tickets', { ok: 'Ticket verified — points and any rep commission are now live.' }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/tickets\/(\d+)\/reject$/))) {
    db.prepare("UPDATE tickets SET status='rejected' WHERE id = ? AND status = 'pending'").run(m[1]);
    return redirect(res, withQuery('/admin/tickets', { ok: 'Claim rejected — no points or commission awarded.' }));
  }

  if (method === 'POST' && pathname === '/admin/tickets/bulk-verify') {
    const { fields } = await parseFormBody(req);
    const ids = (fields.ids || '').split(',').map((s) => parseInt(s, 10)).filter(Boolean);
    let count = 0;
    for (const id of ids) {
      const ticket = db.prepare("SELECT * FROM tickets WHERE id = ? AND status = 'pending'").get(id);
      if (!ticket) continue;
      const membership = getActiveMembership(ticket.user_id);
      const isActive = membership && membership.status === 'active';
      const points = computePoints(ticket.quantity, isActive ? membership.plan_slug : null);
      const now = new Date().toISOString();
      db.prepare("UPDATE tickets SET status='verified', points_awarded=? WHERE id=?").run(points, ticket.id);
      db.prepare('INSERT INTO points_ledger (user_id, delta, reason, created_at) VALUES (?,?,?,?)')
        .run(ticket.user_id, points, 'Claimed ticket — verified against Fatsoma', now);
      if (ticket.rep_id) {
        const event = db.prepare('SELECT * FROM events WHERE id = ?').get(ticket.event_id);
        db.prepare(`INSERT INTO rep_sales (rep_id, event_id, tickets_sold, revenue_cents, note, created_at) VALUES (?,?,?,?,?,?)`)
          .run(ticket.rep_id, ticket.event_id, ticket.quantity, (event.price_from_cents || 0) * ticket.quantity,
            `Verified ticket claim (order ${ticket.order_ref})`, now);
      }
      count++;
    }
    return redirect(res, withQuery('/admin/tickets', { ok: `${count} ticket${count === 1 ? '' : 's'} verified.` }));
  }

  if (method === 'GET' && pathname === '/admin/export/rep-sales.csv') {
    const sales = db.prepare(`
      SELECT rep_sales.*, reps.rep_code, users.name as rep_name, events.title as event_title
      FROM rep_sales
      JOIN reps ON reps.id = rep_sales.rep_id
      JOIN users ON users.id = reps.user_id
      LEFT JOIN events ON events.id = rep_sales.event_id
      ORDER BY rep_sales.created_at DESC
    `).all();
    const rows = [['Rep', 'Code', 'Event', 'Tickets sold', 'Commission (£)', 'Revenue (£)', 'Note', 'Logged at']];
    for (const s of sales) {
      rows.push([
        s.rep_name, s.rep_code, s.event_title || '', s.tickets_sold,
        (s.tickets_sold * COMMISSION_PER_TICKET_CENTS / 100).toFixed(2),
        (s.revenue_cents / 100).toFixed(2), s.note || '', s.created_at,
      ]);
    }
    return send(res, 200, toCsv(rows), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="amor-rep-sales.csv"' });
  }

  if (method === 'POST' && pathname === '/admin/settings') {
    const { fields } = await parseFormBody(req);
    setSetting('spotify_playlist_url', (fields.spotify_playlist_url || '').trim());
    setSetting('tickets_sold_baseline', String(parseInt(fields.tickets_sold_baseline, 10) || 0));
    return redirect(res, withQuery('/admin', { ok: 'Settings saved.' }));
  }

  if (method === 'GET' && pathname === '/admin/analytics') {
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const totalViews = db.prepare('SELECT COUNT(*) c FROM page_views').get().c;
    const uniqueVisitors = db.prepare('SELECT COUNT(DISTINCT visitor_id) c FROM page_views').get().c;
    const uniqueVisitors7d = db.prepare('SELECT COUNT(DISTINCT visitor_id) c FROM page_views WHERE created_at >= ?').get(since7).c;
    const ticketClicks = db.prepare("SELECT COUNT(*) c FROM site_events WHERE kind='ticket_click'").get().c;
    const ticketsClaimed = db.prepare("SELECT COALESCE(SUM(quantity),0) c FROM tickets WHERE status='verified'").get().c;
    const topPages = db.prepare('SELECT path, COUNT(*) c FROM page_views GROUP BY path ORDER BY c DESC LIMIT 8').all();
    const repLinkHits = db.prepare(`
      SELECT rep_code, COUNT(*) c FROM site_events
      WHERE kind='rep_link_hit' AND rep_code IS NOT NULL
      GROUP BY rep_code ORDER BY c DESC LIMIT 10
    `).all();
    const dailyTrend = db.prepare(`
      SELECT substr(created_at,1,10) as day, COUNT(*) c FROM page_views
      GROUP BY day ORDER BY day DESC LIMIT 14
    `).all().reverse();
    const stats = {
      totalViews, uniqueVisitors, uniqueVisitors7d, ticketClicks, ticketsClaimed,
      conversionRate: uniqueVisitors ? (ticketsClaimed / uniqueVisitors) * 100 : 0,
      clickThroughRate: uniqueVisitors ? (ticketClicks / uniqueVisitors) * 100 : 0,
      topPages, repLinkHits, dailyTrend,
    };
    return send(res, 200, adminAnalyticsPage({ user, query, stats }));
  }

  if (method === 'GET' && pathname === '/admin/applications') {
    const applications = db.prepare('SELECT * FROM rep_applications ORDER BY created_at DESC').all();
    return send(res, 200, adminApplicationsPage({ user, query, applications }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/applications\/(\d+)\/approve$/))) {
    db.prepare("UPDATE rep_applications SET status='approved' WHERE id=?").run(m[1]);
    return redirect(res, withQuery('/admin/applications', { ok: 'Marked approved — follow up with the applicant to get them set up, then add them as a rep.' }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/applications\/(\d+)\/decline$/))) {
    db.prepare("UPDATE rep_applications SET status='declined' WHERE id=?").run(m[1]);
    return redirect(res, withQuery('/admin/applications', { ok: 'Application declined.' }));
  }

  if (method === 'POST' && pathname === '/admin/applications/bulk-approve') {
    const { fields } = await parseFormBody(req);
    const ids = (fields.ids || '').split(',').map((s) => parseInt(s, 10)).filter(Boolean);
    let count = 0;
    for (const id of ids) {
      const info = db.prepare("UPDATE rep_applications SET status='approved' WHERE id = ? AND status = 'pending'").run(id);
      if (info.changes) count++;
    }
    return redirect(res, withQuery('/admin/applications', { ok: `${count} application${count === 1 ? '' : 's'} approved.` }));
  }

  if (method === 'GET' && pathname === '/admin/suggestions') {
    const suggestions = db.prepare('SELECT * FROM song_suggestions ORDER BY created_at DESC').all();
    return send(res, 200, adminSuggestionsPage({ user, query, suggestions }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/suggestions\/(\d+)\/status$/))) {
    const { fields } = await parseFormBody(req);
    const status = ['added', 'declined', 'new'].includes(fields.status) ? fields.status : 'new';
    db.prepare('UPDATE song_suggestions SET status=? WHERE id=?').run(status, m[1]);
    return redirect(res, withQuery('/admin/suggestions', { ok: 'Updated.' }));
  }

  if (method === 'GET' && pathname === '/admin/testimonials') {
    const testimonials = db.prepare('SELECT * FROM testimonials ORDER BY sort_order ASC, id DESC').all();
    return send(res, 200, adminTestimonialsPage({ user, query, testimonials }));
  }

  if (method === 'POST' && pathname === '/admin/testimonials') {
    const { fields } = await parseFormBody(req);
    const quote = (fields.quote || '').trim();
    if (!quote) return redirect(res, withQuery('/admin/testimonials', { error: 'Quote is required.' }));
    db.prepare('INSERT INTO testimonials (quote, attribution, published, sort_order, created_at) VALUES (?,?,0,0,?)')
      .run(quote, (fields.attribution || '').trim(), new Date().toISOString());
    return redirect(res, withQuery('/admin/testimonials', { ok: 'Added — publish it when ready.' }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/testimonials\/(\d+)\/toggle$/))) {
    const t = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(m[1]);
    if (t) db.prepare('UPDATE testimonials SET published = ? WHERE id = ?').run(t.published ? 0 : 1, t.id);
    return redirect(res, withQuery('/admin/testimonials', { ok: 'Updated.' }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/testimonials\/(\d+)\/delete$/))) {
    db.prepare('DELETE FROM testimonials WHERE id = ?').run(m[1]);
    return redirect(res, withQuery('/admin/testimonials', { ok: 'Removed.' }));
  }

  if (method === 'GET' && pathname === '/admin/messages') {
    const messages = db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all();
    // Viewing the list marks everything on it read — same "opening it clears
    // the badge" behaviour as a normal inbox, rather than a separate click
    // per message.
    db.prepare('UPDATE contact_messages SET read_at = ? WHERE read_at IS NULL').run(new Date().toISOString());
    return send(res, 200, adminMessagesPage({ user, query, messages, emailConfigured: emailLib.isConfigured() }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/messages\/(\d+)\/delete$/))) {
    db.prepare('DELETE FROM contact_messages WHERE id = ?').run(m[1]);
    return redirect(res, withQuery('/admin/messages', { ok: 'Removed.' }));
  }

  if (method === 'GET' && pathname === '/admin/events') {
    const events = db.prepare('SELECT * FROM events ORDER BY event_date DESC').all();
    return send(res, 200, adminEventsPage({ user, query, events }));
  }

  if (method === 'POST' && pathname === '/admin/events') {
    const { fields } = await parseFormBody(req);
    const priceCents = fields.price_from ? Math.round(parseFloat(fields.price_from) * 100) : null;
    const info = db.prepare(`INSERT INTO events (slug,title,event_date,venue,city,capacity,description,status,fatsoma_url,price_from_cents,cover_tone,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      slugify(fields.title) + '-' + crypto.randomBytes(2).toString('hex'),
      fields.title, fields.event_date, fields.venue, fields.city || 'Bath',
      fields.capacity ? parseInt(fields.capacity, 10) : null,
      fields.description || '', fields.status || 'upcoming', fields.fatsoma_url || null,
      priceCents, Math.floor(Math.random() * 6) + 1, new Date().toISOString()
    );
    if (fields.selling_fast === 'on') {
      db.prepare('UPDATE events SET selling_fast = 1 WHERE id = ?').run(Number(info.lastInsertRowid));
    }
    if (fields.is_dj_set === 'on') {
      db.prepare('UPDATE events SET is_dj_set = 1 WHERE id = ?').run(Number(info.lastInsertRowid));
    }
    return redirect(res, withQuery('/admin/events', { ok: 'Event created.' }));
  }

  if (method === 'GET' && (m = pathname.match(/^\/admin\/events\/(\d+)$/))) {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(m[1]);
    if (!event) return send(res, 404, 'Not found');
    const photos = db.prepare('SELECT * FROM event_photos WHERE event_id = ? ORDER BY sort_order ASC, id ASC').all(event.id);
    const waitlistRows = waitlist.listWaitlist(event.id);
    return send(res, 200, adminEventDetailPage({ user, query, event, photos, waitlistRows, emailConfigured: emailLib.isConfigured() }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/events\/(\d+)$/))) {
    const { fields } = await parseFormBody(req);
    const priceCents = fields.price_from ? Math.round(parseFloat(fields.price_from) * 100) : null;
    const before = db.prepare('SELECT fatsoma_url FROM events WHERE id = ?').get(m[1]);
    db.prepare(`UPDATE events SET title=?, event_date=?, venue=?, city=?, capacity=?, description=?, status=?, fatsoma_url=?, price_from_cents=?, selling_fast=?, is_dj_set=? WHERE id = ?`)
      .run(fields.title, fields.event_date, fields.venue, fields.city || 'Bath',
        fields.capacity ? parseInt(fields.capacity, 10) : null, fields.description || '',
        fields.status || 'upcoming', fields.fatsoma_url || null, priceCents,
        fields.selling_fast === 'on' ? 1 : 0, fields.is_dj_set === 'on' ? 1 : 0, m[1]);

    // Tickets just went live (no Fatsoma link before, one now) — this is
    // the "release" moment the waitlist exists for: email everyone still
    // waiting on this event, once, automatically.
    const justReleased = !before.fatsoma_url && fields.fatsoma_url;
    if (justReleased) {
      const event = db.prepare('SELECT * FROM events WHERE id = ?').get(m[1]);
      try {
        const result = await waitlist.notifyWaitlistForEvent(event, origin);
        const note = result.skipped
          ? `Saved. Tickets released — ${result.queued} waitlist ${result.queued === 1 ? 'signup is' : 'signups are'} still waiting to be emailed once an email provider is configured (see the waitlist table below).`
          : `Saved. Tickets released — emailed ${result.sent} waitlist signup${result.sent === 1 ? '' : 's'}${result.failed ? `, ${result.failed} failed` : ''}.`;
        return redirect(res, withQuery(`/admin/events/${m[1]}`, { ok: note }));
      } catch (err) {
        console.error('waitlist notify error:', err.message);
        return redirect(res, withQuery(`/admin/events/${m[1]}`, { ok: 'Saved, but waitlist notification hit an error — check server logs.' }));
      }
    }

    return redirect(res, withQuery(`/admin/events/${m[1]}`, { ok: 'Saved.' }));
  }

  // Manual fallback for notifyWaitlistForEvent — covers the case where an
  // event's Fatsoma link was already set before an email provider was
  // configured (so the automatic on-save trigger above had nothing to send
  // with), or a send failed and needs retrying. Only touches rows that are
  // still un-notified.
  if (method === 'POST' && (m = pathname.match(/^\/admin\/events\/(\d+)\/waitlist\/resend$/))) {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(m[1]);
    if (!event) return send(res, 404, 'Not found');
    try {
      const result = await waitlist.notifyWaitlistForEvent(event, origin);
      const note = result.skipped
        ? `No email provider configured yet — ${result.queued} signup${result.queued === 1 ? '' : 's'} still waiting.`
        : `Emailed ${result.sent} waitlist signup${result.sent === 1 ? '' : 's'}${result.failed ? `, ${result.failed} failed` : ''}.`;
      return redirect(res, withQuery(`/admin/events/${m[1]}`, { ok: note }));
    } catch (err) {
      console.error('waitlist resend error:', err.message);
      return redirect(res, withQuery(`/admin/events/${m[1]}`, { error: 'Resend hit an error — check server logs.' }));
    }
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/events\/(\d+)\/photos$/))) {
    const { fields, files } = await parseFormBody(req);
    const eventId = m[1];
    if (files.photo && files.photo.data && files.photo.data.length) {
      const ext = path.extname(files.photo.filename) || '.jpg';
      const filename = `${crypto.randomBytes(8).toString('hex')}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), files.photo.data);
      db.prepare('INSERT INTO event_photos (event_id, image_path, caption, sort_order) VALUES (?,?,?,?)')
        .run(eventId, `/uploads/${filename}`, fields.caption || '', 0);
      return redirect(res, withQuery(`/admin/events/${eventId}`, { ok: 'Photo uploaded.' }));
    }
    return redirect(res, withQuery(`/admin/events/${eventId}`, { error: 'No photo received.' }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/events\/(\d+)\/photos\/(\d+)\/delete$/))) {
    const photo = db.prepare('SELECT * FROM event_photos WHERE id = ?').get(m[2]);
    if (photo) {
      const filePath = resolveMediaPath(photo.image_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      db.prepare('DELETE FROM event_photos WHERE id = ?').run(m[2]);
    }
    return redirect(res, withQuery(`/admin/events/${m[1]}`, { ok: 'Photo removed.' }));
  }

  // Permanently removes an event — used for clearing out a duplicate or a
  // leftover placeholder event, not something offered for a real event
  // with real ticket holders. Deletes every row across the app that
  // references this event_id (photos on disk too) before the event row
  // itself, since foreign keys are enforced (PRAGMA foreign_keys = ON in
  // lib/db.js) and would otherwise reject the delete.
  if (method === 'POST' && (m = pathname.match(/^\/admin\/events\/(\d+)\/delete$/))) {
    const eventId = m[1];
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (event) {
      const photos = db.prepare('SELECT * FROM event_photos WHERE event_id = ?').all(eventId);
      for (const photo of photos) {
        const filePath = resolveMediaPath(photo.image_path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      db.prepare('DELETE FROM event_photos WHERE event_id = ?').run(eventId);
      db.prepare('DELETE FROM rep_sales WHERE event_id = ?').run(eventId);
      db.prepare('DELETE FROM tickets WHERE event_id = ?').run(eventId);
      db.prepare('DELETE FROM site_events WHERE event_id = ?').run(eventId);
      db.prepare('DELETE FROM waitlist WHERE event_id = ?').run(eventId);
      db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
      return redirect(res, withQuery('/admin/events', { ok: `"${event.title}" deleted.` }));
    }
    return redirect(res, withQuery('/admin/events', { error: 'Event not found.' }));
  }

  if (method === 'GET' && pathname === '/admin/members') {
    const members = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all().map((u) => ({
      ...u, points: pointsBalanceFor(u.id), credits: creditsBalanceFor(u.id),
    }));
    return send(res, 200, adminMembersPage({ user, query, members }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/members\/(\d+)\/adjust$/))) {
    const { fields } = await parseFormBody(req);
    const now = new Date().toISOString();
    const pointsDelta = parseInt(fields.points_delta, 10);
    const creditsDelta = fields.credits_delta ? Math.round(parseFloat(fields.credits_delta) * 100) : 0;
    if (pointsDelta) {
      db.prepare('INSERT INTO points_ledger (user_id, delta, reason, created_at) VALUES (?,?,?,?)')
        .run(m[1], pointsDelta, 'Manual admin adjustment', now);
    }
    if (creditsDelta) {
      db.prepare('INSERT INTO credits_ledger (user_id, delta, reason, created_at) VALUES (?,?,?,?)')
        .run(m[1], creditsDelta, 'Manual admin adjustment', now);
    }
    return redirect(res, withQuery('/admin/members', { ok: 'Balance updated.' }));
  }

  if (method === 'GET' && pathname === '/admin/memberships') {
    const requests = db.prepare(`
      SELECT memberships.*, users.name, users.email, membership_plans.name as plan_name
      FROM memberships
      JOIN users ON users.id = memberships.user_id
      JOIN membership_plans ON membership_plans.id = memberships.plan_id
      ORDER BY memberships.requested_at DESC
    `).all();
    const plans = db.prepare(`
      SELECT membership_plans.*,
        (SELECT COUNT(*) FROM memberships WHERE plan_id = membership_plans.id) as member_count
      FROM membership_plans ORDER BY sort_order ASC
    `).all();
    return send(res, 200, adminMembershipsPage({ user, query, requests, plans }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/membership-plans\/(\d+)$/))) {
    const plan = db.prepare('SELECT * FROM membership_plans WHERE id = ?').get(m[1]);
    if (!plan) return send(res, 404, 'Not found');
    const { fields } = await parseFormBody(req);
    const priceCents = Math.round(parseFloat(fields.price) * 100) || 0;
    db.prepare(`UPDATE membership_plans SET name=?, price_cents=?, period=?, tagline=?, perks=?, sort_order=?, is_active=? WHERE id=?`)
      .run(
        (fields.name || plan.name).trim(),
        priceCents,
        fields.period || plan.period,
        (fields.tagline || '').trim(),
        (fields.perks || '').trim(),
        parseInt(fields.sort_order, 10) || 0,
        fields.is_active ? 1 : 0,
        plan.id
      );
    return redirect(res, withQuery('/admin/memberships', { ok: `${plan.name} updated.` }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/membership-plans\/(\d+)\/delete$/))) {
    const plan = db.prepare('SELECT * FROM membership_plans WHERE id = ?').get(m[1]);
    if (!plan) return send(res, 404, 'Not found');
    const memberCount = db.prepare('SELECT COUNT(*) c FROM memberships WHERE plan_id = ?').get(plan.id).c;
    if (memberCount > 0) {
      return redirect(res, withQuery('/admin/memberships', { error: `Can't delete "${plan.name}" — it still has ${memberCount} member record(s). Deactivate it instead.` }));
    }
    db.prepare('DELETE FROM membership_plans WHERE id = ?').run(plan.id);
    return redirect(res, withQuery('/admin/memberships', { ok: `${plan.name} deleted.` }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/memberships\/(\d+)\/approve$/))) {
    const membership = db.prepare('SELECT * FROM memberships WHERE id = ?').get(m[1]);
    if (membership) activateMembership(membership);
    return redirect(res, withQuery('/admin/memberships', { ok: 'Membership activated (manual override — no card payment recorded).' }));
  }

  if (method === 'POST' && (m = pathname.match(/^\/admin\/memberships\/(\d+)\/reject$/))) {
    db.prepare("UPDATE memberships SET status='cancelled' WHERE id=?").run(m[1]);
    return redirect(res, withQuery('/admin/memberships', { ok: 'Request rejected.' }));
  }

  if (method === 'POST' && pathname === '/admin/memberships/bulk-approve') {
    const { fields } = await parseFormBody(req);
    const ids = (fields.ids || '').split(',').map((s) => parseInt(s, 10)).filter(Boolean);
    let count = 0;
    for (const id of ids) {
      const membership = db.prepare("SELECT * FROM memberships WHERE id = ? AND status = 'pending'").get(id);
      if (membership) { activateMembership(membership); count++; }
    }
    return redirect(res, withQuery('/admin/memberships', { ok: `${count} membership${count === 1 ? '' : 's'} activated.` }));
  }

  if (method === 'GET' && pathname === '/admin/reps') {
    const reps = db.prepare(`
      SELECT reps.*, users.name, COALESCE(SUM(rep_sales.tickets_sold),0) as total_sold
      FROM reps JOIN users ON users.id = reps.user_id
      LEFT JOIN rep_sales ON rep_sales.rep_id = reps.id
      GROUP BY reps.id ORDER BY total_sold DESC
    `).all();
    const candidateUsers = db.prepare(`
      SELECT users.* FROM users
      WHERE users.id NOT IN (SELECT user_id FROM reps)
      ORDER BY name ASC
    `).all();
    const events = db.prepare('SELECT * FROM events ORDER BY event_date DESC').all();
    return send(res, 200, adminRepsPage({
      user, query, reps, candidateUsers, events, commissionPerTicketCents: COMMISSION_PER_TICKET_CENTS,
    }));
  }

  if (method === 'POST' && pathname === '/admin/reps') {
    const { fields } = await parseFormBody(req);
    db.prepare('INSERT INTO reps (user_id, rep_code, status, joined_at) VALUES (?,?,?,?)')
      .run(fields.user_id, fields.rep_code.trim().toUpperCase(), 'active', new Date().toISOString());
    db.prepare("UPDATE users SET role='rep' WHERE id=?").run(fields.user_id);
    return redirect(res, withQuery('/admin/reps', { ok: 'Rep added.' }));
  }

  if (method === 'POST' && pathname === '/admin/reps/create') {
    const { fields } = await parseFormBody(req);
    const email = (fields.email || '').trim().toLowerCase();
    const name = (fields.name || '').trim();
    const repCode = (fields.rep_code || '').trim().toUpperCase();
    if (!email || !name || !repCode) {
      return redirect(res, withQuery('/admin/reps', { error: 'Name, email and rep code are all required.' }));
    }
    if (auth.getUserByEmail(email)) {
      return redirect(res, withQuery('/admin/reps', { error: `${email} already has an account — use "Make a member a rep" instead.` }));
    }
    const password = (fields.password || '').trim() || crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
    const newUser = auth.createUser({ email, password, name, role: 'rep' });
    db.prepare('INSERT INTO reps (user_id, rep_code, status, joined_at) VALUES (?,?,?,?)')
      .run(newUser.id, repCode, 'active', new Date().toISOString());
    return redirect(res, withQuery('/admin/reps', {
      ok: `Rep account created. Email: ${email} — Password: ${password}. Share these with them now — the password won't be shown again (they can change it from Account → Security once they log in).`,
    }));
  }

  if (method === 'POST' && pathname === '/admin/reps/sales') {
    const { fields } = await parseFormBody(req);
    const ticketsSold = parseInt(fields.tickets_sold, 10) || 0;
    const eventId = fields.event_id ? parseInt(fields.event_id, 10) : null;
    const event = eventId ? db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) : null;
    const revenueCents = event ? (event.price_from_cents || 0) * ticketsSold : 0;
    db.prepare('INSERT INTO rep_sales (rep_id, event_id, tickets_sold, revenue_cents, note, created_at) VALUES (?,?,?,?,?,?)')
      .run(fields.rep_id, event ? event.id : null, ticketsSold, revenueCents, fields.note || '', new Date().toISOString());
    return redirect(res, withQuery('/admin/reps', { ok: 'Sale logged.' }));
  }

  // Real photo + Instagram handle shown on the public /team leaderboard —
  // both optional, and only for reps who've actually agreed to be featured
  // (this is admin-entered, so that consent has to happen outside the app —
  // don't add either field for a rep without checking with them first).
  if (method === 'POST' && (m = pathname.match(/^\/admin\/reps\/(\d+)\/profile$/))) {
    const { fields, files } = await parseFormBody(req);
    const rep = db.prepare('SELECT * FROM reps WHERE id = ?').get(m[1]);
    if (!rep) return send(res, 404, 'Not found');
    let handle = (fields.instagram_handle || '').trim();
    if (handle && !handle.startsWith('@')) handle = `@${handle}`;
    db.prepare('UPDATE reps SET instagram_handle = ? WHERE id = ?').run(handle || null, rep.id);
    if (files.photo && files.photo.data && files.photo.data.length) {
      const ext = path.extname(files.photo.filename) || '.jpg';
      const filename = `${crypto.randomBytes(8).toString('hex')}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), files.photo.data);
      db.prepare('UPDATE reps SET photo_path = ? WHERE id = ?').run(`/uploads/${filename}`, rep.id);
    }
    return redirect(res, withQuery('/admin/reps', { ok: 'Profile updated.' }));
  }

  send(res, 404, notFoundPage());
}

function notFoundPage() {
  return `<!DOCTYPE html><html><head><title>Not found — AMOR</title><link rel="stylesheet" href="/css/style.css"></head>
  <body><main><section style="padding-top:120px; text-align:center;"><div class="wrap">
  <h1 class="display" style="font-size:4rem;">404</h1>
  <p class="lede" style="margin:16px auto;">That page doesn't exist. <a href="/" class="accent">Back home</a>.</p>
  </div></section></main></body></html>`;
}

server.listen(PORT, () => {
  console.log(`AMOR site running at http://localhost:${PORT}`);
});
