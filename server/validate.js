const STAGES = ['wishlist', 'applied', 'oa', 'interview', 'offer', 'rejected'];
const PRIORITIES = ['low', 'medium', 'high'];

// partial = true for PATCH (only check fields that were sent)
function validateApplication(body, partial = false) {
  const fields = {}, data = {};
  const has = k => body[k] !== undefined;

  if (!partial || has('role_title')) {
    const v = String(body.role_title ?? '').trim();
    if (!v || v.length > 100) fields.role_title = 'Role title is required (max 100 characters)';
    else data.role_title = v;
  }
  if (!partial || has('company_id')) {
    const v = Number(body.company_id);
    if (!Number.isInteger(v) || v < 1) fields.company_id = 'Choose a company';
    else data.company_id = v;
  }
  if (!partial && has('stage')) {
    if (!STAGES.includes(body.stage)) fields.stage = 'Invalid stage';
    else data.stage = body.stage;
  }
  if (has('priority')) {
    if (!PRIORITIES.includes(body.priority)) fields.priority = 'Invalid priority';
    else data.priority = body.priority;
  }
  if (has('deadline')) {
    const v = body.deadline;
    if (v === '' || v === null) data.deadline = null;
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) fields.deadline = 'Enter a valid date';
    else data.deadline = v;
  }
  if (has('link')) {
    const v = String(body.link ?? '').trim();
    if (!v) data.link = null;
    else {
      try {
        const u = new URL(v);
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
        data.link = v;
      } catch { fields.link = 'Enter a valid link starting with http:// or https://'; }
    }
  }
  if (has('notes')) {
    const v = String(body.notes ?? '');
    if (v.length > 2000) fields.notes = 'Notes can be at most 2000 characters';
    else data.notes = v;
  }
  return { ok: Object.keys(fields).length === 0, fields, data };
}

module.exports = { STAGES, PRIORITIES, validateApplication };