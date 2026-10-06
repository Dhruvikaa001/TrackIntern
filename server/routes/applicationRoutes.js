const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../middleware');
const { STAGES, PRIORITIES, validateApplication } = require('../validate');

router.use(requireAuth); // every route below needs a logged-in user

const SELECT_APP = `
  SELECT a.id, a.company_id, c.name AS company_name, a.role_title, a.stage, a.priority,
         a.deadline, a.link, a.notes, a.created_at, a.updated_at
  FROM applications a JOIN companies c ON c.id = a.company_id`;
const getOwned = (id, userId) =>
  db.prepare(`${SELECT_APP} WHERE a.id = ? AND a.user_id = ?`).get(id, userId);
const now = () => new Date().toISOString();
const notFound = res => res.status(404).json({ error: 'Application not found' });

// Company must be approved, or a pending one this user suggested
const companyUsable = (companyId, userId) => db.prepare(
  `SELECT 1 FROM companies WHERE id = ? AND (status = 'approved' OR created_by = ?)`
).get(companyId, userId);

// LIST with search / filter / sort
router.get('/', (req, res) => {
  const { q = '', stage, priority, sort = 'deadline' } = req.query;
  const where = ['a.user_id = ?'], params = [req.user.id];
  if (q.trim()) {
    where.push('(c.name LIKE ? OR a.role_title LIKE ?)');
    params.push(`%${q.trim()}%`, `%${q.trim()}%`);
  }
  if (STAGES.includes(stage)) { where.push('a.stage = ?'); params.push(stage); }
  if (PRIORITIES.includes(priority)) { where.push('a.priority = ?'); params.push(priority); }
  const ORDER = {                        // whitelist: sort never goes into SQL directly
    deadline: 'a.deadline IS NULL, a.deadline ASC',
    updated: 'a.updated_at DESC',
    company: 'c.name COLLATE NOCASE ASC',
  };
  const sql = `${SELECT_APP} WHERE ${where.join(' AND ')} ORDER BY ${ORDER[sort] || ORDER.deadline}`;
  res.json(db.prepare(sql).all(...params));
});

// STATS (must be defined BEFORE '/:id', or Express treats "stats" as an id)
router.get('/stats', (req, res) => {
  const rows = db.prepare(
    'SELECT stage, COUNT(*) AS n FROM applications WHERE user_id = ? GROUP BY stage').all(req.user.id);
  const counts = Object.fromEntries(STAGES.map(s => [s, 0]));
  for (const r of rows) counts[r.stage] = r.n;
  res.json({ counts, total: rows.reduce((sum, r) => sum + r.n, 0) });
});

// READ one + its history
router.get('/:id', (req, res) => {
  const app = getOwned(req.params.id, req.user.id);
  if (!app) return notFound(res);
  app.history = db.prepare(
    'SELECT from_stage, to_stage, changed_at FROM stage_history WHERE application_id = ? ORDER BY changed_at'
  ).all(app.id);
  res.json(app);
});

// CREATE
router.post('/', (req, res) => {
  const { ok, fields, data } = validateApplication(req.body);
  if (!ok) return res.status(400).json({ error: 'Validation failed', fields });
  if (!companyUsable(data.company_id, req.user.id))
    return res.status(400).json({ error: 'Validation failed', fields: { company_id: 'Choose a valid company' } });

  const stage = data.stage || 'wishlist', t = now();
  const id = db.transaction(() => {
    const { lastInsertRowid } = db.prepare(`INSERT INTO applications
      (user_id, company_id, role_title, stage, priority, deadline, link, notes, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(req.user.id, data.company_id, data.role_title, stage,
      data.priority || 'medium', data.deadline ?? null, data.link ?? null, data.notes ?? '', t, t);
    db.prepare('INSERT INTO stage_history (application_id, from_stage, to_stage, changed_at) VALUES (?,?,?,?)')
      .run(lastInsertRowid, null, stage, t);
    return lastInsertRowid;
  })();
  res.status(201).json(getOwned(id, req.user.id));
});

// UPDATE fields (not stage)
router.patch('/:id', (req, res) => {
  if (!getOwned(req.params.id, req.user.id)) return notFound(res);
  const { ok, fields, data } = validateApplication(req.body, true);
  if (!ok) return res.status(400).json({ error: 'Validation failed', fields });
  if (data.company_id && !companyUsable(data.company_id, req.user.id))
    return res.status(400).json({ error: 'Validation failed', fields: { company_id: 'Choose a valid company' } });

  const keys = Object.keys(data);          // only validated, whitelisted keys
  if (keys.length) {
    const set = keys.map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE applications SET ${set}, updated_at = ? WHERE id = ? AND user_id = ?`)
      .run(...keys.map(k => data[k]), now(), req.params.id, req.user.id);
  }
  res.json(getOwned(req.params.id, req.user.id));
});

// MOVE stage: update + history in ONE transaction
router.patch('/:id/stage', (req, res) => {
  const { stage } = req.body;
  if (!STAGES.includes(stage))
    return res.status(400).json({ error: 'Validation failed', fields: { stage: 'Invalid stage' } });
  const app = getOwned(req.params.id, req.user.id);
  if (!app) return notFound(res);
  if (app.stage !== stage) {
    const t = now();
    db.transaction(() => {
      db.prepare('UPDATE applications SET stage = ?, updated_at = ? WHERE id = ?').run(stage, t, app.id);
      db.prepare('INSERT INTO stage_history (application_id, from_stage, to_stage, changed_at) VALUES (?,?,?,?)')
        .run(app.id, app.stage, stage, t);
    })();
  }
  res.json(getOwned(app.id, req.user.id));
});

// DELETE (history is removed by ON DELETE CASCADE)
router.delete('/:id', (req, res) => {
  const { changes } = db.prepare('DELETE FROM applications WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (!changes) return notFound(res);
  res.status(204).end();
});

module.exports = router;