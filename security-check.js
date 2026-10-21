// TrackIntern security check. Run with the server running:  node security-check.js
// It creates temporary "sectest_" users/companies, checks the rules, then deletes them.
const BASE = process.env.BASE || 'http://localhost:3000';
const db = require('./server/db');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  <-- ' + extra}`);
};

// tiny client that keeps its own cookie
function client() {
  let cookie = '';
  const call = async (method, path, body, raw) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, setCookie: sc };
  };
  return { call, get cookie() { return cookie; }, set cookie(v) { cookie = v; } };
}

(async () => {
  const tag = 'sectest_' + Date.now().toString(36);
  const A = client(), B = client(), admin = client(), anon = client();
  const pw = 'password123';

  try {
    console.log('\n-- Authentication --');
    let r = await A.call('POST', '/api/auth/register', { username: tag + '_a', password: pw });
    ok('register works (201)', r.status === 201, r.status);
    ok('register sets a session cookie', /sid=/.test(r.setCookie || ''));
    ok('cookie is HttpOnly', /httponly/i.test(r.setCookie || ''));
    ok('cookie is SameSite=Strict', /samesite=strict/i.test(r.setCookie || ''));
    ok('response never contains the password or hash', !/password|hash|salt/i.test(r.text));
    r = await anon.call('POST', '/api/auth/register', { username: (tag + '_A').toUpperCase(), password: pw });
    ok('duplicate username (different case) -> 409', r.status === 409, r.status);
    r = await anon.call('POST', '/api/auth/register', { username: 'a b', password: pw });
    ok('bad username -> 400', r.status === 400, r.status);
    r = await anon.call('POST', '/api/auth/register', { username: tag + '_x', password: 'short' });
    ok('password under 8 characters -> 400', r.status === 400, r.status);

    await B.call('POST', '/api/auth/register', { username: tag + '_b', password: pw });

    const bad1 = await anon.call('POST', '/api/auth/login', { username: tag + '_a', password: 'wrongpass1' });
    const bad2 = await anon.call('POST', '/api/auth/login', { username: 'nobody_' + tag, password: 'wrongpass1' });
    ok('wrong password -> 401', bad1.status === 401, bad1.status);
    ok('unknown user gives the same status and message', bad2.status === 401 && bad1.json?.error === bad2.json?.error, JSON.stringify([bad1.json, bad2.json]));
    r = await anon.call('POST', '/api/auth/login');
    ok('login with no body -> 401, not a crash', r.status === 401, r.status);
    r = await anon.call('POST', '/api/auth/login', undefined, '{bad json');
    ok('malformed JSON -> 400', r.status === 400, r.status);
    r = await anon.call('POST', '/api/auth/login', undefined, JSON.stringify({ username: 'x'.repeat(200000), password: 'y' }));
    ok('oversized body -> 413', r.status === 413, r.status);

    console.log('\n-- Password storage --');
    const row = db.prepare('SELECT password_hash, salt FROM users WHERE username = ?').get(tag + '_a');
    const row2 = db.prepare('SELECT password_hash, salt FROM users WHERE username = ?').get(tag + '_b');
    ok('stored value is not the plain password', row.password_hash !== pw && !row.password_hash.includes(pw));
    ok('each user has a different salt', row.salt && row.salt !== row2.salt);
    ok('same password gives different hashes (salted)', row.password_hash !== row2.password_hash);

    console.log('\n-- Logged-out access --');
    for (const [m, p] of [['GET', '/api/applications'], ['POST', '/api/applications'], ['GET', '/api/applications/1'],
      ['PATCH', '/api/applications/1/stage'], ['DELETE', '/api/applications/1'], ['GET', '/api/companies'],
      ['GET', '/api/admin/users'], ['GET', '/api/admin/companies'], ['GET', '/api/auth/me']]) {
      r = await anon.call(m, p, m === 'GET' || m === 'DELETE' ? undefined : {});
      ok(`${m} ${p} -> 401`, r.status === 401, r.status);
    }
    r = await anon.call('GET', '/api/does-not-exist');
    ok('unknown /api route -> JSON 404', r.status === 404 && r.json?.error, r.status);

    console.log('\n-- Roles --');
    for (const [m, p, b] of [['GET', '/api/admin/users'], ['GET', '/api/admin/companies'],
      ['PATCH', '/api/admin/companies/1', { status: 'approved' }], ['DELETE', '/api/admin/companies/1'],
      ['PATCH', '/api/admin/users/1', { is_active: false }]]) {
      r = await A.call(m, p, b);
      ok(`normal user ${m} ${p} -> 403`, r.status === 403, r.status);
    }
    r = await admin.call('POST', '/api/auth/login', { username: 'admin', password: 'admin1234' });
    ok('admin can log in (seed data present)', r.status === 200 && r.json?.role === 'admin', r.status + ' (run npm run seed first)');
    r = await admin.call('GET', '/api/admin/users');
    ok('admin GET /api/admin/users -> 200', r.status === 200, r.status);
    ok('admin user list shows counts only, no application content',
      Array.isArray(r.json) && r.json.every(u => 'app_count' in u && !('role_title' in u) && !('notes' in u) && !('password_hash' in u)));

    console.log('\n-- Companies: pending -> approved --');
    const coName = 'SecTest Co ' + tag;
    r = await A.call('POST', '/api/companies', { name: coName, industry: 'Test' });
    ok('user can suggest a company (201)', r.status === 201, r.status);
    const co = r.json;
    ok('new company starts as pending', co?.status === 'pending', JSON.stringify(co));
    r = await A.call('POST', '/api/companies', { name: coName.toUpperCase() });
    ok('duplicate company name -> 409', r.status === 409, r.status);
    r = await A.call('POST', '/api/companies', { name: 'x' });
    ok('company name too short -> 400', r.status === 400, r.status);
    r = await A.call('GET', '/api/companies');
    ok('suggester sees own pending company', r.json?.some(c => c.id === co.id));
    r = await B.call('GET', '/api/companies');
    ok('other users do NOT see it while pending', !r.json?.some(c => c.id === co.id));
    r = await B.call('POST', '/api/applications', { company_id: co.id, role_title: 'Sneaky' });
    ok('other user cannot apply to someone else\'s pending company -> 400', r.status === 400, r.status);

    console.log('\n-- Applications: validation --');
    const good = { company_id: co.id, role_title: 'Test Intern', priority: 'high', deadline: '2030-01-31', link: 'https://example.com/x' };
    r = await A.call('POST', '/api/applications', good);
    ok('create application (201)', r.status === 201, r.status + ' ' + r.text);
    ok('stage defaults to wishlist', r.json?.stage === 'wishlist', r.json?.stage);
    const app = r.json;
    r = await A.call('GET', '/api/applications/' + app.id);
    ok('history has the first entry', r.json?.history?.length === 1 && r.json.history[0].from_stage === null, JSON.stringify(r.json?.history));
    r = await A.call('POST', '/api/applications', { ...good, role_title: '   ' });
    ok('empty title -> 400 with field message', r.status === 400 && r.json?.fields?.role_title, r.text);
    r = await A.call('POST', '/api/applications', { ...good, stage: 'hired' });
    ok('invalid stage on create -> 400', r.status === 400, r.status);
    r = await A.call('POST', '/api/applications', { ...good, priority: 'urgent' });
    ok('invalid priority -> 400', r.status === 400, r.status);
    r = await A.call('POST', '/api/applications', { ...good, link: 'javascript:alert(1)' });
    ok('javascript: link rejected -> 400', r.status === 400, r.status);
    r = await A.call('POST', '/api/applications', { ...good, link: 'not a url' });
    ok('bad link -> 400', r.status === 400, r.status);
    r = await A.call('POST', '/api/applications', { ...good, deadline: '31/01/2030' });
    ok('bad date format -> 400', r.status === 400, r.status);
    r = await A.call('POST', '/api/applications', { ...good, company_id: 999999 });
    ok('company that does not exist -> 400', r.status === 400, r.status);
    r = await A.call('POST', '/api/applications', { ...good, notes: 'x'.repeat(2001) });
    ok('notes over 2000 chars -> 400', r.status === 400, r.status);
    r = await A.call('PATCH', '/api/applications/' + app.id + '/stage', { stage: 'hired' });
    ok('invalid stage on move -> 400', r.status === 400, r.status);
    r = await A.call('PATCH', '/api/applications/' + app.id, { role_title: '' });
    ok('PATCH with empty title -> 400', r.status === 400, r.status);
    r = await A.call('PATCH', '/api/applications/' + app.id, { user_id: 1, id: 999 });
    r = await A.call('GET', '/api/applications/' + app.id);
    ok('PATCH cannot change user_id/id (mass assignment)', r.status === 200 && r.json.id === app.id);

    console.log('\n-- Stage move + history (transaction) --');
    r = await A.call('PATCH', `/api/applications/${app.id}/stage`, { stage: 'interview' });
    ok('move to interview -> 200', r.status === 200 && r.json.stage === 'interview', r.status);
    r = await A.call('GET', '/api/applications/' + app.id);
    const h = r.json.history;
    ok('history now has 2 rows, last wishlist -> interview', h.length === 2 && h[1].from_stage === 'wishlist' && h[1].to_stage === 'interview', JSON.stringify(h));
    await A.call('PATCH', `/api/applications/${app.id}/stage`, { stage: 'interview' });
    r = await A.call('GET', '/api/applications/' + app.id);
    ok('moving to the same stage adds no history row', r.json.history.length === 2);

    console.log('\n-- Ownership (other user\'s data) --');
    for (const [m, p, b] of [['GET', '/api/applications/' + app.id], ['PATCH', '/api/applications/' + app.id, { role_title: 'Hacked' }],
      ['PATCH', `/api/applications/${app.id}/stage`, { stage: 'offer' }], ['DELETE', '/api/applications/' + app.id]]) {
      r = await B.call(m, p, b);
      ok(`user B ${m} user A's application -> 404`, r.status === 404, r.status);
    }
    r = await B.call('GET', '/api/applications');
    ok('user B list does not contain A\'s application', Array.isArray(r.json) && !r.json.some(x => x.id === app.id));
    r = await A.call('GET', '/api/applications/' + app.id);
    ok('A\'s application is unchanged after B\'s attempts', r.json?.role_title === 'Test Intern' && r.json.stage === 'interview');

    console.log('\n-- Injection --');
    const before = db.prepare('SELECT COUNT(*) n FROM applications').get().n;
    for (const q of ["' OR '1'='1", "'; DROP TABLE applications; --", '%', '" OR 1=1 --']) {
      r = await A.call('GET', '/api/applications?q=' + encodeURIComponent(q));
      ok(`search "${q}" is handled safely (200 + array)`, r.status === 200 && Array.isArray(r.json), r.status);
    }
    r = await A.call('GET', '/api/applications?q=' + encodeURIComponent("' OR '1'='1"));
    ok('SQL-injection search returns nothing extra', r.json.length === 0, r.json.length);
    r = await A.call('GET', '/api/applications?sort=' + encodeURIComponent('a.id; DROP TABLE users'));
    ok('malicious sort value is ignored (200)', r.status === 200, r.status);
    r = await A.call('GET', '/api/applications?stage=' + encodeURIComponent("applied' OR '1'='1"));
    ok('malicious stage filter is ignored (200)', r.status === 200, r.status);
    r = await A.call('POST', '/api/applications', { ...good, role_title: "Robert'); DROP TABLE applications;--" });
    ok('quote in a title is stored as plain text', r.status === 201 && r.json.role_title.startsWith("Robert');"), r.status);
    const after = db.prepare('SELECT COUNT(*) n FROM applications').get().n;
    ok('tables still intact', after >= before);
    r = await A.call('POST', '/api/applications', { ...good, role_title: '<img src=x onerror=alert(1)>' });
    ok('HTML in a title is stored as text (client must use textContent)', r.status === 201 && r.json.role_title === '<img src=x onerror=alert(1)>');

    console.log('\n-- Admin actions --');
    r = await admin.call('PATCH', '/api/admin/companies/' + co.id, { name: 'x' });
    ok('admin rename to 1 character -> 400', r.status === 400, r.status);
    r = await admin.call('DELETE', '/api/admin/companies/' + co.id);
    ok('deleting a company still used by applications -> 409', r.status === 409, r.status);
    r = await admin.call('PATCH', '/api/admin/companies/' + co.id, { status: 'approved' });
    ok('admin approves company', r.status === 200 && r.json.status === 'approved', r.status);
    r = await B.call('GET', '/api/companies');
    ok('after approval other users see it', r.json?.some(c => c.id === co.id));
    const me = (await admin.call('GET', '/api/auth/me')).json;
    r = await admin.call('PATCH', '/api/admin/users/' + me.id, { is_active: false });
    ok('admin cannot disable own account -> 400', r.status === 400, r.status);
    r = await admin.call('PATCH', '/api/admin/users/' + me.id, { is_active: 'no' });
    ok('non-boolean is_active -> 400', r.status === 400, r.status);

    console.log('\n-- Disable user / logout --');
    const uB = db.prepare('SELECT id FROM users WHERE username = ?').get(tag + '_b');
    r = await B.call('GET', '/api/auth/me');
    ok('B is logged in before being disabled', r.status === 200);
    r = await admin.call('PATCH', '/api/admin/users/' + uB.id, { is_active: false });
    ok('admin disables B', r.status === 200 && r.json.is_active === 0, r.status);
    r = await B.call('GET', '/api/auth/me');
    ok('B\'s existing session stops working (401)', r.status === 401, r.status);
    r = await anon.call('POST', '/api/auth/login', { username: tag + '_b', password: pw });
    ok('disabled user cannot log in (403)', r.status === 403, r.status);
    await admin.call('PATCH', '/api/admin/users/' + uB.id, { is_active: true });
    r = await anon.call('POST', '/api/auth/login', { username: tag + '_b', password: pw });
    ok('re-enabled user can log in again', r.status === 200, r.status);

    const stolen = A.cookie;
    r = await A.call('POST', '/api/auth/logout');
    ok('logout -> 204', r.status === 204, r.status);
    const replay = client(); replay.cookie = stolen;
    r = await replay.call('GET', '/api/auth/me');
    ok('old session cookie no longer works after logout', r.status === 401, r.status);
    const forged = client(); forged.cookie = 'sid=' + 'a'.repeat(64);
    r = await forged.call('GET', '/api/auth/me');
    ok('forged cookie rejected', r.status === 401, r.status);

    console.log('\n-- Server hygiene --');
    r = await anon.call('GET', '/api/applications/1/../../etc/passwd');
    ok('path traversal does not leak files', !/root:/.test(r.text));
    r = await anon.call('GET', '/');
    ok('front page is served', r.status === 200 && /<html/i.test(r.text), r.status);
    ok('no stack trace in error responses', !/at .*\.js:\d+/.test(bad1.text + bad2.text));
  } catch (e) {
    fail++; console.log('FAIL  script crashed:', e.message, '\n(Is the server running on ' + BASE + '?)');
  } finally {
    // clean up everything this run created
    db.prepare("DELETE FROM users WHERE username LIKE 'sectest\\_%' ESCAPE '\\'").run();
    db.prepare("DELETE FROM companies WHERE name LIKE 'SecTest Co %'").run();
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log(fail ? 'Fix the FAIL lines above, then run again.' : 'All checks passed. Test data cleaned up.');
    process.exit(fail ? 1 : 0);
  }
})();
