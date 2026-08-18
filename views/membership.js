'use strict';
const { layout, flash } = require('./layout');
const { escapeHtml, formatMoney } = require('../lib/util');

function membershipPage({ user, query, plans, currentMembership }) {
  const body = `
  <section style="padding-top:56px;">
    <div class="wrap">
      <div class="eyebrow">Membership</div>
      <h1 class="h2">Get more from every night out</h1>
      <p class="lede">Members earn points on every ticket, unlock presale windows before the public, and stack credits toward future events. Pick a plan below.</p>
    </div>
  </section>
  <section style="padding-top:16px;">
    <div class="wrap">
      ${flash(query)}
      <div class="grid ${plans.length >= 4 ? 'grid-4' : 'grid-3'}">
        ${plans.map((p) => `
        <div class="plan ${p.slug === 'plus' ? 'featured' : ''}">
          <div class="eyebrow">${escapeHtml(p.period)}</div>
          <h3 class="h3">${escapeHtml(p.name)}</h3>
          <div class="price">${formatMoney(p.price_cents)}<span> / ${escapeHtml(p.period)}</span></div>
          <p class="muted" style="font-size:0.88rem;">${escapeHtml(p.tagline)}</p>
          <ul>
            ${p.perks.split('\n').filter(Boolean).map((perk) => `<li>${escapeHtml(perk)}</li>`).join('')}
          </ul>
          ${renderCta(p, user, currentMembership)}
        </div>
        `).join('')}
      </div>
    </div>
  </section>

  <hr class="hr">

  <section>
    <div class="wrap split">
      <div>
        <div class="eyebrow">Points</div>
        <h2 class="h3">How points work</h2>
        <p class="lede">You earn points every time you claim a ticket on your account — the more nights you come to, the faster they add up. Points are a running record of your AMOR history; redemptions against future perks are announced per season.</p>
      </div>
      <div>
        <div class="eyebrow">Credits</div>
        <h2 class="h3">How credits work</h2>
        <p class="lede">Credits are cash-value balance (in £) added to your account — by membership perks, promos, or by AMOR directly. Show your balance on the door or use it toward a future ticket.</p>
      </div>
    </div>
  </section>`;
  return layout({ title: 'Membership', user, active: 'membership', body, query });
}

function renderCta(plan, user, currentMembership) {
  if (currentMembership && currentMembership.plan_id === plan.id) {
    if (currentMembership.status === 'active') {
      return `<div class="pill pill-active" style="text-align:center; padding:12px; display:block;">Your active plan</div>`;
    }
    if (currentMembership.status === 'pending') {
      return `<div class="pill" style="text-align:center; padding:12px; display:block;">Request pending approval</div>`;
    }
  }
  if (!user) {
    return `<a href="/signup?next=/membership" class="btn btn-block">Join to subscribe</a>`;
  }
  return `
  <form method="POST" action="/membership/subscribe">
    <input type="hidden" name="plan_id" value="${plan.id}">
    <button type="submit" class="btn btn-block">Choose ${escapeHtml(plan.name)}</button>
  </form>`;
}

module.exports = { membershipPage };
