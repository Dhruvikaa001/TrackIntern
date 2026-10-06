const db = require('./db');
const { parseCookies, COOKIE_NAME } = require('./auth');

function authenticate(req, res, next) {
  req.user = null;
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (token) {
    const row = db.prepare(`
      SELECT u.id, u.username, u.role, u.is_active
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?`).get(token, new Date().toISOString());
    if (row && row.is_active) req.user = { id: row.id, username: row.username, role: row.role };
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  next();
}

function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
}

module.exports = { authenticate, requireAuth, requireAdmin, errorHandler };