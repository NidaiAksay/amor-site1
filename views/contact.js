'use strict';
const { layout, flash } = require('./layout');
const { escapeHtml } = require('../lib/util');
const { CONTACT_EMAIL } = require('../lib/contact');

// Styled as a chat widget, but there's no live chat / no bot behind it —
// it's a plain form that saves to the contact_messages table (see lib/db.js
// note) and redirects back here with a flash confirmation. No SMTP is
// wired up, so the mailto: link underneath is the one guaranteed-instant
// way to reach the inbox directly; the form is what saves a copy either way.
function contactPage({ user, query }) {
  const body = `
  <section style="padding-top:56px;">
    <div class="wrap">
      <div class="eyebrow">Get in touch</div>
      <h1 class="h2">Contact us</h1>
      <p class="lede">Questions about an order, a rep application, or anything else — send us a message and we'll reply by email.</p>
    </div>
  </section>

  <section style="padding-top:0;">
    <div class="wrap" style="max-width:560px;">
      <div class="chat-box">
        <div class="chat-box-header">
          <div class="chat-box-avatar" aria-hidden="true">A</div>
          <div>
            <div class="chat-box-title">AMOR</div>
            <div class="chat-box-subtitle">Usually replies within a day or two</div>
          </div>
        </div>
        <div class="chat-box-thread">
          <div class="chat-bubble chat-bubble-them">Hey! Drop your message below and we'll get back to you by email — for order or ticket issues, include your order reference if you have it.</div>
        </div>
        ${flash(query)}
        <form method="POST" action="/contact" class="chat-box-form">
          <div class="field"><label>Your name</label><input type="text" name="name" placeholder="Optional" value="${escapeHtml((query && query.name) || '')}"></div>
          <div class="field"><label>Your email</label><input type="email" name="email" placeholder="So we can reply — recommended" value="${escapeHtml((query && query.email) || '')}"></div>
          <div class="field"><label>Message</label><textarea name="message" rows="4" placeholder="What's up?" required></textarea></div>
          <button type="submit" class="btn btn-solid btn-block">Send message</button>
        </form>
      </div>
      <p class="muted" style="font-size:0.85rem; margin-top:18px; text-align:center;">Prefer email directly? Reach us at <a href="mailto:${escapeHtml(CONTACT_EMAIL)}" class="accent">${escapeHtml(CONTACT_EMAIL)}</a>.</p>
    </div>
  </section>`;
  return layout({
    title: 'Contact',
    user, active: 'contact', body, query,
    og: { title: 'Contact AMOR', description: "Questions about an order, a rep application, or anything else — send us a message." },
  });
}

module.exports = { contactPage };
