'use strict';
const { layout, flash } = require('./layout');
const { escapeHtml } = require('../lib/util');

function loginPage({ user, query }) {
  const next = query && query.next ? escapeHtml(query.next) : '/account';
  const body = `
  <section style="padding-top:72px; padding-bottom:96px;">
    <div class="wrap form-card">
      <div class="eyebrow" style="text-align:center;">Welcome back</div>
      <h1 class="h2" style="text-align:center; margin-bottom:28px;">Sign in</h1>
      ${flash(query)}
      <form method="POST" action="/login">
        <input type="hidden" name="next" value="${next}">
        <div class="field"><label>Email</label><input type="email" name="email" required autofocus></div>
        <div class="field"><label>Password</label><input type="password" name="password" required></div>
        <button type="submit" class="btn btn-solid btn-block">Sign in</button>
      </form>
      <p class="muted" style="text-align:center; margin-top:20px; font-size:0.88rem;">
        New to AMOR? <a href="/signup?next=${next}" class="accent">Create an account</a>
      </p>
    </div>
  </section>`;
  return layout({ title: 'Sign In', user, active: '', body, query });
}

function signupPage({ user, query }) {
  const next = query && query.next ? escapeHtml(query.next) : '/account';
  const body = `
  <section style="padding-top:72px; padding-bottom:96px;">
    <div class="wrap form-card">
      <div class="eyebrow" style="text-align:center;">Join AMOR</div>
      <h1 class="h2" style="text-align:center; margin-bottom:28px;">Create your account</h1>
      ${flash(query)}
      <form method="POST" action="/signup">
        <input type="hidden" name="next" value="${next}">
        <div class="field"><label>Full name</label><input type="text" name="name" required autofocus></div>
        <div class="field"><label>Email</label><input type="email" name="email" required></div>
        <div class="field"><label>University (optional)</label><input type="text" name="university" placeholder="e.g. University of Bath"></div>
        <div class="field"><label>Password</label><input type="password" name="password" minlength="8" required></div>
        <button type="submit" class="btn btn-solid btn-block">Create account</button>
      </form>
      <p class="muted" style="text-align:center; margin-top:20px; font-size:0.88rem;">
        Already have an account? <a href="/login?next=${next}" class="accent">Sign in</a>
      </p>
    </div>
  </section>`;
  return layout({ title: 'Sign Up', user, active: '', body, query });
}

module.exports = { loginPage, signupPage };
