'use strict';
const { escapeHtml, formatDateShort, formatMoney } = require('../lib/util');

function cover(event, { small } = {}) {
  const tone = ((event.cover_tone || 1) % 6) + 1;
  // event.cover_photo (a real uploaded photo's path) takes over from the
  // brand gradient + letter mark once an admin has uploaded at least one
  // photo for the event — see EVENT_COVER_SQL in server.js for where it
  // comes from. No photo yet -> same placeholder as always.
  const hasPhoto = Boolean(event.cover_photo);
  return `
  <div class="cover cover-${tone} ${small ? 'cover-sm' : ''}">
    ${hasPhoto ? `<img src="${escapeHtml(event.cover_photo)}" alt="">` : `<div class="mark">A</div>`}
    <div class="label">
      <div class="eyebrow">${formatDateShort(event.event_date)} · ${escapeHtml(event.venue)}</div>
      <h4>${escapeHtml(event.title)}</h4>
    </div>
  </div>`;
}

const VIDEO_EXT = /\.(mp4|mov|webm|m4v)$/i;

function photoTile(photo) {
  if (photo.image_path && VIDEO_EXT.test(photo.image_path)) {
    const poster = photo.poster_path ? ` poster="${escapeHtml(photo.poster_path)}"` : '';
    return `<div class="cover cover-video"><video src="${escapeHtml(photo.image_path)}"${poster} muted loop autoplay playsinline preload="metadata" aria-label="${escapeHtml(photo.caption)}"></video></div>`;
  }
  if (photo.image_path) {
    return `<div class="cover"><img src="${escapeHtml(photo.image_path)}" alt="${escapeHtml(photo.caption)}"></div>`;
  }
  return `
  <div class="cover cover-${((photo.id % 6) + 1)}">
    <div class="mark">A</div>
    <div class="label"><div class="eyebrow">${escapeHtml(photo.caption || 'Placeholder')}</div></div>
  </div>`;
}

// A click-to-expand gallery with zero JavaScript: each thumbnail is a plain
// <a href="#gp-N">, each full-size view is a <div id="gp-N"> shown via the
// CSS :target selector (see .lightbox rules in style.css) — works with JS
// off, with the keyboard, and needs no client-side code to fail. Falls back
// to plain (non-clickable) placeholder tiles when there are no real photos.
function photoGallery(photos, idPrefix = 'gp') {
  if (!photos.length) {
    return `<div class="gallery">${[1, 2, 3, 4, 5, 6].map((i) => photoTile({ id: i, caption: 'Photos coming soon' })).join('')}</div>`;
  }
  const ids = photos.map((p) => `${idPrefix}-${p.id}`);
  const grid = `
  <div class="gallery">
    ${photos.map((p, i) => `<a href="#${ids[i]}" class="gallery-item" aria-label="Expand photo">${photoTile(p)}</a>`).join('')}
  </div>`;
  const overlays = photos.map((p, i) => {
    const prevId = ids[(i - 1 + ids.length) % ids.length];
    const nextId = ids[(i + 1) % ids.length];
    const isVideo = p.image_path && VIDEO_EXT.test(p.image_path);
    const media = isVideo
      ? `<video src="${escapeHtml(p.image_path)}" controls autoplay loop playsinline></video>`
      : `<img src="${escapeHtml(p.image_path)}" alt="${escapeHtml(p.caption || '')}">`;
    return `
    <div class="lightbox" id="${ids[i]}">
      <a href="#" class="lightbox-scrim" aria-label="Close"></a>
      <div class="lightbox-frame">
        ${media}
        ${p.caption ? `<div class="lightbox-caption">${escapeHtml(p.caption)}</div>` : ''}
        <a href="#" class="lightbox-close" aria-label="Close">&times;</a>
        ${ids.length > 1 ? `
        <a href="#${prevId}" class="lightbox-nav lightbox-prev" aria-label="Previous photo">&#8249;</a>
        <a href="#${nextId}" class="lightbox-nav lightbox-next" aria-label="Next photo">&#8250;</a>
        ` : ''}
      </div>
    </div>`;
  }).join('');
  return grid + overlays;
}

function eventCard(ev, opts = {}) {
  const href = ev.status === 'past' ? `/events/past/${ev.slug}` : `/events/${ev.slug}`;
  return `
  <a href="${href}" class="event-card" style="display:block; position:relative;">
    ${ev.status !== 'past' && ev.selling_fast ? '<span class="badge-selling-fast">Selling fast</span>' : ''}
    ${cover(ev)}
    <h3>${escapeHtml(ev.title)}</h3>
    <div class="event-meta">${formatDateShort(ev.event_date)} · ${escapeHtml(ev.venue)}, ${escapeHtml(ev.city)}</div>
    ${ev.status !== 'past' && ev.price_from_cents != null ? `<div class="eyebrow">From ${formatMoney(ev.price_from_cents)}</div>` : ''}
  </a>`;
}

function repInitials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

module.exports = { cover, photoTile, photoGallery, eventCard, repInitials };
