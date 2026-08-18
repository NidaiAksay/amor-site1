'use strict';
const { layout, flash } = require('./layout');
const { cover, eventCard, photoGallery } = require('./components');
const { escapeHtml, formatDate, formatDateShort, formatMoney } = require('../lib/util');

function eventsListPage({ user, query, events }) {
  // Events flagged is_dj_set from /admin/events power the "upcoming sets"
  // list in the DJ subsection below (no personal badge on the cards
  // anymore — see the DJ subsection's own note further down).
  const djSets = events.filter((e) => e.is_dj_set);
  // The hero ticket links straight into the buy flow for the soonest
  // upcoming event (events is already ORDER BY event_date ASC from the
  // route) — there's no single event to point at on this list page, so
  // "nearest on sale" is the most useful default target.
  const nextEvent = events[0];
  const body = `
  <section class="hero">
    <div class="wrap hero-grid">
      <div>
        <div class="eyebrow">Upcoming</div>
        <h1 class="h2">Events on sale</h1>
        <p class="lede">Tickets sold through Fatsoma — see what's on and grab yours before it sells out.</p>
      </div>
      ${nextEvent ? `
      <a href="/events/${nextEvent.slug}" class="hero-ticket-stage" aria-label="Buy tickets — ${escapeHtml(nextEvent.title)}">
        <div class="hero-ticket-shadow" aria-hidden="true"></div>
        <div class="hero-ticket-bob">
          <div class="hero-ticket-spin">
            <!-- Front: this specific event — real date/venue, not generic
                 filler, so it reads as "the ticket for what's coming up next"
                 rather than a decorative prop. -->
            <div class="hero-ticket-face hero-ticket-front">
              <div class="hero-ticket-main">
                <div>
                  <span class="hero-ticket-wordmark">AMOR</span>
                  <span class="hero-ticket-eyebrow">${formatDateShort(nextEvent.event_date)} &middot; ${escapeHtml(nextEvent.venue)}</span>
                </div>
                <div class="hero-ticket-serial">AMR &middot; 0000</div>
              </div>
              <div class="hero-ticket-perf"></div>
              <div class="hero-ticket-stub">
                <span class="hero-ticket-stub-label">ADMIT ONE</span>
                <span class="hero-ticket-barcode" aria-hidden="true"></span>
              </div>
              <div class="hero-ticket-foil" aria-hidden="true"></div>
            </div>
            <!-- Back: a plain card face with a single spade image — AMOR's
                 first-ever event was literally called "Ace", so the flip
                 carries meaning: back is where it started, front is what's
                 coming up next. -->
            <div class="hero-ticket-face hero-ticket-back">
              <svg class="hero-ticket-back-spade" viewBox="0 0 100 120" aria-hidden="true">
                <path d="M50 4C36 26 8 46 8 74a26 26 0 0 0 44 18c-2 12-8 18-16 22h28c-8-4-14-10-16-22a26 26 0 0 0 44-18C92 46 64 26 50 4z"/>
              </svg>
            </div>
          </div>
        </div>
      </a>` : ''}
    </div>
  </section>
  <section style="padding-top:0;">
    <div class="wrap">
      <div class="grid grid-3">
        ${events.length ? events.map((e) => eventCard(e)).join('') : '<p class="muted">No events on sale right now — follow @theamorbath for the next drop.</p>'}
      </div>
    </div>
  </section>
  <section>
    <div class="wrap">
      <!-- Deliberately impersonal: this describes the resident-DJ role at
           AMOR events, not any one person — see the footer for the only
           place a name/handle appears on the site. -->
      <div class="card dj-section">
        <div class="dj-mark" aria-hidden="true"><span>A</span></div>
        <div class="dj-content">
          <div class="eyebrow">Behind the decks</div>
          <h3 class="h3" style="margin:6px 0 10px;">AMOR Resident DJ</h3>
          <span class="dj-genre-tag">Afro House</span>
          <p class="muted" style="font-size:0.92rem; max-width:52ch; margin:16px 0 4px;">Every AMOR night is mixed live — no pre-recorded sets. Set clips, track IDs and what's coming next, right here.</p>

          ${djSets.length ? `
          <div class="dj-upcoming">
            <div class="dj-upcoming-label">Upcoming sets</div>
            <ul class="dj-set-list">
              ${djSets.map((e) => `
              <li>
                <a href="/events/${e.slug}">${escapeHtml(e.title)}</a>
                <span>${formatDate(e.event_date)} · ${escapeHtml(e.venue)}</span>
              </li>`).join('')}
            </ul>
          </div>` : ''}

          <div class="dj-mix-embed">
            <!-- PLACEHOLDER: swap this block for a real embed once there's a
                 link, e.g. a SoundCloud <iframe src="https://w.soundcloud.com/player/?url=..."></iframe>
                 or a Mixcloud <iframe src="https://www.mixcloud.com/widget/iframe/?feed=..."></iframe>. -->
            <div class="dj-mix-placeholder">
              <span>Latest mix — embed coming soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
  return layout({ title: 'Events', user, active: 'events', body, query });
}

function pastEventsListPage({ user, query, events }) {
  const body = `
  <section style="padding-top:56px;">
    <div class="wrap">
      <div class="eyebrow">Archive</div>
      <h1 class="h2">Past events</h1>
      <p class="lede">Every night AMOR has run in Bath — and the photos to prove it.</p>
    </div>
  </section>
  <section style="padding-top:0;">
    <div class="wrap">
      <div class="grid grid-3">
        ${events.length ? events.map((e) => eventCard(e)).join('') : '<p class="muted">Nothing archived yet.</p>'}
      </div>
    </div>
  </section>`;
  return layout({ title: 'Past Events', user, active: 'past', body, query });
}

function eventDetailPage({ user, query, event, plansCount, attendeeCount = 0, photo, origin, waitlistJoined = false, membershipComp = null }) {
  const body = `
  <section style="padding-top:48px;">
    <div class="wrap split">
      <div style="position:relative;">
        ${event.selling_fast ? '<span class="badge-selling-fast">Selling fast</span>' : ''}
        ${cover(event)}
      </div>
      <div>
        <div class="eyebrow">${formatDate(event.event_date)}</div>
        <h1 class="h2">${escapeHtml(event.title)}</h1>
        <p class="lede">${event.description ? escapeHtml(event.description) : `${escapeHtml(event.venue)}, ${escapeHtml(event.city)}.`}</p>
        ${attendeeCount > 0 ? `<div class="attendee-count"><b>${attendeeCount}</b> ${attendeeCount === 1 ? 'person has' : 'people have'} claimed tickets so far</div>` : ''}
        <div class="stat-row" style="margin:24px 0;">
          <div class="stat-box"><b>${escapeHtml(event.venue)}</b><span>Venue</span></div>
          <div class="stat-box"><b>${event.price_from_cents != null ? formatMoney(event.price_from_cents) : '—'}</b><span>From</span></div>
          <div class="stat-box"><b>${event.capacity || '—'}</b><span>Capacity</span></div>
        </div>
        ${flash(query)}
        ${membershipComp && membershipComp.eligible ? `
        <div class="card" style="margin-bottom:16px; border-color:#4a4ac8;">
          <h3 class="h3" style="margin-bottom:6px;">Your AMOR Unlimited entry</h3>
          ${membershipComp.alreadyClaimed
            ? `<p class="muted" style="font-size:0.88rem;">You've already claimed your free entry to this one — check <a href="/account" class="accent">your account</a> for the code.</p>`
            : membershipComp.atCapacity
              ? `<p class="muted" style="font-size:0.88rem;">This event's at capacity, so free entries are full too — <a href="/contact" class="accent">get in touch</a> and we'll see what we can do.</p>`
              : `
              <p class="muted" style="font-size:0.88rem; margin-bottom:12px;">Included with your membership — no Fatsoma purchase needed.</p>
              <form method="POST" action="/events/${event.slug}/claim-membership">
                <button type="submit" class="btn btn-solid btn-block">Claim free entry</button>
              </form>`}
        </div>
        ` : ''}
        ${event.fatsoma_url
          ? `<a href="${escapeHtml(event.fatsoma_url)}" target="_blank" rel="noopener" class="btn btn-solid btn-block"
              data-ticket-trigger
              data-slug="${escapeHtml(event.slug)}"
              data-title="${escapeHtml(event.title)}"
              data-date="${escapeHtml(formatDate(event.event_date))}"
              data-venue="${escapeHtml(event.venue)}, ${escapeHtml(event.city)}"
              data-price="${event.price_from_cents != null ? escapeHtml(formatMoney(event.price_from_cents)) : 'See Fatsoma'}"
              data-url="${escapeHtml(event.fatsoma_url)}"
            >Get tickets on Fatsoma</a>`
          : waitlistJoined
            ? `<div class="alert alert-ok">You're on the list — we'll email you the moment tickets go live.</div>`
            : `<div class="waitlist-box">
                <p class="muted" style="font-size:0.88rem; margin-bottom:12px;">Tickets aren't live yet — join the waitlist and we'll email you the second they are.</p>
                <form method="POST" action="/events/${event.slug}/waitlist" class="waitlist-form">
                  <input type="email" name="email" placeholder="you@bath.ac.uk" required>
                  <button type="submit" class="btn btn-block">Join the waitlist</button>
                </form>
              </div>`}

        <div class="card" style="margin-top:28px;">
          <h3 class="h3" style="margin-bottom:10px;">Already bought a ticket?</h3>
          <p class="muted" style="font-size:0.88rem; margin-bottom:16px;">Claim it here to bank points and credits on your AMOR account. If a rep sent you your link, add their code so they get credit on the leaderboard.</p>
          ${user ? `
          <form method="POST" action="/events/${event.slug}/claim">
            <div class="field"><label>Quantity</label><input type="number" name="quantity" min="1" max="10" value="1" required></div>
            <div class="field"><label>Fatsoma order reference</label><input type="text" name="order_ref" placeholder="e.g. FS-928311" required></div>
            <div class="field"><label>Rep code (optional)</label><input type="text" name="rep_code" placeholder="e.g. AMOR07" value="${escapeHtml((query && query.rep) || '')}"></div>
            <button type="submit" class="btn btn-block">Claim ticket &amp; earn points</button>
          </form>
          ` : `<a href="/login?next=${encodeURIComponent(`/events/${event.slug}${query && query.rep ? `?rep=${query.rep}` : ''}`)}" class="btn btn-block">Sign in to claim</a>`}
        </div>

        <div class="card" style="margin-top:20px;">
          <h3 class="h3" style="margin-bottom:10px;">Know before you go</h3>
          <ul class="fine" style="line-height:1.9; padding-left:18px; margin:0;">
            <li>Valid photo ID required on the door — passport, driving licence, or student ID showing your date of birth.</li>
            <li>Smart casual dress code. The door team's decision is final, no exceptions.</li>
            <li>Doors open roughly 30 minutes before the advertised start — queues build fast, come early to skip the line.</li>
            <li>Tickets are personal once claimed to an AMOR account and can't be resold or transferred.</li>
          </ul>
          <p class="muted" style="font-size:0.85rem; margin-top:14px;">More questions? See the full <a href="/faq" class="accent">FAQ</a>.</p>
        </div>
      </div>
    </div>
  </section>`;
  const ogImage = origin ? `${origin}${photo && photo.image_path && !/\.(mp4|mov|webm|m4v)$/i.test(photo.image_path) ? photo.image_path : '/img/logo-hero.jpg'}` : undefined;
  return layout({
    title: event.title, user, active: 'events', body, query,
    og: {
      title: `${event.title} — AMOR`,
      description: event.description || `${event.venue}, ${event.city} — ${formatDate(event.event_date)}. Tickets via Fatsoma.`,
      image: ogImage,
      type: 'website',
    },
  });
}

