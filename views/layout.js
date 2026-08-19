'use strict';
const { escapeHtml } = require('../lib/util');

function nav(user, active) {
  const link = (href, label, key) =>
    `<a href="${href}" class="${active === key ? 'accent' : ''}">${label}</a>`;

  const rightSide = user
    ? `<a href="/account" class="nav-cta">${escapeHtml(user.name.split(' ')[0])}</a>`
    : `<a href="/login" class="nav-cta">Sign In</a>`;

  const links = `
        ${link('/events', 'Events', 'events')}
        ${link('/events/past', 'Past Events', 'past')}
        ${link('/membership', 'Membership', 'membership')}
        ${link('/music', 'Music', 'music')}
        ${link('/team', 'Team', 'team')}
        ${link('/about', 'About', 'about')}
        ${user && user.role === 'admin' ? link('/admin', 'Admin', 'admin') : ''}
  `;

  return `
  <div class="nav">
    <input type="checkbox" id="nav-toggle-input" class="nav-toggle-input">
    <div class="wrap nav-inner">
      <a href="/" class="logo-badge" aria-label="AMOR home"><img src="/img/logo-nav.png" alt="AMOR Events"></a>
      <nav class="nav-links">${links}</nav>
      <div style="display:flex; align-items:center; gap:14px;">
        ${rightSide}
        <label for="nav-toggle-input" class="nav-toggle" aria-label="Menu">
          <span></span><span></span><span></span>
        </label>
      </div>
    </div>
    <nav class="nav-mobile">${links}</nav>
  </div>`;
}

function ticker() {
  const items = ['Tickets on sale now', 'Join the leaderboard', 'Become a rep', 'AMOR'];
  const strip = items.map((t) => `<span>${t}</span><span class="ticker-dot">&bull;</span>`).join('');
  // Duplicated once so the CSS marquee loop is seamless (scrolls exactly -50%).
  return `
  <div class="ticker" aria-hidden="true">
    <div class="ticker-track">${strip}${strip}</div>
  </div>`;
}

function footer() {
  return `
  <footer>
    <div class="wrap footer-grid">
      <div>
        <div class="logo-badge logo-badge-lg"><img src="/img/logo-nav.png" alt="AMOR Events"></div>
        <p class="fine">Bath's student nightlife brand. Tickets sold via Fatsoma.<br>© ${new Date().getFullYear()} AMOR. All rights reserved.</p>
      </div>
      <div class="footer-links">
        <a href="/events">Events</a>
        <a href="/membership">Membership</a>
        <a href="/music">Music</a>
        <a href="/team">Team &amp; Reps</a>
        <a href="/about">About</a>
        <a href="/faq">FAQ</a>
        <a href="/contact">Contact</a>
        <a href="/privacy">Privacy</a>
        <a href="https://instagram.com/theamorbath" target="_blank" rel="noopener">Instagram</a>
      </div>
    </div>
    <div class="wrap footer-credit">
      Resident DJ &amp; Founder — <a href="https://instagram.com/nidai.aksay" target="_blank" rel="noopener">@nidai.aksay</a>
    </div>
  </footer>`;
}

function flash(query) {
  if (!query) return '';
  if (query.error) return `<div class="alert alert-error">${escapeHtml(query.error)}</div>`;
  if (query.ok) return `<div class="alert alert-ok">${escapeHtml(query.ok)}</div>`;
  return '';
}

function layout({ title, user, active, body, query, og }) {
  const showTicker = active !== 'admin';
  // Navy (dark) is the default theme — see the strategy notes for why.
  // The original light theme survives as an opt-in preview: ?theme=paper.
  const paperTheme = query && query.theme === 'paper';
  // Open Graph tags — without these, a link shared in a WhatsApp group or
  // Instagram DM (genuinely most of this site's rep-driven traffic) shows
  // no title/image preview at all. `og.image` must already be an absolute
  // URL (built by the caller from the request's own origin) since most
  // crawlers won't reliably resolve a relative one.
  const ogTags = og ? `
<meta property="og:title" content="${escapeHtml(og.title || title)}">
<meta property="og:description" content="${escapeHtml(og.description || '')}">
${og.image ? `<meta property="og:image" content="${escapeHtml(og.image)}">` : ''}
<meta property="og:type" content="${og.type || 'website'}">
<meta property="og:site_name" content="AMOR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(og.title || title)}">
<meta name="twitter:description" content="${escapeHtml(og.description || '')}">
${og.image ? `<meta name="twitter:image" content="${escapeHtml(og.image)}">` : ''}` : '';
  return `<!DOCTYPE html>
<html lang="en"${paperTheme ? ' data-theme="paper"' : ''}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} — AMOR</title>
<meta name="description" content="${escapeHtml((og && og.description) || "Bath's student nightlife brand — events, membership, and a rep programme that pays.")}">
<link rel="icon" type="image/svg+xml" href="/img/favicon.svg">
<link rel="stylesheet" href="/css/style.css">
${ogTags}
</head>
<body>
${nav(user, active)}
${showTicker ? ticker() : ''}
<main data-page-main>
${body}
</main>
${footer()}
<div class="ticket-modal-backdrop" id="ticketModalBackdrop" aria-hidden="true">
  <div class="ticket-modal">
    <div class="ticket-card" id="ticketCard" role="dialog" aria-modal="true" aria-labelledby="ticketTitle">
      <button type="button" class="ticket-modal-close" id="ticketModalClose" aria-label="Close">&times;</button>
      <div class="ticket-card-main">
        <div class="ticket-eyebrow">AMOR presents</div>
        <h3 class="ticket-title" id="ticketTitle">—</h3>
        <div class="ticket-row"><span>Date</span><b id="ticketDate">—</b></div>
        <div class="ticket-row"><span>Venue</span><b id="ticketVenue">—</b></div>
        <div class="ticket-row"><span>From</span><b id="ticketPrice">—</b></div>
      </div>
      <div class="ticket-perf"></div>
      <div class="ticket-card-stub">
        <div class="ticket-stub-label">ADMIT ONE</div>
        <a href="#" id="ticketContinue" target="_blank" rel="noopener" class="btn btn-solid">Continue to Fatsoma</a>
      </div>
    </div>
  </div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/gsap.min.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/ScrollTrigger.min.js" defer></script>
<script src="/js/animations.js" defer></script>
<script src="/js/ticket-modal.js" defer></script>
<script src="/js/countdown.js" defer></script>
<script src="/js/rep-link.js" defer></script>
<script src="/js/stat-counters.js" defer></script>
${active === 'admin' ? '<script src="/js/admin-bulk.js" defer></script>' : ''}
</body>
</html>`;
}

module.exports = { layout, flash };
