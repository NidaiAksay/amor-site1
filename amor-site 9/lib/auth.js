'use strict';
const crypto = require('crypto');
const db = require('./db');
const { addCookie } = require('./util');

const SESSION_COOKIE = 'amor_session';
const SESSION_DAYS = 30;

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function createUser({ email, password, name, university, role }) {
  const { hash, salt } = hashPassword(password);
  const stmt = db.prepare(`INSERT INTO users (email, password_hash, password_salt, name, role, university, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const info = stmt.run(
    email.trim().toLowerCase(),
    hash,
    salt,
    name.trim(),
    role || 'member',
    university || null,
    new Date().toISOString()
  );
  return getUserById(Number(info.lastInsertRowid));
}

function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  return { token, expires };
}

function destroySession(token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function getSessionUser(token) {
  if (!token) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return getUserById(session.user_id);
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = decodeURIComponent(pair.slice(idx + 1).trim());
    out[key] = val;
  });
  return out;
}

function setSessionCookie(res, token) {
  addCookie(res, `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`);
}

function clearSessionCookie(res) {
  addCookie(res, `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function currentUser(req) {
  const cookies = parseCookies(req);
  return getSessionUser(cookies[SESSION_COOKIE]);
}

module.exports = {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  createUser,
  getUserByEmail,
  getUserById,
  createSession,
  destroySession,
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
  currentUser,
};
