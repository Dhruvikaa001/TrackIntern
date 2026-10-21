const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../middleware');

router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(db.prepare(`SELECT id, name, industry, website, status FROM companies
    WHERE status = 'approved' OR created_by = ? ORDER BY name COLLATE NOCASE`).all(req.user.id));
});

router.post('/', (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const industry = String(req.body.industry ?? '').trim() || null;
  if (name.length < 2 || name.length > 80)
    return res.status(400).json({ error: 'Validation failed', fields: { name: '2–80 characters' } });
  if (db.prepare('SELECT 1 FROM companies WHERE name = ?').get(name))
    return res.status(409).json({ error: 'Company exists', fields: { name: 'This company already exists' } });
  const { lastInsertRowid: id } = db.prepare(
    `INSERT INTO companies (name, industry, status, created_by) VALUES (?,?,'pending',?)`
  ).run(name, industry, req.user.id);
  res.status(201).json({ id, name, industry, status: 'pending' });
});

module.exports = router;