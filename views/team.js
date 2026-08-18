'use strict';
const { layout, flash } = require('./layout');
const { repInitials } = require('./components');
const { escapeHtml, formatMoney, formatDate, milestoneBadge } = require('../lib/util');

function leaderboardTable(leaderboard, highlightRepId) {
  return `
  <div class="admin-table-wrap">
  <table class="leaderboard">
    <thead>
      <tr><th>#</th><th>Rep</th><th>Code</th><th>Tickets sold</th><th>Status</th></tr>
    </thead>
    <tbody>
      ${leaderboard.length ? leaderboard.map((r, i) => {
        const badge = milestoneBadge(r.total_sold || 0);
        return `
      <tr${highlightRepId && r.id === highlightRepId ? ' style="outline:2px solid var(--accent); outline-offset:-2px;"' : ''}>
        <td class="rank ${i === 0 ? 'rank-1' : i < 3 ? 'rank-2' : ''}">${i + 1}</td>
        <td>${escapeHtml(r.name)}${highlightRepId && r.id === highlightRepId ? ' <span class="pill pill-active">You</span>' : ''}${badge ? ` <span class="pill">${badge}</span>` : ''}</td>
        <td class="muted">${escapeHtml(r.rep_code)}</td>
        <td><b>${r.total_sold || 0}</b></td>
        <td><span class="pill ${r.status === 'active' ? 'pill-active' : ''}">${escapeHtml(r.status)}</span></td>
      </tr>`;
      }).join('') : `<tr><td colspan="5" class="muted">No reps yet.</td></tr>`}
    </tbody>
  </table>
  </div>`;
}

function repsGrid(leaderboard) {
  return `
  <div class="grid grid-4">
    ${leaderboard.map((r) => {
      const badge = milestoneBadge(r.total_sold || 0);
      return `
    <div class="card rep-card">
      ${r.photo_path
        ? `<img src="${escapeHtml(r.photo_path)}" alt="${escapeHtml(r.name)}" class="rep-avatar rep-avatar-photo">`
        : `<div class="rep-avatar">${repInitials(r.name)}</div>`}
      <div>${escapeHtml(r.name)}</div>
      <div class="rep-code">${escapeHtml(r.rep_code)}</div>
      ${r.instagram_handle ? `<a href="https://instagram.com/${escapeHtml(r.instagram_handle.replace(/^@/, ''))}" target="_blank" rel="noopener" class="muted" style="font-size:0.78rem; margin-top:4px; display:block;">${escapeHtml(r.instagram_handle)}</a>` : ''}
      ${badge ? `<div class="pill" style="margin-top:8px;">${badge}</div>` : ''}
    </div>`;
    }).join('')}
  </div>`;
}

// ---------------------------------------------------------------- non-rep
// Anyone who isn't already a rep (logged out, a member, whoever) lands here:
// why-join pitch + an application form. No account is created automatically
// on submit — an admin reviews it and follows up (see /admin/applications).
function teamJoinPage({ user, query, leaderboard = [] }) {
  const body = `
  <section style="padding-top:56px;">
    <div class="wrap split">
      <div>
        <div class="eyebrow">Join the team</div>
        <h1 class="h2">Sell for AMOR. Earn every night out.</h1>
        <p class="lede">AMOR reps get a personal tracking link, cash commission on every ticket sold, and bonuses for topping the leaderboard at each event — on top of free/discounted entry and first access to every night before it's publicly on sale.</p>
        <div class="grid grid-2" style="margin-top:28px; gap:16px;">
          <div class="card">
            <div style="font-weight:700; margin-bottom:6px;">Commission per ticket</div>
            <div class="muted" style="font-size:0.9rem;">Paid on every ticket sold through your link or claimed with your code — no cap.</div>
          </div>
          <div class="card">
            <div style="font-weight:700; margin-bottom:6px;">Event bonuses</div>
            <div class="muted" style="font-size:0.9rem;">Top 3 reps by tickets sold at each event earn an extra cash bonus on top of commission.</div>
          </div>
          <div class="card">
            <div style="font-weight:700; margin-bottom:6px;">Free entry &amp; perks</div>
            <div class="muted" style="font-size:0.9rem;">Reps get into the nights they sell for, plus first look at every date before it drops publicly.</div>
          </div>
          <div class="card">
            <div style="font-weight:700; margin-bottom:6px;">Real experience</div>
            <div class="muted" style="font-size:0.9rem;">Sales, marketing and events experience for your CV — AMOR is a real, growing student business.</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="h3" style="margin-bottom:16px;">Apply to join</h3>
        ${flash(query)}
        <form method="POST" action="/team/apply">
          <div class="field"><label>Full name</label><input type="text" name="name" required value="${escapeHtml(user ? user.name : '')}"></div>
          <div class="field"><label>Email</label><input type="email" name="email" required value="${escapeHtml(user ? user.email : '')}"></div>
          <div class="field"><label>University</label><input type="text" name="university" placeholder="e.g. University of Bath" value="${escapeHtml((user && user.university) || '')}"></div>
          <div class="field"><label>Instagram handle</label><input type="text" name="social_handle" placeholder="@yourhandle"></div>
          <div class="field"><label>Why do you want to rep AMOR?</label><textarea name="message" placeholder="Course, year, societies, why you'd be good at this — a couple of lines is fine"></textarea></div>
          <button type="submit" class="btn btn-solid btn-block">Send application</button>
        </form>
      </div>
    </div>
  </section>

  <hr class="hr">

  <section>
    <div class="wrap">
      <div class="section-head"><h2 class="h3">Current leaderboard</h2><span class="muted">This season</span></div>
      <p class="muted" style="margin-bottom:16px; font-size:0.9rem;">Already a rep? <a href="/login?next=/team" class="accent">Sign in</a> to see your own dashboard, commission and bonuses.</p>
      ${leaderboard.length ? repsGrid(leaderboard) : '<p class="muted">No reps yet — be the first to apply above.</p>'}
    </div>
  </section>`;
  return layout({ title: 'Join the Team', user, active: 'team', body, query });
}

