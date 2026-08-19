'use strict';
// Talks to Stripe's REST API directly over fetch() (built into Node 18+) —
// no Stripe SDK / npm install required. Needs STRIPE_SECRET_KEY set in the
// environment; STRIPE_WEBHOOK_SECRET for verifying webhook signatures.
const crypto = require('crypto');

const STRIPE_API = 'https://api.stripe.com/v1';

function isConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function apiKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return key;
}

function flattenParams(obj, body, prefix) {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const paramKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        const arrKey = `${paramKey}[${i}]`;
        if (v && typeof v === 'object') flattenParams(v, body, arrKey);
        else body.append(arrKey, v);
      });
    } else if (typeof value === 'object') {
      flattenParams(value, body, paramKey);
    } else {
      body.append(paramKey, value);
    }
  }
}

async function stripeRequest(method, path, params) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${apiKey()}` },
  };
  if (params) {
    const body = new URLSearchParams();
    flattenParams(params, body);
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = body.toString();
  }
  const res = await fetch(`${STRIPE_API}${path}`, opts);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error((data.error && data.error.message) || 'Stripe request failed');
    err.stripe = data;
    throw err;
  }
  return data;
}

async function createCheckoutSession({ priceCents, currency = 'gbp', productName, successUrl, cancelUrl, customerEmail, metadata }) {
  return stripeRequest('POST', '/checkout/sessions', {
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: priceCents,
          product_data: { name: productName },
        },
      },
    ],
    metadata,
  });
}

async function retrieveSession(id) {
  return stripeRequest('GET', `/checkout/sessions/${id}`);
}

// Verifies Stripe's webhook signature (HMAC SHA-256 over "timestamp.rawBody")
// without needing the Stripe SDK.
function verifyWebhookSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = Object.fromEntries(
    sigHeader.split(',').map((p) => {
      const idx = p.indexOf('=');
      return [p.slice(0, idx), p.slice(idx + 1)];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = { isConfigured, createCheckoutSession, retrieveSession, verifyWebhookSignature };
