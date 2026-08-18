'use strict';
const { layout, flash } = require('./layout');
const { photoTile } = require('./components');
const { escapeHtml, formatDate, formatMoney } = require('../lib/util');
const { CONTACT_EMAIL } = require('../lib/contact');

function adminNav(activeSub) {
  const tabs = [
    ['/admin', 'Overview', 'overview'],
    ['/admin/analytics', 'Analytics', 'analytics'],
    ['/admin/events', 'Events', 'events'],
    ['/admin/members', 'Members', 'members'],
    ['/admin/memberships', 'Membership requests', 'memberships'],
    ['/admin/reps', 'Reps & Sales', 'reps'],
    ['/admin/applications', 'Team applications', 'applications'],
    ['/admin/suggestions', 'Song suggestions', 'suggestions'],
    ['/admin/testimonials', 'Testimonials', 'testimonials'],
    ['/admin/messages', 'Messages', 'messages'],
  ];
  return `<div class="tabs">${tabs.map(([href, label, key]) => `<a href="${href}" class="${activeSub === key ? 'active' : ''}">${label}</a>`).join('')}</div>`;
}

function adminDashboard({ user, query, stats, settings, attention, heroPhotos = [] }) {
  const items = [
    attention.pendingMemberships > 0 ? { label: `${attention.pendingMemberships} pending membership request${attention.pendingMemberships === 1 ? '' : 's'}`, href: '/admin/memberships' } : null,
    attention.pendingApplications > 0 ? { label: `${attention.pendingApplications} new team application${attention.pendingApplications === 1 ? '' : 's'}`, href: '/admin/applications' } : null,
    attention.newSuggestions > 0 ? { label: `${attention.newSuggestions} new song suggestion${attention.newSuggestions === 1 ? '' : 's'}`, href: '/admin/suggestions' } : null,
    attention.unreadMessages > 0 ? { label: `${attention.unreadMessages} unread contact message${attention.unreadMessages === 1 ? '' : 's'}`, href: '/admin/messages' } : null,
  ].filter(Boolean);

  const body = `
  <section style="padding-top:48px;">
    <div class="wrap">
      <div class="eyebrow">Admin</div>
      <h1 class="h2">Overview</h1>
      ${flash(query)}
      ${adminNav('overview')}

      <div class="card" style="margin-bottom:28px;">
        <h3 class="h3" style="margin-bottom:14px;">Needs attention</h3>
        ${items.length ? `
        <ul style="margin:0; padding-left:0; list-style:none; display:flex; flex-direction:column; gap:8px;">
          ${items.map((i) => `<li><a href="${i.href}" class="btn btn-sm">${escapeHtml(i.label)}</a></li>`).join('')}
        </ul>
        ` : `<p class="muted" style="margin:0;">You're all caught up.</p>`}
      </div>

      <div class="stat-row">
        <div class="stat-box"><b>${stats.members}</b><span>Members</span></div>
        <div class="stat-box"><b>${stats.upcomingEvents}</b><span>Upcoming events</span></div>
        <div class="stat-box"><b>${stats.ticketsClaimed}</b><span>Tickets claimed</span></div>
      </div>
      <div class="stat-row">
        <div class="stat-box"><b>${stats.pendingMemberships}</b><span>Pending membership requests</span></div>
        <div class="stat-box"><b>${stats.activeReps}</b><span>Active reps</span></div>
        <div class="stat-box"><b>${formatMoney(stats.creditsOutstanding)}</b><span>Credits outstanding</span></div>
      </div>
      <p class="muted" style="margin:20px 0 0; font-size:0.9rem;">
        Want visits, conversion rate and other growth data? See <a href="/admin/analytics" class="accent">Analytics</a>.
        Need the raw numbers? <a href="/admin/export/tickets.csv" class="accent">Export tickets CSV</a>.
      </p>

      <div class="card" style="margin-top:28px;">
        <h3 class="h3" style="margin-bottom:6px;">Homepage hero photos</h3>
        <p class="muted" style="font-size:0.85rem; margin-bottom:16px;">Real crowd/atmosphere shots that crossfade behind the homepage headline. Add at least 3-6 for a proper rotation — with none uploaded, the homepage just shows the plain dark background (no broken look either way).</p>
        <form method="POST" action="/admin/hero-photos" enctype="multipart/form-data">
          <div class="field"><label>Photo</label><input type="file" name="photo" accept="image/*" required></div>
          <button type="submit" class="btn">Upload hero photo</button>
        </form>
        ${heroPhotos.length ? `
        <div class="gallery" style="margin-top:20px;">
          ${heroPhotos.map((p) => `
          <div>
            ${photoTile({ id: p.id, image_path: p.image_path, caption: 'Hero photo' })}
            <form method="POST" action="/admin/hero-photos/${p.id}/delete" style="margin-top:6px;">
              <button type="submit" class="btn btn-sm btn-block">Remove</button>
            </form>
          </div>`).join('')}
        </div>
        ` : `<p class="muted" style="margin-top:16px;">No hero photos yet — the homepage will just show the dark background until some are added.</p>`}
      </div>

      <div class="card" style="margin-top:28px; max-width:520px;">
        <h3 class="h3" style="margin-bottom:6px;">Site settings</h3>
        <p class="muted" style="font-size:0.85rem; margin-bottom:16px;">Paste any Spotify playlist link (Share → Copy link) to embed it on the <a href="/music" class="accent">Music page</a>.</p>
        <form method="POST" action="/admin/settings">
          <div class="field"><label>Spotify playlist URL</label>
            <input type="url" name="spotify_playlist_url" placeholder="https://open.spotify.com/playlist/..." value="${escapeHtml(settings.spotifyPlaylistUrl || '')}">
          </div>
          <div class="field"><label>Tickets sold — historical baseline</label>
            <input type="number" min="0" name="tickets_sold_baseline" placeholder="0" value="${escapeHtml(String(settings.ticketsSoldBaseline ?? '0'))}">
            <p class="muted" style="font-size:0.78rem; margin-top:6px;">Real sales from before this site tracked ticket claims (e.g. via Fatsoma directly). Added on top of in-app claims for the homepage "Tickets sold" stat — leave at 0 if you'd rather it only count what the site itself has tracked.</p>
          </div>
          <button type="submit" class="btn btn-solid">Save settings</button>
        </form>
      </div>
    </div>
  </section>`;
  return layout({ title: 'Admin', user, active: 'admin', body, query });
}

function adminAnalyticsPage({ user, query, stats }) {
  const maxTrend = Math.max(1, ...stats.dailyTrend.map((d) => d.c));
  const body = `
  <section style="padding-top:48px;">
    <div class="wrap">
      <div class="eyebrow">Admin</div>
      <h1 class="h2">Analytics</h1>
      ${flash(query)}
      ${adminNav('analytics')}

      <div class="stat-row">
        <div class="stat-box"><b>${stats.uniqueVisitors}</b><span>Unique visitors (all time)</span></div>
        <div class="stat-box"><b>${stats.uniqueVisitors7d}</b><span>Unique visitors (7 days)</span></div>
        <div class="stat-box"><b>${stats.totalViews}</b><span>Page views (all time)</span></div>
      </div>
      <div class="stat-row" style="margin-top:16px;">
        <div class="stat-box"><b>${stats.conversionRate.toFixed(1)}%</b><span>Visitor → ticket claim conversion</span></div>
        <div class="stat-box"><b>${stats.clickThroughRate.toFixed(1)}%</b><span>Visitor → "Get tickets" click rate</span></div>
        <div class="stat-box"><b>${stats.ticketsClaimed}</b><span>Tickets claimed (all time)</span></div>
      </div>
      <p class="muted" style="font-size:0.82rem; margin-top:10px;">Conversion rate = tickets claimed ÷ unique visitors. It's a proxy, not exact — some buyers claim from a different device than they browsed on, and pre-launch traffic has no events to convert against yet.</p>

      <div class="card" style="margin-top:28px;">
        <h3 class="h3" style="margin-bottom:16px;">Traffic — last 14 days</h3>
        ${stats.dailyTrend.length ? `
        <div style="display:flex; align-items:flex-end; gap:6px; height:120px;">
          ${stats.dailyTrend.map((d) => `
          <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%;">
            <div style="width:100%; max-width:28px; background:var(--accent); border-radius:3px 3px 0 0; height:${Math.max(4, Math.round((d.c / maxTrend) * 100))}%;" title="${escapeHtml(d.day)}: ${d.c} views"></div>
            <div class="fine" style="margin-top:6px; writing-mode:vertical-rl; font-size:0.65rem;">${d.day.slice(5)}</div>
          </div>`).join('')}
        </div>` : '<p class="muted">No traffic recorded yet — this fills in as people visit the site.</p>'}
      </div>

      <div class="split" style="margin-top:28px;">
        <div class="card">
          <h3 class="h3" style="margin-bottom:16px;">Top pages</h3>
          <table class="simple">
            <thead><tr><th>Page</th><th>Views</th></tr></thead>
            <tbody>
              ${stats.topPages.length ? stats.topPages.map((p) => `<tr><td>${escapeHtml(p.path)}</td><td><b>${p.c}</b></td></tr>`).join('') : '<tr><td colspan="2" class="muted">No data yet.</td></tr>'}
            </tbody>
          </table>
        </div>
        <div class="card">
          <h3 class="h3" style="margin-bottom:6px;">Rep link performance</h3>
          <p class="muted" style="font-size:0.82rem; margin-bottom:12px;">Hits on any link with a rep's code attached (e.g. shared event links).</p>
          <table class="simple">
            <thead><tr><th>Rep code</th><th>Link hits</th></tr></thead>
            <tbody>
              ${stats.repLinkHits.length ? stats.repLinkHits.map((r) => `<tr><td>${escapeHtml(r.rep_code)}</td><td><b>${r.c}</b></td></tr>`).join('') : '<tr><td colspan="2" class="muted">No rep link hits recorded yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>`;
  return layout({ title: 'Admin · Analytics', user, active: 'admin', body, query });
}

function adminEventsPage({ user, query, events }) {
  const body = `
  <section style="padding-top:48px;">
    <div class="wrap">
      <div class="eyebrow">Admin</div>
      <h1 class="h2">Events</h1>
      ${flash(query)}
      ${adminNav('events')}

      <div class="card" style="margin-bottom:36px;">
        <h3 class="h3" style="margin-bottom:16px;">Add event</h3>
        <form method="POST" action="/admin/events">
          <div class="grid grid-2">
            <div class="field"><label>Title</label><input type="text" name="title" required></div>
            <div class="field"><label>Date</label><input type="date" name="event_date" required></div>
            <div class="field"><label>Venue</label><input type="text" name="venue" required></div>
            <div class="field"><label>City</label><input type="text" name="city" value="Bath"></div>
            <div class="field"><label>Capacity</label><input type="number" name="capacity"></div>
            <div class="field"><label>Price from (£)</label><input type="number" step="0.01" name="price_from"></div>
            <div class="field"><label>Fatsoma URL</label><input type="url" name="fatsoma_url" placeholder="https://fatsoma.com/e/..."></div>
            <div class="field"><label>Status</label>
              <select name="status"><option value="upcoming">Upcoming</option><option value="past">Past</option></select>
            </div>
          </div>
          <div class="field"><label>Description</label><textarea name="description"></textarea></div>
          <div class="field" style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" name="selling_fast" id="selling_fast_new" style="width:auto;">
            <label for="selling_fast_new" style="margin:0;">Mark as "Selling fast"</label>
          </div>
          <div class="field" style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" name="is_dj_set" id="is_dj_set_new" style="width:auto;">
            <label for="is_dj_set_new" style="margin:0;">Resident DJ set (lists it under the Events page's DJ subsection)</label>
          </div>
          <button type="submit" class="btn btn-solid">Create event</button>
        </form>
      </div>

      <table class="simple">
        <thead><tr><th>Title</th><th>Date</th><th>Status</th><th>Venue</th><th></th></tr></thead>
        <tbody>
          ${events.map((e) => `
          <tr>
            <td>${escapeHtml(e.title)}</td>
            <td>${formatDate(e.event_date)}</td>
            <td><span class="pill ${e.status === 'upcoming' ? 'pill-active' : ''}">${escapeHtml(e.status)}</span></td>
            <td>${escapeHtml(e.venue)}</td>
            <td><a href="/admin/events/${e.id}" class="btn btn-sm">Manage</a></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </section>`;
  return layout({ title: 'Admin · Events', user, active: 'admin', body, query });
}

function adminEventDetailPage({ user, query, event, photos, waitlistRows = [], emailConfigured = false }) {
  const body = `
  <section style="padding-top:48px;">
    <div class="wrap">
      <div class="eyebrow">Admin</div>
      <h1 class="h2">${escapeHtml(event.title)}</h1>
      ${flash(query)}
      ${adminNav('events')}

      <div class="split">
        <div class="card">
          <h3 class="h3" style="margin-bottom:16px;">Edit details</h3>
          <form method="POST" action="/admin/events/${event.id}">
            <div class="grid grid-2">
              <div class="field"><label>Title</label><input type="text" name="title" value="${escapeHtml(event.title)}" required></div>
              <div class="field"><label>Date</label><input type="date" name="event_date" value="${event.event_date.slice(0,10)}" required></div>
              <div class="field"><label>Venue</label><input type="text" name="venue" value="${escapeHtml(event.venue)}" required></div>
              <div class="field"><label>City</label><input type="text" name="city" value="${escapeHtml(event.city)}"></div>
              <div class="field"><label>Capacity</label><input type="number" name="capacity" value="${event.capacity || ''}"></div>
              <div class="field"><label>Price from (£)</label><input type="number" step="0.01" name="price_from" value="${event.price_from_cents != null ? (event.price_from_cents/100).toFixed(2) : ''}"></div>
              <div class="field"><label>Fatsoma URL</label><input type="url" name="fatsoma_url" value="${escapeHtml(event.fatsoma_url || '')}"></div>
              <div class="field"><label>Status</label>
                <select name="status">
                  <option value="upcoming" ${event.status === 'upcoming' ? 'selected' : ''}>Upcoming</option>
                  <option value="past" ${event.status === 'past' ? 'selected' : ''}>Past</option>
                  <option value="cancelled" ${event.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
              </div>
            </div>
            <div class="field"><label>Description</label><textarea name="description">${escapeHtml(event.description || '')}</textarea></div>
            <div class="field" style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" name="selling_fast" id="selling_fast_edit" ${event.selling_fast ? 'checked' : ''} style="width:auto;">
              <label for="selling_fast_edit" style="margin:0;">Mark as "Selling fast" (shows a badge on the site — toggle off once it's not true)</label>
            </div>
            <div class="field" style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" name="is_dj_set" id="is_dj_set_edit" ${event.is_dj_set ? 'checked' : ''} style="width:auto;">
              <label for="is_dj_set_edit" style="margin:0;">Resident DJ set (lists it under the Events page's DJ subsection)</label>
            </div>
            <button type="submit" class="btn btn-solid">Save changes</button>
          </form>
        </div>

        <div class="card">
          <h3 class="h3" style="margin-bottom:16px;">Photos</h3>
          <form method="POST" action="/admin/events/${event.id}/photos" enctype="multipart/form-data">
            <div class="field"><label>Photo or video clip</label><input type="file" name="photo" accept="image/*,video/mp4,video/quicktime" required></div>
            <div class="field"><label>Caption</label><input type="text" name="caption" placeholder="Optional"></div>
            <button type="submit" class="btn">Upload photo</button>
          </form>
          <div class="gallery" style="margin-top:20px;">
            ${photos.map((p) => `
            <div>
              ${photoTile(p)}
              <form method="POST" action="/admin/events/${event.id}/photos/${p.id}/delete" style="margin-top:6px;">
                <button type="submit" class="btn btn-sm btn-block">Remove</button>
              </form>
            </div>`).join('')}
            ${!photos.length ? '<p class="muted">No photos uploaded yet.</p>' : ''}
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:20px;">
        <h3 class="h3" style="margin-bottom:6px;">Waitlist</h3>
        <p class="muted" style="font-size:0.85rem; margin-bottom:16px;">
          Shown on the event page instead of a dead button whenever there's no Fatsoma URL above.
          ${event.fatsoma_url
            ? 'Fatsoma URL is set, so this form isn\'t currently shown to visitors — anyone still listed below just hasn\'t been emailed yet (e.g. they joined after tickets went live, or the send failed).'
            : 'Clear the Fatsoma URL and add it later to trigger the "tickets are live" email below automatically — it only fires the moment the URL goes from empty to set.'}
          ${!emailConfigured ? ' <strong>No email provider is configured yet (RESEND_API_KEY unset)</strong> — signups are still collected, but release emails won\'t actually send until that\'s added.' : ''}
        </p>
        ${waitlistRows.length ? `
        <div class="admin-table-wrap">
        <table class="simple">
          <thead><tr><th>Email</th><th>Joined</th><th>Notified</th></tr></thead>
          <tbody>
            ${waitlistRows.map((w) => `
            <tr>
              <td>${escapeHtml(w.email)}</td>
              <td>${formatDate(w.created_at)}</td>
              <td>${w.notified_at ? formatDate(w.notified_at) : '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        </div>
        ${event.fatsoma_url && waitlistRows.some((w) => !w.notified_at) ? `
        <form method="POST" action="/admin/events/${event.id}/waitlist/resend" style="margin-top:14px;">
          <button type="submit" class="btn btn-sm">Resend waitlist emails</button>
        </form>
        ` : ''}
        ` : `<p class="muted">No one's joined the waitlist for this event yet.</p>`}
      </div>
    </div>
  </section>`;
  return layout({ title: `Admin · ${event.title}`, user, active: 'admin', body, query });
}

function adminMembersPage({ user, query, members }) {
  const body = `
  <section style="padding-top:48px;">
    <div class="wrap">
      <div class="eyebrow">Admin</div>
      <h1 class="h2">Members</h1>
      ${flash(query)}
      ${adminNav('members')}
      <div style="margin-bottom:12px;"><a href="/admin/export/members.csv" class="muted">Export CSV →</a></div>
      <div class="admin-table-wrap">
      <table class="simple">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Points</th><th>Credits</th><th>Adjust</th></tr></thead>
        <tbody>
          ${members.map((m) => `
          <tr>
            <td>${escapeHtml(m.name)}</td>
            <td class="muted">${escapeHtml(m.email)}</td>
            <td><span class="badge-role">${escapeHtml(m.role)}</span></td>
            <td>${m.points}</td>
            <td>${formatMoney(m.credits)}</td>
            <td>
              <form method="POST" action="/admin/members/${m.id}/adjust" style="display:flex; gap:6px; flex-wrap:wrap;">
                <input type="number" name="points_delta" placeholder="±pts" style="width:80px; padding:6px 8px; border:1px solid var(--line);">
                <input type="number" name="credits_delta" step="0.01" placeholder="±£" style="width:80px; padding:6px 8px; border:1px solid var(--line);">
                <button type="submit" class="btn btn-sm">Apply</button>
              </form>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
      </div>
    </div>
  </section>`;
  return layout({ title: 'Admin · Members', user, active: 'admin', body, query });
}

function adminMembershipsPage({ user, query, requests }) {
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const body = `
  <section style="padding-top:48px;">
    <div class="wrap">
      <div class="eyebrow">Admin</div>
      <h1 class="h2">Membership requests</h1>
      ${flash(query)}
      ${adminNav('memberships')}
      ${pendingCount > 1 ? `
      <form method="POST" action="/admin/memberships/bulk-approve" class="bulk-form" id="bulkApproveMemberships">
        <input type="hidden" name="ids" value="">
      </form>
      <div style="margin-bottom:10px;"><button type="submit" form="bulkApproveMemberships" data-bulk-submit data-bulk-group="memberships" class="btn btn-sm" disabled>Approve selected</button></div>
      ` : ''}
      <table class="simple">
        <thead><tr>${pendingCount > 1 ? '<th style="width:32px;"><input type="checkbox" data-select-all data-bulk-group="memberships"></th>' : ''}<th>Member</th><th>Plan</th><th>Requested</th><th>Payment</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${requests.length ? requests.map((r) => `
          <tr>
            ${pendingCount > 1 ? `<td>${r.status === 'pending' ? `<input type="checkbox" data-bulk-id="${r.id}" data-bulk-group="memberships">` : ''}</td>` : ''}
            <td>${escapeHtml(r.name)} <span class="muted">(${escapeHtml(r.email)})</span></td>
            <td>${escapeHtml(r.plan_name)}</td>
            <td class="muted">${formatDate(r.requested_at)}</td>
            <td>${r.stripe_session_id ? '<span class="pill pill-active">Card via Stripe</span>' : '<span class="pill">Manual</span>'}</td>
            <td><span class="pill ${r.status === 'active' ? 'pill-active' : ''}">${escapeHtml(r.status)}</span></td>
            <td>
              ${r.status === 'pending' ? `
              <form method="POST" action="/admin/memberships/${r.id}/approve" style="display:inline;">
                <button type="submit" class="btn btn-sm">Approve</button>
              </form>
              <form method="POST" action="/admin/memberships/${r.id}/reject" style="display:inline;">
                <button type="submit" class="btn btn-sm">Reject</button>
              </form>` : ''}
            </td>
          </tr>`).join('') : `<tr><td colspan="${pendingCount > 1 ? 7 : 6}" class="muted">No requests.</td></tr>`}
        </tbody>
      </table>
    </div>
  </section>`;
  return layout({ title: 'Admin · Memberships', user, active: 'admin', body, query });
}

function adminRepsPage({ user, query, reps, candidateUsers, events, commissionPerTicketCents }) {
  const body = `
  <section style="padding-top:48px;">
    <div class="wrap">
      <div class="eyebrow">Admin</div>
      <h1 class="h2">Reps &amp; Sales</h1>
      ${flash(query)}
      ${adminNav('reps')}
      <p class="muted" style="font-size:0.85rem;">Commission is ${formatMoney(commissionPerTicketCents)} per ticket, plus event bonuses for the top 3 reps at each event — reps see their own totals on their <a href="/team" class="accent">dashboard</a>.</p>
      <p class="muted" style="font-size:0.85rem;">Add a photo and Instagram handle per rep below to show real faces on the public <a href="/team" class="accent">leaderboard</a> — only add these once a rep has actually agreed to be featured.</p>

      <div class="split">
        <div class="card">
          <h3 class="h3" style="margin-bottom:16px;">Make a member a rep</h3>
          <form method="POST" action="/admin/reps">
            <div class="field">
              <label>Member</label>
              <select name="user_id" required>
                <option value="">Select member…</option>
                ${candidateUsers.map((u) => `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.email)})</option>`).join('')}
              </select>
            </div>
            <div class="field"><label>Rep code</label><input type="text" name="rep_code" placeholder="e.g. AMOR07" required></div>
            <button type="submit" class="btn btn-solid">Add rep</button>
          </form>
        </div>

        <div class="card">
          <h3 class="h3" style="margin-bottom:16px;">Log a sale</h3>
          <form method="POST" action="/admin/reps/sales">
            <div class="field">
              <label>Rep</label>
              <select name="rep_id" required>
                ${reps.map((r) => `<option value="${r.id}">${escapeHtml(r.name)} (${escapeHtml(r.rep_code)})</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Event</label>
              <select name="event_id">
                <option value="">Not tied to an event</option>
                ${events.map((e) => `<option value="${e.id}">${escapeHtml(e.title)} — ${formatDate(e.event_date)}</option>`).join('')}
              </select>
            </div>
            <div class="field"><label>Tickets sold</label><input type="number" name="tickets_sold" min="1" value="1" required></div>
            <div class="field"><label>Note</label><input type="text" name="note" placeholder="Optional"></div>
            <button type="submit" class="btn btn-solid">Log sale</button>
          </form>
        </div>
      </div>

      <div class="section-head" style="margin-top:36px;">
        <h3 class="h3">All reps</h3>
        <a href="/admin/export/rep-sales.csv" class="muted">Export CSV →</a>
      </div>
      <div class="admin-table-wrap">
      <table class="simple">
        <thead><tr><th>Name</th><th>Code</th><th>Status</th><th>Total sold</th><th>Commission owed (lifetime)</th><th>Profile (shown on public leaderboard)</th><th>Quick-log a sale</th></tr></thead>
        <tbody>
          ${reps.map((r) => `
          <tr>
            <td>${escapeHtml(r.name)}</td>
            <td class="muted">${escapeHtml(r.rep_code)}</td>
            <td><span class="pill ${r.status === 'active' ? 'pill-active' : ''}">${escapeHtml(r.status)}</span></td>
            <td><b>${r.total_sold || 0}</b></td>
            <td>${formatMoney((r.total_sold || 0) * commissionPerTicketCents)}</td>
            <td>
              <form method="POST" action="/admin/reps/${r.id}/profile" enctype="multipart/form-data" style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                ${r.photo_path ? `<img src="${escapeHtml(r.photo_path)}" alt="" style="width:28px; height:28px; border-radius:50%; object-fit:cover;">` : ''}
                <input type="file" name="photo" accept="image/*" style="width:120px; font-size:0.72rem;">
                <input type="text" name="instagram_handle" placeholder="@handle" value="${escapeHtml(r.instagram_handle || '')}" style="width:100px; padding:6px 8px; border:1px solid var(--line);">
                <button type="submit" class="btn btn-sm">Save</button>
              </form>
            </td>
            <td>
              <form method="POST" action="/admin/reps/sales" style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                <input type="hidden" name="rep_id" value="${r.id}">
                <select name="event_id" style="padding:6px 8px; border:1px solid var(--line); max-width:160px;">
                  <option value="">No event</option>
                  ${events.map((e) => `<option value="${e.id}">${escapeHtml(e.title)}</option>`).join('')}
                </select>
                <input type="number" name="tickets_sold" min="1" value="1" required style="width:60px; padding:6px 8px; border:1px solid var(--line);">
                <button type="submit" class="btn btn-sm">Log</button>
              </form>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
      </div>
    </div>
  </section>`;
  return layout({ title: 'Admin · Reps', user, active: 'admin', body, query });
}

function adminApplicationsPage({ user, query, applications }) {
  const pendingCount = applications.filter((a) => a.status === 'pending').length;
  const body = `
  <section style="padding-top:48px;">
    <div class="wrap">
      <div class="eyebrow">Admin</div>
      <h1 class="h2">Team applications</h1>
      ${flash(query)}
      ${adminNav('applications')}
      <p class="muted" style="font-size:0.85rem;">Approving doesn't create a login automatically (no email sending is wired up yet) — follow up with the applicant, then once they've signed up, add them as a rep from <a href="/admin/reps" class="accent">Reps &amp; Sales</a>.</p>
      ${pendingCount > 1 ? `
      <form method="POST" action="/admin/applications/bulk-approve" class="bulk-form" id="bulkApproveApplications">
        <input type="hidden" name="ids" value="">
      </form>
      <div style="margin-bottom:10px;"><button type="submit" form="bulkApproveApplications" data-bulk-submit data-bulk-group="applications" class="btn btn-sm" disabled>Approve selected</button></div>
      ` : ''}
      <table class="simple">
        <thead><tr>${pendingCount > 1 ? '<th style="width:32px;"><input type="checkbox" data-select-all data-bulk-group="applications"></th>' : ''}<th>Name</th><th>Contact</th><th>University</th><th>Message</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${applications.length ? applications.map((a) => `
          <tr>
            ${pendingCount > 1 ? `<td>${a.status === 'pending' ? `<input type="checkbox" data-bulk-id="${a.id}" data-bulk-group="applications">` : ''}</td>` : ''}
            <td>${escapeHtml(a.name)}</td>
            <td class="muted">${escapeHtml(a.email)}${a.social_handle ? `<br>${escapeHtml(a.social_handle)}` : ''}</td>
            <td>${escapeHtml(a.university || '—')}</td>
            <td style="max-width:280px;">${escapeHtml(a.message || '—')}</td>
            <td><span class="pill ${a.status === 'approved' ? 'pill-active' : ''}">${escapeHtml(a.status)}</span></td>
            <td>
              ${a.status === 'pending' ? `
              <form method="POST" action="/admin/applications/${a.id}/approve" style="display:inline;">
                <button type="submit" class="btn btn-sm">Approve</button>
              </form>
              <form method="POST" action="/admin/applications/${a.id}/decline" style="display:inline;">
                <button type="submit" class="btn btn-sm">Decline</button>
              </form>` : ''}
            </td>
          </tr>`).join('') : `<tr><td colspan="${pendingCount > 1 ? 7 : 6}" class="muted">No applications yet.</td></tr>`}
        </tbody>
      </table>
    </div>
  </section>`;
  return layout({ title: 'Admin · Applications', user, active: 'admin', body, query });
}

function adminSuggestionsPage({ user, query, suggestions }) {
  const body = `
  <section style="padding-top:48px;">
    <div class="wrap">
      <div class="eyebrow">Admin</div>
      <h1 class="h2">Song suggestions</h1>
      ${flash(query)}
      ${adminNav('suggestions')}
      <table class="simple">
        <thead><tr><th>Song</th><th>Artist</th><th>From</th><th>Note</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${suggestions.length ? suggestions.map((s) => `
          <tr>
            <td>${escapeHtml(s.song)}</td>
            <td class="muted">${escapeHtml(s.artist || '—')}</td>
            <td class="muted">${escapeHtml(s.submitted_by || '—')}</td>
            <td style="max-width:240px;">${escapeHtml(s.note || '—')}</td>
            <td><span class="pill ${s.status === 'added' ? 'pill-active' : ''}">${escapeHtml(s.status)}</span></td>
            <td>
              ${s.status === 'new' ? `
              <form method="POST" action="/admin/suggestions/${s.id}/status" style="display:inline;">
                <input type="hidden" name="status" value="added">
                <button type="submit" class="btn btn-sm">Mark added</button>
              </form>
              <form method="POST" action="/admin/suggestions/${s.id}/status" style="display:inline;">
                <input type="hidden" name="status" value="declined">
                <button type="submit" class="btn btn-sm">Decline</button>
              </form>` : ''}
            </td>
          </tr>`).join('') : `<tr><td colspan="6" class="muted">No suggestions yet.</td></tr>`}
        </tbody>
      </table>
    </div>
  </section>`;
  return layout({ title: 'Admin · Song suggestions', user, active: 'admin', body, query });
}

// Real quotes only — see lib note on the testimonials table. This page is
// the only place these get written; there's no auto-generated or sample
// content anywhere, so the About page section stays hidden until someone
// actually adds one here.
function adminTestimonialsPage({ user, query, testimonials }) {
  const body = `
  <section style="padding-top:48px;">
    <div class="wrap">
      <div class="eyebrow">Admin</div>
      <h1 class="h2">Testimonials</h1>
      ${flash(query)}
      ${adminNav('testimonials')}
      <p class="muted" style="font-size:0.85rem;">Real quotes only — pulled from Instagram comments/DMs etc, with permission. Shown on the About page once published; nothing here is auto-generated.</p>

      <div class="card" style="margin-top:20px; max-width:560px;">
        <h3 class="h3" style="margin-bottom:16px;">Add a testimonial</h3>
        <form method="POST" action="/admin/testimonials">
          <div class="field"><label>Quote</label><textarea name="quote" required placeholder="What they actually said"></textarea></div>
          <div class="field"><label>Attribution</label><input type="text" name="attribution" placeholder="e.g. Priya, 2nd year"></div>
          <button type="submit" class="btn btn-solid">Add (unpublished)</button>
        </form>
      </div>

      <div class="admin-table-wrap" style="margin-top:28px;">
      <table class="simple">
        <thead><tr><th>Quote</th><th>Attribution</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${testimonials.length ? testimonials.map((t) => `
          <tr>
            <td style="max-width:360px;">${escapeHtml(t.quote)}</td>
            <td class="muted">${escapeHtml(t.attribution || '—')}</td>
            <td><span class="pill ${t.published ? 'pill-active' : ''}">${t.published ? 'Published' : 'Draft'}</span></td>
            <td style="white-space:nowrap;">
              <form method="POST" action="/admin/testimonials/${t.id}/toggle" style="display:inline;">
                <button type="submit" class="btn btn-sm">${t.published ? 'Unpublish' : 'Publish'}</button>
              </form>
              <form method="POST" action="/admin/testimonials/${t.id}/delete" style="display:inline;">
                <button type="submit" class="btn btn-sm">Delete</button>
              </form>
            </td>
          </tr>`).join('') : `<tr><td colspan="4" class="muted">No testimonials yet.</td></tr>`}
        </tbody>
      </table>
      </div>
    </div>
  </section>`;
  return layout({ title: 'Admin · Testimonials', user, active: 'admin', body, query });
}

// Every /contact submission lands in contact_messages regardless of email
// config (see lib/db.js note) — this page is the guaranteed way to see
// them even if RESEND_API_KEY was never set.
function adminMessagesPage({ user, query, messages, emailConfigured = false }) {
  const body = `
  <section style="padding-top:48px;">
    <div class="wrap">
      <div class="eyebrow">Admin</div>
      <h1 class="h2">Messages</h1>
      ${flash(query)}
      ${adminNav('messages')}
      <p class="muted" style="font-size:0.85rem;">Everyone who submits the <a href="/contact" class="accent">/contact</a> form lands here.${!emailConfigured ? ' <strong>No email provider is configured yet (RESEND_API_KEY unset)</strong> — this list is the only place these show up right now; nothing is emailed out until that\'s added.' : ` A copy is also emailed to ${escapeHtml(CONTACT_EMAIL)}.`}</p>

      <div class="admin-table-wrap" style="margin-top:20px;">
      <table class="simple">
        <thead><tr><th>When</th><th>From</th><th>Message</th><th></th></tr></thead>
        <tbody>
          ${messages.length ? messages.map((m) => `
          <tr>
            <td class="muted" style="white-space:nowrap;">${formatDate(m.created_at)}</td>
            <td>${escapeHtml(m.name || '—')}${m.email ? `<br><a href="mailto:${escapeHtml(m.email)}" class="muted" style="font-size:0.82rem;">${escapeHtml(m.email)}</a>` : ''}</td>
            <td style="max-width:420px; white-space:pre-wrap;">${escapeHtml(m.message)}</td>
            <td>
              <form method="POST" action="/admin/messages/${m.id}/delete" style="display:inline;">
                <button type="submit" class="btn btn-sm">Delete</button>
              </form>
            </td>
          </tr>`).join('') : `<tr><td colspan="4" class="muted">No messages yet.</td></tr>`}
        </tbody>
      </table>
      </div>
    </div>
  </section>`;
  return layout({ title: 'Admin · Messages', user, active: 'admin', body, query });
}

module.exports = {
  adminDashboard,
  adminAnalyticsPage,
  adminEventsPage,
  adminEventDetailPage,
  adminMembersPage,
  adminMembershipsPage,
  adminRepsPage,
  adminApplicationsPage,
  adminSuggestionsPage,
  adminTestimonialsPage,
  adminMessagesPage,
};
