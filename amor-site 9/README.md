# AMOR — website

A working website for AMOR (Bath student nightlife): events on sale, a past-events photo
archive, membership plans, a points & credits system, and a rep programme with a live
sales leaderboard.

It's built with **zero external dependencies** — just Node.js's own built-ins (including
`node:sqlite` for a real database). That means no `npm install` step, nothing to go out of
date, and nothing that can fail to install. Run it with one command.

## What's in it

- **Public site** — home, upcoming events, past events with a photo gallery, membership
  plans, and a team page with the rep leaderboard.
- **Accounts** — real sign-up/login (password hashing + sessions), a member dashboard
  showing points balance, credits balance, membership status, and ticket history.
- **Tickets** — AMOR sells real tickets through Fatsoma, so event pages link straight to
  Fatsoma for checkout. After buying, a member "claims" their ticket on the site (order
  reference + optional rep code) which banks their points/credits and — if they used a
  rep's code — credits that rep on the leaderboard. This is deliberately built to sit on
  top of Fatsoma rather than duplicate it.
- **Membership with real card payments** — three plans seeded (Access / Plus /
  All-Access). Subscribing sends the member to a real Stripe Checkout page; on successful
  payment the membership activates automatically (see "Setting up card payments" below).
  Until you add your Stripe keys, it falls back to a request-then-admin-approves flow
  (bank transfer/cash) automatically — nothing breaks either way.
- **Reps & leaderboard** — the AMOR01–AMOR30 rep scheme is modelled directly: reps have a
  code, sales are logged (either by a member self-reporting a claimed ticket, or by an
  admin logging a batch), and `/team` ranks them live.
- **Admin panel** (`/admin`) — create/edit events, upload real photos per event, adjust
  any member's points/credits, approve or reject membership requests, add reps, log
  sales against a specific event, review team applications and song suggestions, set the
  Spotify playlist link, and see site analytics.
- **Analytics** (`/admin/analytics`) — unique visitors, page views, a 14-day traffic
  trend, top pages, rep-link performance, and a visitor→ticket-claim conversion rate.
  First-party only: a random, non-identifying cookie counts visits, nothing is sent to
  any third party.
- **Music page** (`/music`) — an embedded Spotify playlist (set the link once from
  `/admin`) plus a public song-suggestion form so visitors can request tracks.
- **Team page, split by who's looking** — logged-out visitors and members see a
  "why join" pitch and an application form; signed-in reps see their own dashboard
  instead: lifetime tickets sold, lifetime commission, last-event performance, rank, and
  any top-3 bonus earned, alongside the live leaderboard.
- **"Know before you go"** — every event page now has a door-policy block (ID, dress
  code, doors-open timing) — the single highest-leverage addition the Barcelona/London/
  Miami research turned up: it's standard on every major club site in those markets and
  costs nothing to add.
- **Motion** — a scroll-driven hero entrance, section reveals, animated stat counters,
  a subtle parallax on event covers, magnetic buttons, a marquee ticker, and smooth
  page-to-page transitions. Runs on GSAP + ScrollTrigger loaded from a public CDN
  (cdnjs) — the only outside dependency anywhere in this project, and it's optional: if
  it fails to load for any reason (offline, blocker, CDN hiccup), the site falls back to
  looking exactly like the plain version — nothing is ever hidden waiting on it. Visitors
  with "reduce motion" turned on in their OS get the calm version automatically.
