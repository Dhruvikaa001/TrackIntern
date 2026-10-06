const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../middleware');

router.use(requireAuth);
const MIN_SAMPLE = 5; // privacy: hide stats built from fewer than 5 applications

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

// Community timeline: aggregates across ALL users, never individual rows
router.get('/:id/timeline', (req, res) => {
  const id = Number(req.params.id);
  const applied = db.prepare(`SELECT COUNT(DISTINCT a.id) AS n FROM applications a
    JOIN stage_history h ON h.application_id = a.id AND h.to_stage = 'applied'
    WHERE a.company_id = ?`).get(id).n;
  const days = db.prepare(`SELECT julianday(o.changed_at) - julianday(ap.changed_at) AS d
    FROM applications a
    JOIN stage_history ap ON ap.application_id = a.id AND ap.to_stage = 'applied'
    JOIN stage_history o  ON o.application_id  = a.id AND o.to_stage  = 'oa'
    WHERE a.company_id = ?`).all(id).map(r => r.d).sort((x, y) => x - y);
  const interviewed = db.prepare(`SELECT COUNT(DISTINCT a.id) AS n FROM applications a
    JOIN stage_history h ON h.application_id = a.id AND h.to_stage = 'interview'
    WHERE a.company_id = ?`).get(id).n;

  const median = days.length ? days[Math.floor(days.length / 2)] : null;
  res.json({
    applications: applied,
    median_days_to_oa: days.length >= MIN_SAMPLE ? Math.round(median) : null,
    interview_rate: applied >= MIN_SAMPLE ? +(interviewed / applied).toFixed(2) : null,
  });
});

module.exports = router;