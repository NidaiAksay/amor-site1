'use strict';
const { layout } = require('./layout');
const { CONTACT_EMAIL } = require('../lib/contact');

// Plain-English description of what this site actually collects and why —
// grounded in the real schema/routes, not boilerplate. This is a starting
// point, not a substitute for a solicitor's review before you rely on it
// for UK GDPR compliance (see the closing note on the page itself).
function privacyPage({ user, query }) {
  const body = `
  <section style="padding-top:56px;">
    <div class="wrap" style="max-width:760px;">
      <div class="eyebrow">Legal</div>
      <h1 class="h2">Privacy policy</h1>
      <p class="lede">What AMOR collects through this site, and why.</p>

      <div style="margin-top:36px; display:flex; flex-direction:column; gap:28px;">
        <div>
          <h3 class="h3" style="margin-bottom:8px;">What we collect</h3>
          <ul class="fine" style="line-height:1.9; padding-left:18px;">
            <li><b>Account details</b> — name, email, and university (optional) when you sign up, so you can claim tickets and track points/credits.</li>
            <li><b>Ticket claims</b> — the Fatsoma order reference and quantity you submit when claiming a ticket you bought, plus which rep's code (if any) was attached.</li>
            <li><b>Membership</b> — which plan you're on and its status. Card payments are handled entirely by Stripe — we never see or store your card details.</li>
            <li><b>Rep applications</b> — name, email, university, and Instagram handle if you apply to join the team.</li>
            <li><b>Contact messages</b> — whatever you send through the <a href="/contact" class="accent">Contact</a> page (name and email are optional there).</li>
            <li><b>Song suggestions</b> — the track and your name/handle if you leave one, from the Music page.</li>
            <li><b>Basic visit analytics</b> — a random, non-identifying cookie so we can see page views and traffic trends. It's first-party only: nothing is sent to Google, Meta, or any other third-party ad or tracking network.</li>
          </ul>
        </div>

        <div>
          <h3 class="h3" style="margin-bottom:8px;">Who sees it</h3>
          <p class="muted" style="line-height:1.8; font-size:0.92rem;">Only AMOR — this data sits in our own database and isn't sold or shared with third parties, aside from the services that have to touch it to do their job: Fatsoma (ticket sales) and Stripe (membership card payments), each under their own privacy policy.</p>
        </div>

        <div>
          <h3 class="h3" style="margin-bottom:8px;">Your options</h3>
          <p class="muted" style="line-height:1.8; font-size:0.92rem;">Want to see, correct, or delete what we hold on you? Email <a href="mailto:${CONTACT_EMAIL}" class="accent">${CONTACT_EMAIL}</a> or use the <a href="/contact" class="accent">Contact page</a> and we'll sort it out.</p>
        </div>
      </div>

      <p class="muted" style="font-size:0.8rem; margin-top:48px; padding-top:20px; border-top:1px solid var(--line);">This page describes what the site actually does in plain English — it's a starting point, not legal advice, and hasn't been reviewed by a solicitor. Worth having someone qualified check it against UK GDPR before you rely on it.</p>
    </div>
  </section>`;
  return layout({
    title: 'Privacy',
    user, active: 'privacy', body, query,
    og: { title: 'Privacy policy — AMOR', description: 'What AMOR collects through this site, and why.' },
  });
}

module.exports = { privacyPage };
