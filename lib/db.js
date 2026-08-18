// Zero-dependency data layer, built entirely on Node's built-in node:sqlite.
'use strict';
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'amor.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- member | rep | admin
  university TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS membership_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  period TEXT NOT NULL, -- 'term', 'year', 'one-off'
  tagline TEXT NOT NULL,
  perks TEXT NOT NULL, -- newline separated list
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  plan_id INTEGER NOT NULL REFERENCES membership_plans(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | cancelled | expired
  requested_at TEXT NOT NULL,
  activated_at TEXT,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS points_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credits_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  delta INTEGER NOT NULL, -- credits in pence
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL, -- ISO date
  venue TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Bath',
  capacity INTEGER,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'upcoming', -- upcoming | past | cancelled
  fatsoma_url TEXT,
  price_from_cents INTEGER,
  cover_tone INTEGER NOT NULL DEFAULT 1, -- 1-6, picks a brand gradient/pattern, no stock imagery
  is_dj_set INTEGER NOT NULL DEFAULT 0, -- 1 = a resident-DJ set — drives the Events page's DJ subsection "upcoming sets" list
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id),
  image_path TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  rep_code TEXT UNIQUE NOT NULL, -- AMOR01 .. AMOR30
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rep_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rep_id INTEGER NOT NULL REFERENCES reps(id),
  event_id INTEGER REFERENCES events(id),
  tickets_sold INTEGER NOT NULL,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  event_id INTEGER NOT NULL REFERENCES events(id),
  rep_id INTEGER REFERENCES reps(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  redeem_code TEXT UNIQUE NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS site_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL, -- 'ticket_click' | 'rep_link_hit'
  path TEXT,
  event_id INTEGER REFERENCES events(id),
  rep_code TEXT,
  visitor_id TEXT,
  created_at TEXT NOT NULL
);

-- Real crowd/atmosphere photos that crossfade behind the homepage hero
-- headline (see the "Homepage hero photos" card in /admin) — not tied to
-- any one event, unlike event_photos.
CREATE TABLE IF NOT EXISTS hero_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS song_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  song TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  submitted_by TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new', -- new | added | declined
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rep_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  university TEXT NOT NULL DEFAULT '',
  social_handle TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | declined
  created_at TEXT NOT NULL
);

-- Weekly overall-leaderboard snapshots, written lazily (see
-- ensureWeeklySnapshot() in server.js — no cron needed: the first
-- /team dashboard load of a new week backfills it) so a rep's dashboard
-- can show "+2 this week" instead of just a static rank.
CREATE TABLE IF NOT EXISTS rank_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rep_id INTEGER NOT NULL REFERENCES reps(id),
  rank INTEGER NOT NULL,
  total_sold INTEGER NOT NULL,
  week_key TEXT NOT NULL, -- Monday of the week, YYYY-MM-DD
  created_at TEXT NOT NULL
);

-- Emails collected from the "join the waitlist" form shown on an event's
-- page when it has no Fatsoma link yet. notified_at is set once we've sent
-- the "tickets are live" email (see lib/waitlist.js) so a later save never
-- double-emails anyone.
CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id),
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  notified_at TEXT
);

-- Real short quotes from past attendees (never invented/AI-written) shown
-- on the About page. published = 0 lets an admin stage a quote before it
-- goes live.
CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote TEXT NOT NULL,
  attribution TEXT NOT NULL DEFAULT '', -- e.g. "Priya, 2nd year"
  published INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Messages sent through the /contact page. There's no SMTP/email-sending
-- wired up (this codebase has zero npm dependencies, and sending real email
-- needs real credentials nobody's supplied yet) so this table is the actual
-- inbox — every submission also gets a mailto: link shown to the visitor as
-- an immediate fallback. read_at is set the first time an admin opens
-- /admin/messages so unread ones can be flagged on the dashboard.
CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);
`;

// node:sqlite's exec() is unreliable with a single large multi-statement
// blob in this runtime, so run each CREATE TABLE individually.
for (const stmt of SCHEMA_SQL.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
  db.exec(stmt + ';');
}

// Lightweight idempotent migrations — safe to run against an existing DB.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('memberships', 'stripe_session_id', 'TEXT');
ensureColumn('event_photos', 'poster_path', 'TEXT');
ensureColumn('events', 'selling_fast', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('events', 'is_dj_set', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('reps', 'photo_path', 'TEXT');
ensureColumn('reps', 'instagram_handle', 'TEXT');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_rank_snapshot_rep_week ON rank_snapshots(rep_id, week_key);');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_event_email ON waitlist(event_id, email);');

module.exports = db;