function pastEventDetailPage({ user, query, event, photos, origin }) {
  const body = `
  <section style="padding-top:48px;">
    <div class="wrap">
      <div class="eyebrow">${formatDate(event.event_date)} · ${escapeHtml(event.venue)}, ${escapeHtml(event.city)}</div>
      <h1 class="h2">${escapeHtml(event.title)}</h1>
      ${event.description ? `<p class="lede">${escapeHtml(event.description)}</p>` : ''}
    </div>
  </section>
  <section style="padding-top:0;">
    <div class="wrap">
      ${photoGallery(photos)}
      ${!photos.length ? '<p class="muted" style="margin-top:16px;">Real photos from this night go here — add them from the admin panel.</p>' : ''}
    </div>
  </section>`;
  const firstPhoto = photos.find((p) => p.image_path && !/\.(mp4|mov|webm|m4v)$/i.test(p.image_path));
  const ogImage = origin ? `${origin}${firstPhoto ? firstPhoto.image_path : '/img/logo-hero.jpg'}` : undefined;
  return layout({
    title: event.title, user, active: 'past', body, query,
    og: {
      title: `${event.title} — AMOR`,
      description: event.description || `${event.venue}, ${event.city} — ${formatDate(event.event_date)}.`,
      image: ogImage,
    },
  });
}

module.exports = { eventsListPage, pastEventsListPage, eventDetailPage, pastEventDetailPage };