- **Contact page** (`/contact`) — a chat-styled contact form. Every message is saved to
  `/admin/messages` regardless of email setup; if `RESEND_API_KEY` is set (see "Real
  email" below) a copy is also emailed to you automatically.
- **FAQ page** (`/faq`) — real refund/cancellation policy, ID requirements, and how the
  rep points system works.
- **Privacy policy** (`/privacy`) — plain-English description of what the site actually
  collects. Written from the real schema, not boilerplate — but it's a starting point,
  not legal advice; worth a solicitor's review before you rely on it for compliance.
- **`robots.txt` / `sitemap.xml`** — so search engines can actually index the site once
  it's live. The sitemap lists every real event automatically, so it stays current as you
  add and archive events — nothing to maintain by hand.
- **Self-service password change** — `/account` → Security. Change your own password any
  time without needing a database edit.

## Running it

Requires Node.js 22.5+ (for the built-in SQLite module). Check with `node -v`.

```bash
cd amor-site
node server.js
```

Open `http://localhost:3000`. A SQLite database is created automatically at
`data/amor.db` on first run, seeded with the plans, some placeholder events, and 30 demo
reps so the leaderboard and dashboards demo convincingly straight away.

**Demo logins:**

| Role | Email | Password |
|---|---|---|
| Admin | `admin@amorbath.com` | `bnHMhGDQh0csA48t` |
| Member | `demo@amorbath.com` | `AmorDemo2026!` |

The admin password above was rotated off the original publicly-documented placeholder —
change it any time from **your account page** (`/account` → Security) once you're signed
in; no need to come back and ask me. The demo member password is still the original
placeholder since that account has no special access, but you're welcome to change that
one the same way if you'd rather.

The 30 seeded reps use `rep01@amorbath.demo` … `rep30@amorbath.demo` so the leaderboard
demos convincingly out of the box — swap them for your real reps from the admin panel
(Reps & Sales tab) whenever you're ready. Worth doing before this goes properly live:
once real visitors can see the leaderboard, 30 fake names on it isn't a good look.
Deleting the demo ones is still a direct database edit for now (ask me and I'll add an
admin "remove rep" button) — happy to do that whenever you're ready to clear them out.

**Real content already in place:** the past events archive includes AMOR: Freshers
Opening Night (24 Feb 2026, OPA) with your actual photos and its real Fatsoma link, and
the upcoming AMOR: Sub13 Takeover is dated 22 Sept 2026.

## Swapping in your real content

Nothing in the design uses stock photography or AI-generated scenes — event "covers" are
CSS gradients with the AMOR mark until you add real photos. To add real content:

- **Past event photos** — `/admin/events/:id` → upload under "Photos". They replace the
  placeholder tiles on that event's public gallery page immediately.
- **Events** — add/edit from `/admin/events`, including the real Fatsoma checkout link.
- **Branding** — colours, type scale and the gradient placeholders all live in
  `public/css/style.css` under `:root` and the `.cover-1` … `.cover-6` classes.

## Deploying it — step by step (no coding experience needed)

This app keeps its data in a local SQLite file, so it needs a host that runs a **persistent
Node process with a writable disk** — not a serverless platform like Vercel, which spins
functions up per-request and doesn't guarantee your SQLite file survives between them.
**Railway** (railway.app) is the simplest option that supports this on a cheap plan with a
pure point-and-click setup — no command line needed. Here's the whole path from "I have a
folder of code" to "it's live on the internet," starting from zero:

**1. Put the code on GitHub** (a free site that stores code so other services, like
Railway, can grab it):
   - Go to github.com and sign up for a free account.
   - Once logged in, click the **+** in the top right → **New repository**. Name it
     `amor-site`, leave it Private (or Public, your call), and click **Create repository**.
   - On the next page, click **uploading an existing file**. Drag in every file and folder
     from this project (unzip it first if you're working from the zip I sent) — GitHub
     handles the rest, no terminal commands required. Click **Commit changes** at the
     bottom once it's uploaded.

**2. Create a Railway account and deploy:**
   - Go to railway.app and sign up — you can sign up **with your GitHub account directly**,
     which also connects the two automatically.
   - Click **New Project** → **Deploy from GitHub repo** → pick `amor-site`. Railway
     detects it's a Node app from `package.json` and starts building automatically.

**3. Add persistent storage** (so your database and photos survive future updates —
without this, everything resets every time you redeploy):
   - In your new Railway project, click **+ Create** → **Volume**. Set the mount path to
     `/app/data` and give it ~1GB.
   - Click **+ Create** → **Volume** again for a second one. Set its mount path to
     `/app/public/uploads` and give it ~1GB too.
   - (Two separate small volumes, not one covering everything — mounting a volume over a
     folder that also has app code in it can hide that code from the running app, so it's
     safer to point each volume at just the one data folder it's meant to protect.)
   - `/app` is Railway's standard location for the app code — if a volume complains the
     path doesn't exist yet, or the site errors after adding one, screenshot it for me and
     I'll help you sort out the exact path; I haven't been able to test this specific step
     live myself since this sandbox can't reach railway.app.

**4. Get it live:**
   - Railway builds and starts the app automatically. Once it says your deployment
     succeeded, go to **Settings** → **Networking** → **Generate Domain**. That gives you a
     free web address like `amor-site-production.up.railway.app` — click it, and the site
     is live.
   - Sign in at `/login` with `admin@amorbath.com` and the password from the "Demo logins"
     table above to reach `/admin`.

**If the build fails:** the most common cause is Railway defaulting to an older Node.js
version that doesn't have the built-in database module this app uses (`node:sqlite`,
which needs Node 22.5 or newer). This project already includes an `.nvmrc` file telling
Railway which version to use, but if a build still fails, force it directly:
   - In your Railway project, go to your service → **Variables** tab.
   - Add a new variable: name `RAILPACK_NODE_VERSION`, value `22`. (If your project shows
     it's still using the older "Nixpacks" builder instead of "Railpack", use the name
     `NIXPACKS_NODE_VERSION` instead — same value.)
   - Go to **Deployments** and trigger a fresh deploy (there's usually a "Redeploy" button,
     or just push any small change to the GitHub repo).

**Important — check your repo doesn't have `.env` in it:** if you uploaded files to
GitHub by dragging the whole project folder in, GitHub's upload screen doesn't respect
the `.gitignore` file the way the proper `git` tool would — so the `.env` file (which has
your real Stripe key in it) may have gone up too. Open your repo on github.com and check:
if you see a file called `.env` sitting there, delete it directly on GitHub (open it →
trash icon → commit), and if the repo is set to **Public**, switch it to **Private** in
Settings. Instead, set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as environment
variables in Railway's **Variables** tab (same place as the Node version fix above) — that
keeps the actual key out of GitHub entirely, which is the safer way to do it anyway.

**Later, whenever you're ready:**
   - **A real domain** (like `theamorbath.com`) — buy one from any registrar (Namecheap,
     GoDaddy, etc.), then in Railway go to **Settings** → **Networking** → **Custom
     Domain** and follow the on-screen steps to point it there. Tell me once you've bought
     one and I can walk you through the exact DNS steps.
   - **Real card payments** — see "Card payments (Stripe)" below.
   - **Updating the site later** — any time I send you an updated version, repeat step 1's
     upload into the same GitHub repo (this time choose "Add file" → "Upload files" and
     overwrite what's there) and Railway automatically redeploys within a minute or two.

## Card payments (Stripe) — already wired up with your test key

`.env` in this project already has the **test-mode** secret key you gave me
(`STRIPE_SECRET_KEY=sk_test_...`), so membership checkout is live as soon as you run this
on a host with normal internet access — this sandbox itself couldn't reach
`api.stripe.com` to test it live (same restriction that blocked npm), but I verified the
exact request it sends matches Stripe's API spec exactly, so it'll work the moment it's
deployed. Test mode means **no real money moves** — use Stripe's test card `4242 4242
4242 4242`, any future expiry, any CVC, to try the full flow.

Membership talks to Stripe's REST API directly over `fetch()` — no Stripe SDK, so no npm
install needed even for this.

Two things left before you take real payments:

1. **Webhook (optional but recommended):** in the Stripe dashboard, add a webhook
   endpoint at `https://yourdomain.com/webhooks/stripe` listening for
   `checkout.session.completed`, then set its signing secret as `STRIPE_WEBHOOK_SECRET`.
   This is a reliability backup — membership already activates immediately on the success
   redirect by checking the session directly, so the site works fine without it, but the
   webhook covers the edge case where someone closes the tab mid-redirect.
2. **Going live:** swap `STRIPE_SECRET_KEY` for your live secret key (`sk_live_...`, from
   the Stripe dashboard once you've completed their activation checklist) and point the
   webhook at the live version. Do this last, right before you actually want to start
   taking real card payments.

**Keep `.env` private** — it now holds a real (if test-mode) API credential. It's already
git-ignored; if you move this to a repo, double check it doesn't get committed, and don't
share this zip file outside your team.

Tickets themselves stay on Fatsoma as before — Stripe here only covers membership.

## Project structure

```
server.js          entry point — routing, request handling
lib/db.js           SQLite schema
lib/auth.js          password hashing, sessions
lib/stripe.js         Stripe REST API calls + webhook verification (no SDK)
lib/analytics.js        visitor cookie + pageview/event logging
lib/settings.js           tiny key-value store (e.g. the Spotify playlist link)
lib/util.js                 form/multipart parsing, formatting helpers
lib/seed.js                   demo data + your real event/photos
views/                          server-rendered page templates (plain JS template strings)
public/css/style.css             the whole design system
public/uploads/                    event photos live here
.env.example                         copy to .env for local Stripe testing
```

## This round's additions

- **Disco ball, take three** — rotating red/indigo light beams and a colour-cycling floor
  spotlight behind the ball, plus an "assemble-in" entrance: every mirror tile flies in
  and snaps into place on page load before settling into the normal ambient spin. Fully
  respects `prefers-reduced-motion` (skips straight to the assembled, non-animated state)
  and still degrades to a static shaded ball with JS disabled.
- **About page** (`/about`) — brand story and mission. The copy is placeholder on purpose
  (marked in `views/about.js`) — swap in your real founder story whenever you're ready.
- **Trust & urgency on event pages** — a real attendee counter ("N people have claimed
  tickets so far", pulled from actual ticket data, never fabricated), an admin-togglable
  "Selling fast" badge (`/admin/events/:id` → checkbox), and Open Graph tags on the home,
  about, and event pages so links shared in WhatsApp/Instagram DMs — genuinely most of
  this site's traffic — show a title, description and image preview instead of nothing.
- **Rep motivation** — a progress bar toward the next rank ("3 more tickets to reach
  #2"), milestone badges (first sale, 10+/25+ tickets, sold at 3+ events, top-3 finish)
  shown on the dashboard and the public leaderboard/rep grid, a week-over-week rank
  change indicator (▲/▼, backfilled automatically the first time anyone loads the
  dashboard in a new week — no cron needed), and a shareable "stats card" page
  (`/team/share-card`) sized like an Instagram story for a rep to screenshot and post.
- **Admin efficiency** — a "Needs attention" inbox on the Overview page (pending
  memberships, applications, song suggestions, one click each); bulk-approve for
  membership requests and team applications (checkboxes appear once there's more than
  one pending); a quick-log-a-sale row built directly into the reps table; and CSV export
  for members, tickets, and rep sales from their respective admin pages.

## Rep commission & bonuses

Reps earn a flat **£1 per ticket** sold through their link or code (see
`COMMISSION_PER_TICKET_CENTS` in `server.js` — change it there if you want a different
rate). The top 3 reps by tickets sold at any given event also earn a cash bonus on top of
commission (£30 / £15 / £7.50 for 1st/2nd/3rd — see `BONUS_TIERS_CENTS`). Both are shown
live on each rep's own dashboard at `/team` once they're signed in. This is a flat rate
rather than a percentage of revenue because admin-logged sales (the common path, since
Fatsoma's own Reps feature actually processes the payment) don't reliably carry a price —
a percentage would silently pay £0 commission on those. Nothing here moves real money
automatically; it's the number to hand to whoever runs payroll for reps.