// ---------------------------------------------------------------- rep view
// A signed-in rep clicking Team sees their own performance instead of the
// application pitch: last-event standing, lifetime commission, progress
// toward the next rank, milestone badges, and any bonus earned, plus the
// same live leaderboard everyone else sees.
function teamDashboardPage({ user, query, leaderboard, repInfo, dashStats }) {
  const firstName = escapeHtml(user.name.split(' ')[0]);
  const le = dashStats.lastEventStats;
  const progress = dashStats.progressToNextRank;
  const rankChange = dashStats.rankChange;

  const rankChangeBadge = rankChange === null
    ? ''
    : rankChange > 0
      ? `<span class="pill pill-active" style="margin-left:8px;">▲ ${rankChange} this week</span>`
      : rankChange < 0
        ? `<span class="pill" style="margin-left:8px; border-color:var(--accent); color:var(--accent);">▼ ${Math.abs(rankChange)} this week</span>`
        : `<span class="pill" style="margin-left:8px;">No change this week</span>`;

  const body = `
  <section style="padding-top:56px;">
    <div class="wrap">
      <div class="eyebrow">Team dashboard</div>
      <h1 class="h2">Welcome back, ${firstName}</h1>
      <p class="lede">Your code is <b>${escapeHtml(repInfo.rep_code)}</b>. Here's how you're doing.</p>
      ${flash(query)}
    </div>
  </section>

  <section style="padding-top:0;">
    <div class="wrap">
      <div class="stat-row">
        <div class="stat-box"><b>${dashStats.totalSold}</b><span>Lifetime tickets sold</span></div>
        <div class="stat-box"><b>${formatMoney(dashStats.lifetimeCommissionCents)}</b><span>Lifetime commission earned</span></div>
        <div class="stat-box"><b>${le ? `#${le.rank}` : '—'}${rankChangeBadge}</b><span>Rank at last event</span></div>
      </div>

      <div class="card" style="margin-top:24px;">
        <h3 class="h3" style="margin-bottom:16px;">Last event performance</h3>
        ${le ? `
        <div class="stat-row">
          <div class="stat-box"><b>${escapeHtml(le.event.title)}</b><span>${formatDate(le.event.event_date)}</span></div>
          <div class="stat-box"><b>${le.ticketsSold}</b><span>Tickets sold</span></div>
          <div class="stat-box"><b>${formatMoney(le.commissionCents)}</b><span>Commission this event</span></div>
          <div class="stat-box"><b>${le.bonusCents ? formatMoney(le.bonusCents) : '—'}</b><span>${le.bonusCents ? `Bonus — #${le.rank} of ${le.totalReps}` : 'No bonus this event'}</span></div>
        </div>
        ${progress ? `
        <div style="margin-top:18px;">
          <div class="muted" style="font-size:0.85rem; margin-bottom:6px;">${progress.ticketsNeeded} more ticket${progress.ticketsNeeded === 1 ? '' : 's'} to reach rank #${progress.targetRank}</div>
          <div style="height:8px; border-radius:100px; background:var(--surface); border:1px solid var(--line); overflow:hidden;">
            <div style="height:100%; border-radius:100px; background:var(--accent); width:${Math.max(6, Math.min(100, Math.round((le.ticketsSold / (le.ticketsSold + progress.ticketsNeeded)) * 100)))}%;"></div>
          </div>
        </div>
        ` : le.rank === 1 ? `<p class="muted" style="font-size:0.85rem; margin-top:14px;">You're #1 at the last event — nice work.</p>` : ''}
        <p class="muted" style="font-size:0.85rem; margin-top:14px;">Top 3 reps by tickets sold at each event earn a bonus on top of commission.</p>
        <a href="/team/share-card" class="btn" style="margin-top:8px;">Share your stats →</a>
        ` : `<p class="muted">No sales recorded against an event yet — once your first sale lands, this fills in automatically.</p>`}
      </div>

      <div class="card" style="margin-top:20px;">
        <h3 class="h3" style="margin-bottom:14px;">Milestones</h3>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${dashStats.badges.map((b) => `<span class="pill ${b.achieved ? 'pill-active' : ''}" style="${b.achieved ? '' : 'opacity:0.45;'}">${b.achieved ? '✓ ' : ''}${escapeHtml(b.label)}</span>`).join('')}
        </div>
      </div>
    </div>
  </section>

  <hr class="hr">

  <section>
    <div class="wrap">
      <div class="section-head"><h2 class="h3">Leaderboard</h2><span class="muted">This season</span></div>
      ${leaderboardTable(leaderboard, repInfo.id)}
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="section-head"><h2 class="h3">Meet the reps</h2></div>
      ${repsGrid(leaderboard)}
    </div>
  </section>`;
  return layout({ title: 'Team Dashboard', user, active: 'team', body, query });
}

// ---------------------------------------------------------------- share card
// A portrait, story-shaped card sized for Instagram (1080x1920 aspect)
// with big bold numbers — designed to be screenshotted and posted, since
// generating a real downloadable PNG server-side would need an image
// library this project deliberately doesn't depend on. Free marketing for
// AMOR, a motivating flex for the rep.
function teamShareCardPage({ user, repInfo, dashStats }) {
  const le = dashStats.lastEventStats;
  const body = `
  <section style="padding-top:32px; text-align:center;">
    <div class="wrap" style="max-width:480px;">
      <p class="muted" style="font-size:0.85rem; margin-bottom:18px;">Screenshot the card below and post it to your story. <a href="/team" class="accent">← Back to dashboard</a></p>
      <div style="aspect-ratio:9/16; max-width:380px; margin:0 auto; border-radius:18px; overflow:hidden; position:relative; background:radial-gradient(1200px 700px at 50% -10%, rgba(91,120,255,0.35), transparent 60%), radial-gradient(1000px 700px at 50% 110%, rgba(255,84,87,0.28), transparent 60%), #05070f; border:1px solid var(--line); display:flex; flex-direction:column; justify-content:space-between; padding:32px 24px;">
        <div>
          <div style="font-size:0.7rem; letter-spacing:0.16em; text-transform:uppercase; color:#9aa3bf;">AMOR Rep</div>
          <div style="font-size:1.6rem; font-weight:800; color:#fff; margin-top:4px;">${escapeHtml(user.name)}</div>
          <div style="font-size:0.9rem; color:#9aa3bf; margin-top:2px;">${escapeHtml(repInfo.rep_code)}</div>
        </div>
        <div style="text-align:left;">
          <div style="font-size:4.4rem; font-weight:900; color:#fff; line-height:1;">${dashStats.totalSold}</div>
          <div style="font-size:0.85rem; letter-spacing:0.1em; text-transform:uppercase; color:#ff5457; font-weight:700; margin-top:4px;">Tickets sold</div>
          ${le ? `<div style="margin-top:22px; font-size:1rem; color:#fff;">#${le.rank} at ${escapeHtml(le.event.title)}</div>` : ''}
          ${le && le.bonusCents ? `<div style="margin-top:6px; font-size:0.85rem; color:#5b78ff; font-weight:700;">Bonus earned this event</div>` : ''}
        </div>
        <div style="font-size:0.7rem; letter-spacing:0.14em; text-transform:uppercase; color:#9aa3bf;">theamorbath.com</div>
      </div>
    </div>
  </section>`;
  return layout({ title: 'Share your stats', user, active: 'team', body, query: {} });
}

module.exports = { teamJoinPage, teamDashboardPage, teamShareCardPage };
