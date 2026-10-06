const crypto = require('crypto');
const { promisify } = require('util');
const db = require('./db');

const scrypt = promisify(crypto.scrypt);
const SESSION_DAYS = 7;
const COOKIE_NAME = 'sid';

// Slow, salted hash: the same password gives different hashes for different users
async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const buf = await scrypt(password, salt, 64);
  return { hash: buf.toString('hex'), salt };
}

async function verifyPassword(password, salt, storedHash) {
  const { hash } = await hashPassword(password, salt);
  // constant-time compare prevents timing attacks
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)')
    .run(token, userId, expires.toISOString());
  // res.cookie is built into Express, no extra package needed
  res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'strict', expires, path: '/' });
}

function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// "sid=abc; theme=dark"  ->  { sid: 'abc', theme: 'dark' }
function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

module.exports = { hashPassword, verifyPassword, createSession, destroySession, parseCookies, COOKIE_NAME };