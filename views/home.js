'use strict';
const { layout, flash } = require('./layout');
const { eventCard } = require('./components');
const { escapeHtml, formatDate } = require('../lib/util');

function homePage({ user, query, upcoming, pastFeatured, stats, heroPhotos = [], origin }) {
  const next = upcoming && upcoming[0];
  // Pure-CSS N-image crossfade: every <img> shares one @keyframes and one
  // animation-duration (N * SLOT seconds), each offset by a negative delay
  // of its own index * SLOT — the classic dependency-free slideshow trick,
  // so there's no JS to fail. The keyframe's "visible" window has to be
  // 1/N of the cycle, which isn't expressible as a static rule since N
  // varies with however many photos are uploaded — so it's generated here,
  // sized to the real count, rather than living in style.css. No photos
  // uploaded yet -> render nothing, hero just keeps its plain background.
  const HERO_SLOT_SECONDS = 6;
  const heroCount = heroPhotos.length;
  let heroBg = '';
  if (heroCount === 1) {
    heroBg = `
    <div class="hero-bg" aria-hidden="true">
      <img src="${escapeHtml(heroPhotos[0].image_path)}" alt="" style="opacity:1;">
      <div class="hero-bg-scrim"></div>
    </div>`;
  } else if (heroCount > 1) {
    const slotPct = 100 / heroCount;
    const fadeIn = (slotPct * 0.15).toFixed(2);
    const hold = (slotPct * 0.85).toFixed(2);
    const slotEnd = slotPct.toFixed(2);
    heroBg = `
    <style>
      @keyframes hero-bg-fade {
        0% { opacity: 0; }
        ${fadeIn}% { opacity: 1; }
        ${hold}% { opacity: 1; }
        ${slotEnd}%, 100% { opacity: 0; }
      }
    </style>
    <div class="hero-bg" aria-hidden="true">
      ${heroPhotos.map((p, i) => `
      <img src="${escapeHtml(p.image_path)}" alt=""
        style="animation-duration:${heroCount * HERO_SLOT_SECONDS}s; animation-delay:-${i * HERO_SLOT_SECONDS}s;">
      `).join('')}
      <div class="hero-bg-scrim"></div>
    </div>`;
  }
  const body = `
  ${flash(query)}
  ${next ? `
  <div class="countdown-bar">
    <div class="wrap countdown-bar-inner">
      <span class="countdown-label">Next up — ${escapeHtml(next.title)}, ${escapeHtml(next.venue)}</span>
      <span class="countdown-value" data-countdown="${next.event_date}">${formatDate(next.event_date)}</span>
    </div>
  </div>` : ''}
  <section class="hero${heroPhotos.length ? ' hero-has-bg' : ''}">
    ${heroBg}
    <div class="wrap hero-solo">
      <div class="eyebrow">Bath · Student Nightlife</div>
      <h1 class="display">Where the<br>term actually<br>starts.</h1>
      <p class="lede">AMOR runs Bath's student club nights — from one-off takeovers to the events everyone's still talking about in week 10. Tickets, a rep programme that pays, and a membership that gets you further in the door.</p>
      <div class="hero-actions">
        <a href="/events" class="btn btn-solid">See upcoming events</a>
        <a href="/membership" class="btn">Explore membership</a>
      </div>
      ${(() => {
        // Never ship a visibly blank/zero stat — a brand-new deployment with
        // no events run yet, no tickets tracked, or no reps signed up should
        // just show fewer tiles, not "0+" ones that read as broken.
        // data-count-to + data-suffix drive a one-time count-up animation
        // (0 -> the real number) on page load, handled by
        // /js/stat-counters.js. The real number is still what's in the
        // markup, so anyone without JS (or a crawler) just sees the
        // correct static value — the animation is a progressive
        // enhancement, not the source of truth.
        const tiles = [
          stats.eventsRun > 0 ? `<div class="hero-stat"><b data-count-to="${stats.eventsRun}" data-suffix="+">${stats.eventsRun}+</b><span>Events run</span></div>` : '',
          stats.ticketsSold > 0 ? `<div class="hero-stat"><b data-count-to="${stats.ticketsSold}" data-suffix="+">${stats.ticketsSold}+</b><span>Tickets sold</span></div>` : '',
          stats.repCount > 0 ? `<div class="hero-stat"><b data-count-to="${stats.repCount}">${stats.repCount}</b><span>Active reps</span></div>` : '',
        ].filter(Boolean);
        return tiles.length ? `<div class="hero-stats">${tiles.join('')}</div>` : '';
      })()}
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="section-head">
        <h2 class="h2">Coming up</h2>
        <a href="/events" class="muted">All events →</a>
      </div>
      <div class="grid grid-3">
        ${upcoming.length ? upcoming.map((e) => eventCard(e)).join('') : '<p class="muted">Nothing on sale yet — check back soon.</p>'}
      </div>
    </div>
  </section>

  <hr class="hr">

  <section>
    <div class="wrap split">
      <div>
        <div class="eyebrow">Membership</div>
        <h2 class="h2">Skip the line.<br>Earn as you go.</h2>
        <p class="lede">Members bank points on every ticket, unlock presale access before events go public, and build up credits toward future nights. Reps earn commission and climb the leaderboard.</p>
        <div style="margin-top:26px;">
          <a href="/membership" class="btn btn-solid">View plans</a>
        </div>
      </div>
      <div>
        ${pastFeatured ? `
        <div class="eyebrow" style="margin-bottom:14px;">From the archive</div>
        ${eventCard(pastFeatured)}
        ` : ''}
      </div>
    </div>
  </section>

  <hr class="hr">

  <section class="band-dark">
    <div class="wrap" style="text-align:center;">
      <h2 class="h2">Sell tickets. Earn commission. Get ranked.</h2>
      <p class="lede" style="margin:14px auto 28px;">The AMOR rep programme is 30 students strong. Every ticket sold through your link earns cash commission and climbs you up the live leaderboard.</p>
      <a href="/team" class="btn">See the leaderboard</a>
    </div>
  </section>
  `;
  return layout({
    title: 'Home', user, active: 'home', body, query,
    og: {
      title: 'AMOR — Bath Student Nightlife',
      description: "AMOR runs Bath's student club nights — tickets, a rep programme that pays, and a membership that gets you further in the door.",
      image: origin ? `${origin}/img/logo-hero.jpg` : undefined,
    },
  });
}

module.exports = { homePage };
