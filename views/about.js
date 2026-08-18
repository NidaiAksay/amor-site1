'use strict';
const { layout } = require('./layout');
const { escapeHtml } = require('../lib/util');

// NOTE for Nidai: this is placeholder brand copy — swap in your real
// founder story, dates and specifics whenever you're ready. It's written
// generically on purpose so nothing here needs to be fact-checked before
// it goes live, but it'll land much better once it's actually your story.
function aboutPage({ user, query, origin, testimonials = [] }) {
  // Real quotes only (added in Admin → Testimonials, never invented) — the
  // whole section just doesn't render until at least one is published,
  // rather than shipping placeholder/fake reviews.
  const testimonialsSection = testimonials.length ? `
  <hr class="hr">
  <section>
    <div class="wrap">
      <div class="section-head"><h2 class="h3">What people say</h2></div>
      <div class="grid grid-3">
        ${testimonials.map((t) => `
        <div class="card">
          <p style="line-height:1.7; font-size:0.95rem;">&ldquo;${escapeHtml(t.quote)}&rdquo;</p>
          ${t.attribution ? `<p class="muted" style="margin-top:12px; font-size:0.82rem;">— ${escapeHtml(t.attribution)}</p>` : ''}
        </div>`).join('')}
      </div>
    </div>
  </section>` : '';
  const body = `
  <section style="padding-top:56px;">
    <div class="wrap">
      <div class="eyebrow">About</div>
      <h1 class="h2">Why AMOR exists</h1>
      <p class="lede">AMOR started with a simple problem: Bath's student nightlife was inconsistent — a great night out shouldn't be a coin flip. We started booking venues, building a rep programme, and running nights people actually talk about the week after.</p>
    </div>
  </section>

  <section style="padding-top:0;">
    <div class="wrap split">
      <div>
        <h3 class="h3" style="margin-bottom:10px;">What we actually do</h3>
        <p class="muted" style="line-height:1.8;">We book real venues, run real events, and sell tickets through Fatsoma — no scalping, no fake urgency, no smoke and mirrors. Every event on this site either happened or is genuinely on sale. The past-events archive is real photos from real nights, not stock imagery.</p>
      </div>
      <div>
        <h3 class="h3" style="margin-bottom:10px;">The rep programme</h3>
        <p class="muted" style="line-height:1.8;">30 students across Bath sell tickets, earn commission on every one, and climb a live leaderboard with bonuses for the top performers. It's real sales and marketing experience, not just a discount code — see <a href="/team" class="accent">the team page</a> to apply.</p>
      </div>
    </div>
  </section>
  ${testimonialsSection}
  <hr class="hr">

  <section style="text-align:center;">
    <div class="wrap">
      <h2 class="h3">Where we're headed</h2>
      <p class="lede" style="margin:12px auto 28px; max-width:560px;">From one-off takeovers to the nights everyone's still talking about in week 10 — and eventually, recurring nights people build their week around. Follow along on Instagram for what's next.</p>
      <a href="https://instagram.com/theamorbath" target="_blank" rel="noopener" class="btn btn-solid">Follow @theamorbath</a>
    </div>
  </section>`;
  return layout({
    title: 'About',
    user,
    active: 'about',
    body,
    query,
    og: {
      title: 'About AMOR',
      description: "Why AMOR exists — Bath's student nightlife brand, the rep programme, and where it's headed.",
      image: origin ? `${origin}/img/logo-hero.jpg` : undefined,
    },
  });
}

module.exports = { aboutPage };
