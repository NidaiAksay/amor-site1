'use strict';
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { createUser, getUserByEmail } = require('./auth');
const { slugify, randomCode } = require('./util');
const { getSetting, setSetting } = require('./settings');

const FIRST_NAMES = ['Olivia','George','Freya','Jack','Amelia','Harry','Isla','Charlie','Poppy','Oscar','Ruby','Alfie','Mia','Leo','Evie','Jacob','Grace','Noah','Lily','Archie','Ella','Freddie','Chloe','Finn','Sophie','Toby','Millie','Max','Erin','Theo'];
const LAST_NAMES = ['Bennett','Carter','Dawson','Ellis','Fisher','Grant','Hughes','Irwin','James','Kelly','Lawson','Marsh','Nolan','Osei','Parker','Quinn','Reid','Shaw','Turner','Vaughn','Walsh','Young','Adams','Brooks','Clarke','Doyle','Evans','Foster','Gill','Hart'];

function already(table) {
  const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get();
  return row.c > 0;
}

function seed() {
  const now = new Date().toISOString();

  // --- Admin + demo member ---------------------------------------------
  // These default passwords only ever get set the FIRST time each account
  // is created — once someone changes a password (from /account → Security,
  // or a direct DB edit), this never touches it again on a later restart,
  // so the console message below stays honest rather than printing a
  // stale default that isn't the real password anymore.
  const adminFreshlyCreated = !getUserByEmail('admin@amorbath.com');
  if (adminFreshlyCreated) {
    // Rotated once already (the original AmorAdmin2026! sat in a public
    // README) — this is the current real password, not a placeholder.
    // Change it anytime from /account → Security.
    createUser({ email: 'admin@amorbath.com', password: 'bnHMhGDQh0csA48t', name: 'AMOR Admin', role: 'admin' });
  }
  const memberFreshlyCreated = !getUserByEmail('demo@amorbath.com');
  if (memberFreshlyCreated) {
    createUser({ email: 'demo@amorbath.com', password: 'AmorDemo2026!', name: 'Demo Member', university: 'University of Bath', role: 'member' });
  }

  // Real historical total (tickets sold before this site tracked claims
  // in-app) — only ever sets it the first time, exactly like the admin
  // passwords above, so it never overwrites a number the admin has since
  // updated from Admin → Site settings.
  if (getSetting('tickets_sold_baseline', null) === null) {
    setSetting('tickets_sold_baseline', '486');
  }

  // --- Membership plans ---------------------------------------------
  if (!already('membership_plans')) {
    const plans = [
      {
        slug: 'access', name: 'AMOR Access', price_cents: 500, period: 'term',
        tagline: 'The essentials for anyone who comes out regularly.',
        perks: 'Presale access 24h before the public\nPoints on every ticket you claim\nMember-only event announcements',
        sort_order: 1,
      },
      {
        slug: 'plus', name: 'AMOR Plus', price_cents: 1200, period: 'term',
        tagline: 'Our most popular plan — for the regulars.',
        perks: 'Everything in Access\n2x points on every ticket\n£5 welcome credit\nSkip-the-queue on select nights',
        sort_order: 2,
      },
      {
        slug: 'all-access', name: 'AMOR All-Access', price_cents: 2500, period: 'year',
        tagline: 'For the ones who never miss a night.',
        perks: 'Everything in Plus\nOne free entry per term\n£15 welcome credit\nFirst access to Cyprus summer events',
        sort_order: 3,
      },
    ];
    const stmt = db.prepare(`INSERT INTO membership_plans (slug,name,price_cents,period,tagline,perks,sort_order) VALUES (?,?,?,?,?,?,?)`);
    for (const p of plans) stmt.run(p.slug, p.name, p.price_cents, p.period, p.tagline, p.perks, p.sort_order);
  }

  // Added post-launch, so it's checked by slug rather than gated behind
  // !already('membership_plans') — that guard already returns true on the
  // live site (the three original plans exist), which would otherwise
  // skip this block forever and this plan would never reach production.
  if (!db.prepare('SELECT 1 FROM membership_plans WHERE slug = ?').get('unlimited')) {
    db.prepare(`INSERT INTO membership_plans (slug,name,price_cents,period,tagline,perks,sort_order) VALUES (?,?,?,?,?,?,?)`)
      .run(
        'unlimited', 'AMOR Unlimited', 1499, 'term',
        'Pay for two nights out, come to every one this term.',
        'Free entry to every AMOR event this term\n2x points on every ticket\n£5 welcome credit\nSkip-the-queue on select nights',
        4,
      );
  }

  // --- Events ---------------------------------------------
  if (!already('events')) {
    const events = [
      {
        title: 'AMOR: Sub13 Takeover', venue: 'Sub13', city: 'Bath', capacity: 350,
        event_date: '2026-09-22', status: 'upcoming', price_from_cents: 800,
        fatsoma_url: 'https://www.fatsoma.com/e/amor-sub13-takeover', cover_tone: 1,
        description: 'AMOR takes over Sub13 for one night — the biggest room we\'ve run yet.',
        is_dj_set: 1,
      },
      {
        title: 'AMOR: Freshers Kickoff', venue: 'Sub13', city: 'Bath', capacity: 350,
        event_date: '2026-10-06', status: 'upcoming', price_from_cents: 600,
        fatsoma_url: 'https://www.fatsoma.com/e/amor-freshers-kickoff', cover_tone: 2,
        description: 'The first big one of term — early bird tickets move fast.',
        is_dj_set: 1,
      },
      {
        title: 'AMOR x Halloween', venue: 'OPA', city: 'Bath', capacity: 300,
        event_date: '2026-10-31', status: 'upcoming', price_from_cents: 900,
        fatsoma_url: 'https://www.fatsoma.com/e/amor-halloween', cover_tone: 4,
        description: 'Costumes optional, chaos guaranteed.',
      },
      {
        // slug pinned explicitly — the title was renamed from "AMOR:
        // Freshers Opening Night" after launch, and this keeps the
        // original URL (and every link/QR code already pointing at it)
        // working rather than following the new title into a new slug.
        title: 'AMOR: Opening Night', slug: 'amor-freshers-opening-night', venue: 'OPA', city: 'Bath', capacity: 280,
        event_date: '2026-02-24', status: 'past', price_from_cents: 500, cover_tone: 3,
        fatsoma_url: 'https://fatso.ma/fpltk',
        description: "AMOR's first-ever night — Ace of Spades theme. The one that started it all.",
      },
      {
        title: 'AMOR: Summer Send-Off', venue: 'OPA', city: 'Bath', capacity: 300,
        event_date: '2026-06-05', status: 'past', price_from_cents: 700, cover_tone: 5,
        description: 'End of year, one last one before everyone scattered for summer.',
      },
      {
        title: 'AMOR: Christmas Ball', venue: 'Sub13', city: 'Bath', capacity: 350,
        event_date: '2025-12-10', status: 'past', price_from_cents: 1000, cover_tone: 6,
        description: 'Black tie meets club night — the term closer.',
      },
    ];
    const stmt = db.prepare(`INSERT INTO events (slug,title,event_date,venue,city,capacity,description,status,fatsoma_url,price_from_cents,cover_tone,is_dj_set,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const e of events) {
      stmt.run(e.slug || slugify(e.title), e.title, e.event_date, e.venue, e.city, e.capacity, e.description, e.status, e.fatsoma_url || null, e.price_from_cents, e.cover_tone, e.is_dj_set ? 1 : 0, now);
    }
  }

  // --- Real photos + video clips from AMOR: Opening Night ------------------------------
  // 34 items total: 4 originally-seeded photos, 2 real video clips, and 28
  // more real photos Nidai sent in batches after launch prep started. All
  // real — nothing here is a placeholder or stock image.
  if (!already('event_photos')) {
    const openingNight = db.prepare("SELECT id FROM events WHERE slug = 'amor-freshers-opening-night'").get();
    if (openingNight) {
      const photos = [
        { file: 'amor-freshers-opening-night-01.jpg' },
        { file: 'amor-freshers-opening-night-02.jpg' },
        { file: 'amor-freshers-opening-night-03.jpg' },
        { file: 'amor-freshers-opening-night-04.jpg' },
        { file: 'amor-freshers-opening-night-clip-01.mp4', poster: 'amor-freshers-opening-night-clip-01-poster.jpg' },
        { file: 'amor-freshers-opening-night-clip-02.mp4', poster: 'amor-freshers-opening-night-clip-02-poster.jpg' },
        ...Array.from({ length: 28 }, (_, i) => ({ file: `amor-freshers-opening-night-${String(i + 5).padStart(2, '0')}.jpg` })),
      ];
      const photoStmt = db.prepare('INSERT INTO event_photos (event_id, image_path, caption, sort_order, poster_path) VALUES (?,?,?,?,?)');
      photos.forEach((p, i) => {
        const filePath = path.join(__dirname, '..', 'public', 'uploads', p.file);
        if (fs.existsSync(filePath)) {
          const posterPath = p.poster && fs.existsSync(path.join(__dirname, '..', 'public', 'uploads', p.poster))
            ? `/uploads/${p.poster}`
            : null;
          photoStmt.run(openingNight.id, `/uploads/${p.file}`, 'AMOR Opening Night — Ace of Spades', i, posterPath);
        }
      });
    }
  }

  // --- Homepage hero background photos --------------------------------------------------------
  // Real crowd/atmosphere shots that crossfade behind the homepage headline
  // (see views/home.js) — picked from the Opening Night set above for the
  // widest, most legible-with-text-over-it shots.
  if (!already('hero_photos')) {
    const heroFiles = [
      'amor-freshers-opening-night-01.jpg',
      'amor-freshers-opening-night-02.jpg',
      'amor-freshers-opening-night-03.jpg',
      'amor-freshers-opening-night-04.jpg',
      'amor-freshers-opening-night-08.jpg',
      'amor-freshers-opening-night-15.jpg',
    ];
    const heroStmt = db.prepare('INSERT INTO hero_photos (image_path, sort_order, created_at) VALUES (?,?,?)');
    heroFiles.forEach((file, i) => {
      if (fs.existsSync(path.join(__dirname, '..', 'public', 'uploads', file))) {
        heroStmt.run(`/uploads/${file}`, i, now);
      }
    });
  }

  // --- Testimonials ----------------------------------------------------------------------------
  // Real quotes only (never invented) — see lib/db.js note on this table.
  // Published immediately since these were already vetted and live.
  if (!already('testimonials')) {
    const quotes = [
      { quote: "Best night out I've had this term — the energy never dropped.", attribution: 'Ella, 2nd year' },
      { quote: 'Smooth from ticket to entry, no queue chaos like other events.', attribution: 'Marco, 3rd year' },
      { quote: 'Music was on point all night, exactly the vibe I wanted.', attribution: 'Priya, 1st year' },
      { quote: 'Already counting down to the next one.', attribution: 'Jaden, 2nd year' },
    ];
    const testimonialStmt = db.prepare('INSERT INTO testimonials (quote, attribution, published, sort_order, created_at) VALUES (?,?,1,?,?)');
    quotes.forEach((t, i) => testimonialStmt.run(t.quote, t.attribution, i, now));
  }

  // --- Reps (AMOR01 .. AMOR30) ---------------------------------------------
  // Demo/local-dev content only. The `demo_reps_purged_v1` check stops this
  // from resurrecting the 30 fake reps on a live site where they were
  // deliberately deleted below (once reps is empty again, `already('reps')`
  // alone would otherwise re-trigger this block on every future boot).
  if (!already('reps') && getSetting('demo_reps_purged_v1', null) === null) {
    for (let i = 1; i <= 30; i++) {
      const code = `AMOR${String(i).padStart(2, '0')}`;
      const first = FIRST_NAMES[(i - 1) % FIRST_NAMES.length];
      const last = LAST_NAMES[(i * 7) % LAST_NAMES.length];
      const name = `${first} ${last}`;
      const email = `rep${String(i).padStart(2, '0')}@amorbath.demo`;
      let user = getUserByEmail(email);
      if (!user) {
        user = createUser({ email, password: `${code}Placeholder!`, name, role: 'rep' });
      }
      const status = i <= 27 ? 'active' : 'inactive';
      db.prepare(`INSERT INTO reps (user_id, rep_code, status, joined_at) VALUES (?,?,?,?)`).run(user.id, code, status, now);
    }

    // seed plausible sales history so the leaderboard demos well
    const reps = db.prepare('SELECT * FROM reps').all();
    const eventIds = db.prepare("SELECT id FROM events").all().map((e) => e.id);
    const saleStmt = db.prepare(`INSERT INTO rep_sales (rep_id, event_id, tickets_sold, revenue_cents, note, created_at) VALUES (?,?,?,?,?,?)`);
    let seedRandom = 42; // simple deterministic PRNG so re-seeds are stable
    const rand = () => {
      seedRandom = (seedRandom * 9301 + 49297) % 233280;
      return seedRandom / 233280;
    };
    for (const rep of reps) {
      if (rep.status !== 'active') continue;
      const entries = 1 + Math.floor(rand() * 3);
      for (let n = 0; n < entries; n++) {
        const eventId = eventIds[Math.floor(rand() * eventIds.length)];
        const sold = 2 + Math.floor(rand() * 22);
        saleStmt.run(rep.id, eventId, sold, sold * 700, 'Seeded demo history', now);
      }
    }
  }

  // --- Demo member points / credits / a claimed ticket ---------------------------------------------
  const demo = getUserByEmail('demo@amorbath.com');
  if (demo && !already('tickets')) {
    const anEvent = db.prepare("SELECT * FROM events WHERE status='past' LIMIT 1").get();
    if (anEvent) {
      const code = randomCode('TKT');
      // Demo/placeholder data, not a real self-reported claim — mark it
      // verified directly rather than leaving it in the review queue an
      // admin would otherwise see at /admin/tickets with no real order to
      // check it against.
      db.prepare(`INSERT INTO tickets (user_id, event_id, rep_id, quantity, redeem_code, points_awarded, status, created_at) VALUES (?,?,?,?,?,?,'verified',?)`)
        .run(demo.id, anEvent.id, null, 2, code, 100, now);
      db.prepare(`INSERT INTO points_ledger (user_id, delta, reason, created_at) VALUES (?,?,?,?)`)
        .run(demo.id, 100, `Claimed ticket — ${anEvent.title}`, now);
      db.prepare(`INSERT INTO credits_ledger (user_id, delta, reason, created_at) VALUES (?,?,?,?)`)
        .run(demo.id, 500, 'Welcome credit', now);
    }
  }

  // --- One-time: reduce to a single active membership plan --------------
  // Requested after AMOR Unlimited launched — keep it as the only plan new
  // members can sign up for, without deleting the other three (in case any
  // real member already has an active/pending membership on one of them —
  // deleting would break that row's foreign key). Gated by a settings flag
  // rather than re-run every boot, so an admin who later reactivates a plan
  // from Admin → Membership requests isn't overridden back on next deploy.
  if (getSetting('single_plan_v1_applied', null) === null) {
    db.prepare("UPDATE membership_plans SET is_active = 0 WHERE slug != 'unlimited'").run();
    db.prepare("UPDATE membership_plans SET is_active = 1 WHERE slug = 'unlimited'").run();
    setSetting('single_plan_v1_applied', '1');
  }

  // --- One-time cleanup: purge the 30 seeded demo reps from production --
  // The original seed created 30 fake "AMOR01..AMOR30" rep accounts with
  // randomised sales history so the leaderboard would demo well locally.
  // That block only ever runs once (guarded by already('reps')), but on
  // the live site it already ran once for real — leaving 30 fake people
  // and fabricated sales numbers mixed into real analytics. This removes
  // them, once, in FK-safe order (children before parents). Real reps an
  // admin has since added by hand are untouched — this only matches the
  // demo email pattern used exclusively by that original seed block.
  if (getSetting('demo_reps_purged_v1', null) === null) {
    const demoReps = db.prepare(`
      SELECT reps.id FROM reps JOIN users ON users.id = reps.user_id
      WHERE users.email LIKE 'rep%@amorbath.demo'
    `).all();
    if (demoReps.length) {
      const ids = demoReps.map((r) => r.id);
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`DELETE FROM rank_snapshots WHERE rep_id IN (${placeholders})`).run(...ids);
      db.prepare(`DELETE FROM rep_sales WHERE rep_id IN (${placeholders})`).run(...ids);
      db.prepare(`UPDATE tickets SET rep_id = NULL WHERE rep_id IN (${placeholders})`).run(...ids);
      db.prepare(`DELETE FROM reps WHERE id IN (${placeholders})`).run(...ids);
    }
    db.prepare(`DELETE FROM users WHERE email LIKE 'rep%@amorbath.demo'`).run();
    setSetting('demo_reps_purged_v1', '1');
  }

  // --- One-time: reset analytics counters ---------------------------------
  // Historical page_views/site_events on the live site are contaminated —
  // partly by the demo reps' fabricated activity, partly by crawler/bot
  // traffic logged before bot filtering existed (see lib/analytics.js).
  // Wiping them once gives the Admin → Analytics dashboard a clean,
  // trustworthy starting point; nothing else reads these tables (tickets,
  // memberships, and rep sales — the numbers that actually matter — are
  // untouched).
  if (getSetting('analytics_reset_v1', null) === null) {
    db.prepare('DELETE FROM page_views').run();
    db.prepare('DELETE FROM site_events').run();
    setSetting('analytics_reset_v1', '1');
  }

  console.log('Seed complete.');
  if (adminFreshlyCreated) console.log('Admin login:  admin@amorbath.com / bnHMhGDQh0csA48t');
  if (memberFreshlyCreated) console.log('Demo member:  demo@amorbath.com / AmorDemo2026!');
  if (!adminFreshlyCreated && !memberFreshlyCreated) {
    console.log('Admin + demo accounts already exist — sign in with your current credentials (or reset from /account → Security).');
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
