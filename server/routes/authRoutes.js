const router = require('express').Router();
const db = require('../db');
const { hashPassword, verifyPassword, createSession, destroySession } = require('../auth');
const { requireAuth } = require('../middleware');

router.post('/register', async (req, res) => {
  const { username = '', password = '' } = req.body;
  const fields = {};
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username))
    fields.username = '3–30 letters, numbers or underscores';
  if (typeof password !== 'string' || password.length < 8)
    fields.password = 'At least 8 characters';
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Validation failed', fields });

  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username))
    return res.status(409).json({ error: 'Username taken', fields: { username: 'Already taken' } });

  const { hash, salt } = await hashPassword(password);
  const { lastInsertRowid: id } = db.prepare(
    'INSERT INTO users (username, password_hash, salt) VALUES (?,?,?)').run(username, hash, salt);
  createSession(res, id);
  res.status(201).json({ id, username, role: 'user' });
});

router.post('/login', async (req, res) => {
  const { username = '', password = '' } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  // same message for wrong username and wrong password, so attackers can't find usernames
  if (!user || !(await verifyPassword(String(password), user.salt, user.password_hash)))
    return res.status(401).json({ error: 'Invalid username or password' });
  if (!user.is_active) return res.status(403).json({ error: 'This account has been disabled' });
  createSession(res, user.id);
  res.json({ id: user.id, username: user.username, role: user.role });
});

router.post('/logout', (req, res) => { destroySession(req, res); res.status(204).end(); });

router.get('/me', requireAuth, (req, res) => res.json(req.user));

module.exports = router;