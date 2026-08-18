'use strict';
const { layout, flash } = require('./layout');
const { escapeHtml, formatDate } = require('../lib/util');

// Accepts a normal open.spotify.com playlist/album/track link (what anyone
// gets from "Share") and converts it to Spotify's embeddable iframe form —
// no API key or app registration needed for a read-only embedded player.
function spotifyEmbedUrl(url) {
  if (!url) return null;
  const m = String(url).match(/open\.spotify\.com\/(playlist|album|track)\/([a-zA-Z0-9]+)/);
  if (!m) return null;
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0`;
}

function musicPage({ user, query, playlistUrl, suggestions }) {
  const embed = spotifyEmbedUrl(playlistUrl);
  const body = `
  <section style="padding-top:56px;">
    <div class="wrap">
      <div class="eyebrow">Sound</div>
      <h1 class="h2">The AMOR playlist</h1>
      <p class="lede">What we play on the night, and what you want to hear next. Listen ahead, then tell us what to add.</p>
    </div>
  </section>

  <section style="padding-top:0;">
    <div class="wrap split">
      <div>
        ${embed ? `
        <div class="card" style="padding:0; overflow:hidden;">
          <iframe style="border-radius:12px; display:block;" src="${escapeHtml(embed)}" width="100%" height="480"
            frameborder="0" allowfullscreen=""
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
        </div>` : `
        <div class="card" style="text-align:center; padding:64px 24px;">
          <p class="muted">Playlist link not added yet — check back soon, or follow @theamorbath for updates.</p>
        </div>`}
      </div>

      <div>
        <div class="card">
          <h3 class="h3" style="margin-bottom:6px;">Suggest a song</h3>
          <p class="muted" style="font-size:0.88rem; margin-bottom:16px;">Tell us what should be in the set — we read every request and pull the best into upcoming nights.</p>
          ${flash(query)}
          <form method="POST" action="/music/suggest">
            <div class="field"><label>Song</label><input type="text" name="song" required placeholder="e.g. Titanium"></div>
            <div class="field"><label>Artist</label><input type="text" name="artist" placeholder="e.g. David Guetta, Sia"></div>
            <div class="field"><label>Your name or Instagram (optional)</label><input type="text" name="submitted_by" placeholder="@yourhandle"></div>
            <div class="field"><label>Note (optional)</label><input type="text" name="note" placeholder="e.g. good opener, save for the last hour"></div>
            <button type="submit" class="btn btn-solid btn-block">Send suggestion</button>
          </form>
        </div>
      </div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="section-head"><h2 class="h3">Recent suggestions</h2><span class="muted">From the AMOR crowd</span></div>
      ${suggestions.length ? `
      <div class="grid grid-4">
        ${suggestions.slice(0, 12).map((s) => `
        <div class="card">
          <div style="font-weight:700;">${escapeHtml(s.song)}</div>
          ${s.artist ? `<div class="muted" style="font-size:0.88rem;">${escapeHtml(s.artist)}</div>` : ''}
          ${s.submitted_by ? `<div class="fine" style="margin-top:8px;">— ${escapeHtml(s.submitted_by)}</div>` : ''}
          ${s.status === 'added' ? '<span class="pill pill-active" style="margin-top:8px; display:inline-block;">In the set</span>' : ''}
        </div>`).join('')}
      </div>` : '<p class="muted">No suggestions yet — be the first.</p>'}
    </div>
  </section>`;
  return layout({ title: 'Music', user, active: 'music', body, query });
}

module.exports = { musicPage, spotifyEmbedUrl };
