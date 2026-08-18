'use strict';
const crypto = require('crypto');

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readBody(req, maxBytes = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function parseFormBody(req) {
  const contentType = req.headers['content-type'] || '';
  const raw = await readBody(req);

  if (contentType.includes('multipart/form-data')) {
    return parseMultipart(raw, contentType);
  }

  // default: application/x-www-form-urlencoded
  const params = new URLSearchParams(raw.toString('utf8'));
  const fields = {};
  for (const [key, value] of params.entries()) fields[key] = value;
  return { fields, files: {} };
}

function parseMultipart(buffer, contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = match ? (match[1] || match[2]) : null;
  const fields = {};
  const files = {};
  if (!boundary) return { fields, files };

  const boundaryBuf = Buffer.from(`--${boundary}`);
  const parts = splitBuffer(buffer, boundaryBuf);

  for (const part of parts) {
    if (part.length === 0) continue;
    // strip leading CRLF
    let body = part;
    if (body[0] === 0x0d && body[1] === 0x0a) body = body.slice(2);
    const headerEnd = body.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const rawHeaders = body.slice(0, headerEnd).toString('utf8');
    let content = body.slice(headerEnd + 4);
    // trailing CRLF before next boundary
    if (content.slice(-2).toString() === '\r\n') content = content.slice(0, -2);

    const dispositionMatch = rawHeaders.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
    if (!dispositionMatch) continue;
    const name = dispositionMatch[1];
    const filename = dispositionMatch[2];

    if (filename !== undefined) {
      if (!filename) continue; // empty file input
      const typeMatch = rawHeaders.match(/Content-Type:\s*([^\r\n]+)/i);
      files[name] = {
        filename,
        contentType: typeMatch ? typeMatch[1] : 'application/octet-stream',
        data: content,
      };
    } else {
      fields[name] = content.toString('utf8');
    }
  }
  return { fields, files };
}

function splitBuffer(buffer, delimiter) {
  const parts = [];
  let start = 0;
  let idx;
  while ((idx = buffer.indexOf(delimiter, start)) !== -1) {
    if (start !== 0) parts.push(buffer.slice(start, idx));
    start = idx + delimiter.length;
  }
  return parts;
}

function formatMoney(cents, currency = '£') {
  if (cents === null || cents === undefined) return `${currency}0`;
  const value = (cents / 100).toFixed(2);
  return `${currency}${value}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function randomCode(prefix = 'AMOR') {
  return `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

// Milestone badge label, purely a function of lifetime tickets sold — cheap
// enough to compute for every rep in a leaderboard listing (no extra
// per-rep queries needed). Shared between server.js (rep dashboard) and
// views/team.js (leaderboard + "meet the reps" grid).
function milestoneBadge(totalSold) {
  if (totalSold >= 25) return '25+ club';
  if (totalSold >= 10) return '10+ club';
  if (totalSold >= 1) return 'First sale';
  return null;
}

// Node's res.setHeader('Set-Cookie', ...) REPLACES any previously set
// Set-Cookie header rather than adding to it. We now set an anonymous
// visitor-id cookie on every request in addition to the session cookie
// (login/logout), so every place that sets a cookie needs to append to
// whatever's already queued on the response instead of clobbering it.
function addCookie(res, cookieStr) {
  const existing = res.getHeader('Set-Cookie');
  let next;
  if (!existing) next = [cookieStr];
  else if (Array.isArray(existing)) next = existing.concat(cookieStr);
  else next = [existing, cookieStr];
  res.setHeader('Set-Cookie', next);
}

// Minimal CSV writer — no library needed for what this project exports.
// Quotes any field containing a comma, quote, or newline, and doubles up
// internal quotes per RFC 4180.
function toCsv(rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((row) => row.map(esc).join(',')).join('\r\n') + '\r\n';
}

module.exports = {
  escapeHtml,
  readBody,
  parseFormBody,
  formatMoney,
  formatDate,
  formatDateShort,
  slugify,
  randomCode,
  addCookie,
  milestoneBadge,
  toCsv,
};
