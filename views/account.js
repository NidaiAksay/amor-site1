'use strict';
const { layout, flash } = require('./layout');
const { escapeHtml, formatDate, formatMoney } = require('../lib/util');

function accountPage({ user, query, pointsBalance, creditsBalance, membership, plan, tickets, repInfo, repSales, nextEvent }) {
  const shareLink = nextEvent ? `/events/${nextEvent.slug}?rep=` : `/events?rep=`;
  const body = `
  <section style="padding-top:48px;">
    <div class="wrap">
      <div class="eyebrow">Your account</div>
      <h1 class="h2">Hey, ${escapeHtml(user.name.split(' ')[0])}</h1>
      ${flash(query)}
      <div class="stat-row">
        <div class="stat-box"><b>${pointsBalance}</b><span>Points</span></div>
        <div class="stat-box"><b>${formatMoney(creditsBalance)}</b><span>Credits</span></div>
        <div class="stat-box"><b>${membership && membership.status === 'active' ? escapeHtml(plan.name) : '—'}</b><span>Membership</span></div>
      </div>

      ${membership && membership.status === 'pending' ? `
      <div class="alert" style="background:#f0efec; border:1px solid var(--line);">
        Your <b>${escapeHtml(plan.name)}</b> membership request is pending — AMOR will confirm once payment is received.
      </div>` : ''}

      <div class="tabs">
        <a href="#tickets" class="active">Tickets</a>
        <a href="/membership">Membership plans</a>
        ${repInfo ? `<a href="#rep">Rep dashboard</a>` : ''}
      </div>

      <div id="tickets">
        <h2 class="h3" style="margin-bottom:16px;">Your tickets</h2>
        ${tickets.length ? `
        <table class="simple">
          <thead><tr><th>Event</th><th>Date</th><th>Qty</th><th>Status</th><th>Points earned</th><th>Code</th></tr></thead>
          <tbody>
            ${tickets.map((t) => `
            <tr>
              <td>${escapeHtml(t.title)}${t.is_membership_comp ? ' <span class="badge-selling-fast" style="position:static; display:inline-block; margin-left:6px;">Free — AMOR Unlimited</span>' : ''}</td>
              <td>${formatDate(t.event_date)}</td>
              <td>${t.quantity}</td>
              <td>${t.status === 'verified' ? '<span class="pill pill-active">Verified</span>' : t.status === 'rejected' ? '<span class="pill">Not verified</span>' : '<span class="pill">Pending review</span>'}</td>
              <td>${t.status === 'pending' ? '<span class="muted">—</span>' : `+${t.points_awarded}`}</td>
              <td class="muted">${escapeHtml(t.redeem_code)}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : `<p class="muted">No tickets claimed yet — claim one from an event page after you buy on Fatsoma.</p>`}
      </div>

      ${repInfo ? `
      <div id="rep" style="margin-top:56px;">
        <h2 class="h3" style="margin-bottom:6px;">Rep dashboard</h2>
        <p class="muted" style="margin-bottom:16px;">Your code: <b>${escapeHtml(repInfo.rep_code)}</b> · share your link below so ticket claims credit you on the leaderboard automatically.</p>
        <div class="field" style="max-width:460px;">
          <label>Your shareable link</label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="repShareLink" readonly value="${shareLink}${escapeHtml(repInfo.rep_code)}">
            <button type="button" class="btn btn-sm" id="repShareCopy" style="white-space:nowrap;">Copy link</button>
          </div>
        </div>
        <table class="simple">
          <thead><tr><th>Event</th><th>Tickets sold</th><th>Logged</th></tr></thead>
          <tbody>
            ${repSales.length ? repSales.map((s) => `
            <tr><td>${escapeHtml(s.title || 'General')}</td><td><b>${s.tickets_sold}</b></td><td class="muted">${formatDate(s.created_at)}</td></tr>
            `).join('') : `<tr><td colspan="3" class="muted">No sales logged yet.</td></tr>`}
          </tbody>
        </table>
      </div>` : ''}

      <div style="margin-top:56px; max-width:420px;">
        <h2 class="h3" style="margin-bottom:6px;">Security</h2>
        <p class="muted" style="margin-bottom:16px; font-size:0.85rem;">Change your password — do this now if you're still using a shared/demo one.</p>
        <form method="POST" action="/account/password">
          <div class="field"><label>Current password</label><input type="password" name="current_password" required></div>
          <div class="field"><label>New password</label><input type="password" name="new_password" minlength="8" required></div>
          <div class="field"><label>Confirm new password</label><input type="password" name="new_password_confirm" minlength="8" required></div>
          <button type="submit" class="btn btn-solid">Update password</button>
        </form>
      </div>
    </div>
  </section>`;
  return layout({ title: 'Account', user, active: '', body, query });
}

module.exports = { accountPage };
