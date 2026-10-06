const db = require('./db');
const { hashPassword } = require('./auth');

const STAGES = ['wishlist', 'applied', 'oa', 'interview', 'offer'];
const COMPANIES = [['Grab','Tech'],['Shopee','E-commerce'],['DBS','Banking'],['GovTech','Public sector'],
  ['Sea','Tech'],['OCBC','Banking'],['ByteDance','Tech'],['Singtel','Telecom'],['Micron','Semiconductors'],
  ['EY','Consulting'],['Capgemini','Consulting'],['Visa','Fintech'],['Google','Tech'],['Dyson','Engineering'],
  ['Standard Chartered','Banking']];
const ROLES = ['Data Science Intern','Software Engineer Intern','ML Engineer Intern',
  'Product Analyst Intern','AI Research Intern'];

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[rand(0, arr.length - 1)];
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const clampNow = d => (d > new Date() ? new Date() : d);

async function seed() {
  db.exec(`DELETE FROM stage_history; DELETE FROM applications; DELETE FROM sessions;
           DELETE FROM companies; DELETE FROM users;`);

  const insertUser = db.prepare('INSERT INTO users (username, password_hash, salt, role) VALUES (?,?,?,?)');
  const addUser = async (name, pw, role = 'user') => {
    const { hash, salt } = await hashPassword(pw);
    return insertUser.run(name, hash, salt, role).lastInsertRowid;
  };
  await addUser('admin', 'admin1234', 'admin');
  const userIds = [await addUser('demo', 'demo1234')];
  for (let i = 1; i <= 11; i++) userIds.push(await addUser(`student${i}`, 'demo1234'));

  const insertCompany = db.prepare('INSERT INTO companies (name, industry, status) VALUES (?,?,?)');
  const companyIds = COMPANIES.map(([n, ind]) => insertCompany.run(n, ind, 'approved').lastInsertRowid);
  insertCompany.run('Stripe', 'Fintech', 'pending');     // for the admin to approve
  insertCompany.run('Grab Holdings', 'Tech', 'pending'); // near-duplicate for the admin to reject

  const insertApp = db.prepare(`INSERT INTO applications
    (user_id, company_id, role_title, stage, priority, deadline, notes, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  const insertHist = db.prepare(
    'INSERT INTO stage_history (application_id, from_stage, to_stage, changed_at) VALUES (?,?,?,?)');

  db.transaction(() => {
    for (const uid of userIds) {
      for (let k = 0; k < rand(8, 15); k++) {
        const created = addDays(new Date(), -rand(15, 60));
        const path = STAGES.slice(0, rand(1, 5));
        const target = path.length - 1;
        if (target >= 1 && target <= 3 && Math.random() < 0.35) path.push('rejected');

        let t = created;
        const moves = path.map((stage, i) => {
          if (i > 0) t = clampNow(addDays(t, rand(2, 10)));
          return { from: i === 0 ? null : path[i - 1], to: stage, at: t.toISOString() };
        });
        const last = moves[moves.length - 1];
        const appId = insertApp.run(uid, pick(companyIds), pick(ROLES), last.to,
          pick(['low', 'medium', 'high']), addDays(created, rand(7, 40)).toISOString().slice(0, 10),
          '', created.toISOString(), last.at).lastInsertRowid;
        for (const m of moves) insertHist.run(appId, m.from, m.to, m.at);
      }
    }
  })();
  console.log('Seeded. Logins: admin/admin1234, demo/demo1234');
}
seed();