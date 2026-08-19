'use strict';
const { layout } = require('./layout');
const { CONTACT_EMAIL } = require('../lib/contact');

function faqItem(q, a) {
  return `
  <div class="card faq-item">
    <h3 class="h3" style="margin-bottom:8px; font-size:1rem;">${q}</h3>
    <p class="muted" style="font-size:0.9rem; line-height:1.7;">${a}</p>
  </div>`;
}

function faqPage({ user, query }) {
  const body = `
  <section style="padding-top:56px;">
    <div class="wrap">
      <div class="eyebrow">Help</div>
      <h1 class="h2">Frequently asked questions</h1>
      <p class="lede">The short version of everything you'd want to know before buying a ticket.</p>
    </div>
  </section>

  <section style="padding-top:0;">
    <div class="wrap">
      <div class="faq-grid">
        ${faqItem(
          'What ID do I need to get in?',
          'Valid photo ID showing your date of birth — a passport, driving licence, or student ID. No ID, no entry, no exceptions from the door team.'
        )}
        ${faqItem(
          'Can I get a refund or exchange my ticket?',
          `All ticket sales are final. Due to the nature of event planning and venue capacity limits, we're unable to offer refunds or exchanges once a ticket has been purchased, except in the following cases: the event is cancelled or postponed by AMOR (you'll be offered a full refund or the option to transfer to the rescheduled date), or a ticket was purchased in error due to a verified technical fault on our platform (e.g. a duplicate charge). Can't make it? You're welcome to transfer your ticket to someone else — email <a href="mailto:${CONTACT_EMAIL}" class="accent">${CONTACT_EMAIL}</a> with the ticket holder's name and the new attendee's details at least 24 hours before the event. For any other issues with your order, <a href="/contact" class="accent">get in touch</a> and we'll get back to you as soon as possible.`
        )}
        ${faqItem(
          'What happens if an event is cancelled or postponed?',
          `If AMOR cancels or postpones an event, you'll be offered a full refund or the option to transfer your ticket to the rescheduled date. We'll email or message everyone who's claimed a ticket as soon as we know. If you bought through a rep link, they'll usually be able to help too.`
        )}
        ${faqItem(
          'How does the rep tracking-link and points system work?',
          'Buy your ticket on Fatsoma as normal — if a rep sent you the link, their code is already attached. Then claim it on this site (Events → your event → "Already bought a ticket?") with your order reference and their code if it wasn\'t prefilled. That banks you points on your AMOR account, which build toward membership perks, and it makes sure your rep gets credit on the leaderboard.'
        )}
        ${faqItem(
          'Do I need to be a member to buy tickets?',
          'No — anyone can buy and claim a ticket. Membership (see the <a href="/membership" class="accent">Membership page</a>) is optional and adds extra perks like bonus points and priority entry.'
        )}
        ${faqItem(
          'What\'s the dress code?',
          'Smart casual, unless an event page says otherwise for a themed night. The door team\'s call is final.'
        )}
      </div>
    </div>
  </section>`;
  return layout({
    title: 'FAQ',
    user, active: 'faq', body, query,
    og: { title: 'FAQ — AMOR', description: 'Refunds, ID requirements, cancellations, and how the rep/points system works.' },
  });
}

module.exports = { faqPage };
