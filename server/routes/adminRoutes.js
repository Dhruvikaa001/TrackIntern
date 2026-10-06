const router = require('express').Router();
const db = require('../db');
const { requireAdmin } = require('../middleware');

router.use(requireAdmin); // 401 if logged out, 403 if not admin

router.get('/companies', (req, res) => {
  const status = ['pending', 'approved'].includes(req.query.status) ? req.query.status : null;
  res.json(db.prepare(`SELECT c.*, u.username AS created_by_username,
      (SELECT COUNT(*) FROM applications a WHERE a.company_id = c.id) AS app_count
    FROM companies c LEFT JOIN users u ON u.id = c.created_by
    ${status ? 'WHERE c.status = ?' : ''} ORDER BY c.name COLLATE NOCASE`).all(...(status ? [status] : [])));
});

router.patch('/companies/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Company not found' });
  const name = req.body.name !== undefined ? String(req.body.name).trim() : c.name;
  const industry = req.body.industry !== undefined ? String(req.body.industry).trim() : c.industry;
  const status = ['pending', 'approved'].includes(req.body.status) ? req.body.status : c.status;
  if (name.length < 2) return res.status(400).json({ error: 'Validation failed', fields: { name: '2–80 characters' } });
  try {
    db.prepare('UPDATE companies SET name = ?, industry = ?, status = ? WHERE id = ?')
      .run(name, industry, status, c.id);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE')
      return res.status(409).json({ error: 'Name exists', fields: { name: 'Another company has this name' } });
    throw e;
  }
  res.json(db.prepare('SELECT * FROM companies WHERE id = ?').get(c.id));
});

// Merge a duplicate into the real company, then delete the duplicate
router.post('/companies/:id/merge', (req, res) => {
  const from = Number(req.params.id), into = Number(req.body.into_id);
  if (from === into || !db.prepare('SELECT 1 FROM companies WHERE id = ?').get(into))
    return res.status(400).json({ error: 'Choose a different, existing company to merge into' });
  db.transaction(() => {
    db.prepare('UPDATE applications SET company_id = ? WHERE company_id = ?').run(into, from);
    db.prepare('DELETE FROM companies WHERE id = ?').run(from);
  })();
  res.status(204).end();
});

router.delete('/companies/:id', (req, res) => {
  try {
    const { changes } = db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
    if (!changes) return res.status(404).json({ error: 'Company not found' });
    res.status(204).end();
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_FOREIGNKEY')
      return res.status(409).json({ error: 'Applications still use this company. Merge it instead.' });
    throw e;
  }
});

router.get('/users', (req, res) => {
  res.json(db.prepare(`SELECT u.id, u.username, u.role, u.is_active, u.created_at,
      (SELECT COUNT(*) FROM applications a WHERE a.user_id = u.id) AS app_count
    FROM users u ORDER BY u.username`).all());
});

router.patch('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot disable your own account' });
  if (typeof req.body.is_active !== 'boolean')
    return res.status(400).json({ error: 'is_active must be true or false' });
  const { changes } = db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(req.body.is_active ? 1 : 0, id);
  if (!changes) return res.status(404).json({ error: 'User not found' });
  if (!req.body.is_active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id); // log them out
  res.json(db.prepare('SELECT id, username, role, is_active FROM users WHERE id = ?').get(id));
});

module.exports = router;