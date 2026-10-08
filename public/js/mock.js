// mock.js – FAKE SERVER for development, until Person A's real API is running.
// Follows API_CONTRACT.md (same routes, same fields, same error format).
// Data lives in memory: a page reload resets it (only the login survives, see below).
//
// DELETE THIS FILE when the real API works (and remove the MOCK block in api.js).

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const STAGES = ["wishlist", "applied", "oa", "interview", "offer", "rejected"];
const PRIORITIES = ["low", "medium", "high"];

const now = () => new Date().toISOString();
const tsAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();
const dayOffset = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// ---------------------------------------------------------------- data

// Demo logins: alice / password123 (user), admin / admin12345 (admin),
// bob / password123 (disabled account)
const users = [
  { id: 1, username: "alice", password: "password123", role: "user", is_active: true, created_at: tsAgo(30) },
  { id: 2, username: "admin", password: "admin12345", role: "admin", is_active: true, created_at: tsAgo(40) },
  { id: 3, username: "bob", password: "password123", role: "user", is_active: false, created_at: tsAgo(20) },
];

const companies = [
  { id: 1, name: "Spotify", industry: "Music / Tech", website: "https://spotify.com", status: "approved", created_by: 2 },
  { id: 2, name: "Klarna", industry: "Fintech", website: "https://klarna.com", status: "approved", created_by: 2 },
  { id: 3, name: "Ericsson", industry: "Telecom", website: "https://ericsson.com", status: "approved", created_by: 2 },
  { id: 4, name: "Volvo Cars", industry: "Automotive", website: "https://volvocars.com", status: "approved", created_by: 2 },
  { id: 5, name: "IKEA", industry: "Retail", website: "https://ikea.com", status: "approved", created_by: 2 },
  { id: 6, name: "Atlas Copco", industry: "Industry", website: "https://atlascopco.com", status: "approved", created_by: 2 },
  { id: 7, name: "H&M", industry: "Fashion", website: "https://hm.com", status: "approved", created_by: 2 },
  { id: 8, name: "Acme GmbH", industry: "Software", website: null, status: "pending", created_by: 1 },
];

let nextAppId = 1;
let nextHistoryId = 1;
let nextCompanyId = 9;
let nextUserId = 4;

function makeApp(company_id, role_title, stage, priority, deadline, daysSinceCreated, link = null, notes = null) {
  // History path: wishlist -> applied -> (oa -> interview -> offer) or rejected
  const path = ["wishlist"];
  if (stage !== "wishlist") {
    path.push("applied");
    if (["oa", "interview", "offer"].includes(stage)) {
      for (const s of ["oa", "interview", "offer"]) {
        path.push(s);
        if (s === stage) break;
      }
    } else if (stage === "rejected") {
      path.push("rejected");
    }
  }
  const stage_history = path.map((to, i) => ({
    id: nextHistoryId++,
    from_stage: i === 0 ? null : path[i - 1],
    to_stage: to,
    changed_at: tsAgo(Math.max(daysSinceCreated - i * 3, 0)),
  }));
  return {
    id: nextAppId++,
    user_id: 1,
    company_id,
    role_title,
    stage,
    priority,
    deadline,
    link,
    notes,
    position: 0,
    created_at: tsAgo(daysSinceCreated),
    updated_at: stage_history[stage_history.length - 1].changed_at,
    stage_history,
  };
}

const apps = [
  makeApp(1, "Backend Intern", "applied", "high", dayOffset(5), 20, "https://example.com/spotify", "Referral from a friend"),
  makeApp(2, "Data Science Intern", "wishlist", "medium", dayOffset(-2), 10), // overdue
  makeApp(3, "Embedded Software Intern", "oa", "high", dayOffset(3), 18),
  makeApp(4, "Frontend Intern", "interview", "medium", dayOffset(12), 25, null, "Interview with the team lead"),
  makeApp(5, "UX Research Intern", "offer", "low", null, 30),
  makeApp(6, "Mechanical Design Intern", "rejected", "low", null, 28),
  makeApp(1, "Frontend Intern", "applied", "medium", dayOffset(20), 16),
  makeApp(7, "Data Analyst Intern", "wishlist", "low", null, 4),
];
// Give every card a position inside its column
for (const s of STAGES) apps.filter((a) => a.stage === s).forEach((a, i) => (a.position = i));

// The "session": survives a page reload (like a cookie would)
let currentUser = null;
try {
  const id = Number(sessionStorage.getItem("mock_user_id"));
  currentUser = users.find((u) => u.id === id) || null;
} catch {
  currentUser = null;
}
function setSession(user) {
  currentUser = user;
  try {
    if (user) sessionStorage.setItem("mock_user_id", String(user.id));
    else sessionStorage.removeItem("mock_user_id");
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- helpers

const ok = (data, status = 200) => ({ status, data });
const fail = (status, error) => ({ status, data: { error } });
const invalid = (errors) => ({ status: 400, data: { errors } });

const publicUser = (u) => ({ id: u.id, username: u.username, role: u.role });

function publicApp(a, withHistory = false) {
  const { user_id, stage_history, ...rest } = a;
  const company = companies.find((c) => c.id === a.company_id);
  const out = { ...rest, company_name: company ? company.name : null };
  if (withHistory) out.stage_history = stage_history.map((h) => ({ ...h }));
  return out;
}

const byPosition = (a, b) => a.position - b.position;

function normalize(body) {
  const out = { ...body };
  for (const k of ["deadline", "link", "notes"]) {
    if (k in out && (out[k] === "" || out[k] === undefined)) out[k] = null;
  }
  return out;
}

function validateApp(b, partial) {
  const errors = {};
  if (!partial || "role_title" in b) {
    const t = typeof b.role_title === "string" ? b.role_title.trim() : "";
    if (t.length < 1 || t.length > 100) errors.role_title = "Required (1-100 characters)";
  }
  if (!partial || "company_id" in b) {
    if (!companies.some((c) => c.id === Number(b.company_id))) errors.company_id = "Please choose a company";
  }
  if (b.deadline != null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.deadline) || isNaN(Date.parse(b.deadline))) errors.deadline = "Invalid date";
  }
  if (b.link != null) {
    try {
      const l = new URL(b.link);
      if (!/^https?:$/.test(l.protocol)) throw new Error();
    } catch {
      errors.link = "Invalid URL";
    }
  }
  if (b.priority != null && !PRIORITIES.includes(b.priority)) errors.priority = "Invalid priority";
  if (typeof b.notes === "string" && b.notes.length > 2000) errors.notes = "Max 2000 characters";
  return errors;
}

function renumber(stage) {
  apps.filter((a) => a.stage === stage).sort(byPosition).forEach((a, i) => (a.position = i));
}

// ---------------------------------------------------------------- the fake server

export async function mockRequest(method, url, body) {
  await delay(300); // so you can see loading states
  const u = new URL(url, "http://mock");
  const path = u.pathname;
  const q = u.searchParams;
  let m;

  // ---------- auth (public)
  if (method === "POST" && path === "/api/auth/register") {
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");
    const errors = {};
    if (username.length < 3 || username.length > 30) errors.username = "3 to 30 characters";
    else if (users.some((x) => x.username.toLowerCase() === username.toLowerCase())) errors.username = "Username already taken";
    if (password.length < 8) errors.password = "At least 8 characters";
    if (Object.keys(errors).length) return invalid(errors);
    const user = { id: nextUserId++, username, password, role: "user", is_active: true, created_at: now() };
    users.push(user);
    return ok(publicUser(user), 201);
  }

  if (method === "POST" && path === "/api/auth/login") {
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");
    if (!username || !password) {
      const errors = {};
      if (!username) errors.username = "Required";
      if (!password) errors.password = "Required";
      return invalid(errors);
    }
    const user = users.find((x) => x.username === username && x.password === password);
    if (!user) return fail(401, "Invalid username or password");
    if (!user.is_active) return fail(403, "Account disabled");
    setSession(user);
    return ok(publicUser(user));
  }

  // ---------- everything below needs a login
  if (!currentUser) return fail(401, "Not logged in");

  if (method === "POST" && path === "/api/auth/logout") {
    setSession(null);
    return ok(null, 204);
  }
  if (method === "GET" && path === "/api/auth/me") return ok(publicUser(currentUser));

  // ---------- applications
  if (method === "GET" && path === "/api/applications") {
    const stage = q.get("stage");
    const priority = q.get("priority");
    const deadline = q.get("deadline");
    const sort = q.get("sort");
    const errors = {};
    if (stage && !STAGES.includes(stage)) errors.stage = "Invalid stage";
    if (priority && !PRIORITIES.includes(priority)) errors.priority = "Invalid priority";
    if (deadline && !["overdue", "week"].includes(deadline)) errors.deadline = "Invalid deadline filter";
    if (sort && !["deadline", "updated", "company"].includes(sort)) errors.sort = "Invalid sort";
    if (Object.keys(errors).length) return invalid(errors);

    let list = apps.map((a) => publicApp(a));
    const text = (q.get("q") || "").trim().toLowerCase();
    if (text) list = list.filter((a) => a.company_name.toLowerCase().includes(text) || a.role_title.toLowerCase().includes(text));
    if (stage) list = list.filter((a) => a.stage === stage);
    if (priority) list = list.filter((a) => a.priority === priority);
    const today = dayOffset(0);
    const inWeek = dayOffset(7);
    if (deadline === "overdue") list = list.filter((a) => a.deadline && a.deadline < today);
    if (deadline === "week") list = list.filter((a) => a.deadline && a.deadline >= today && a.deadline <= inWeek);

    if (sort === "deadline") {
      list.sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"));
    } else if (sort === "company") {
      list.sort((a, b) => a.company_name.localeCompare(b.company_name));
    } else if (sort === "updated") {
      list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    } else {
      list.sort((a, b) => a.position - b.position || b.updated_at.localeCompare(a.updated_at));
    }
    return ok(list);
  }

  if (method === "POST" && path === "/api/applications") {
    const b = normalize(body || {});
    const errors = validateApp(b, false);
    if (Object.keys(errors).length) return invalid(errors);
    apps.filter((a) => a.stage === "wishlist").forEach((a) => a.position++);
    const created = {
      id: nextAppId++,
      user_id: currentUser.id,
      company_id: Number(b.company_id),
      role_title: b.role_title.trim(),
      stage: "wishlist",
      priority: b.priority || "medium",
      deadline: b.deadline ?? null,
      link: b.link ?? null,
      notes: b.notes ?? null,
      position: 0,
      created_at: now(),
      updated_at: now(),
      stage_history: [{ id: nextHistoryId++, from_stage: null, to_stage: "wishlist", changed_at: now() }],
    };
    apps.push(created);
    return ok(publicApp(created), 201);
  }

  if ((m = path.match(/^\/api\/applications\/(\d+)(\/stage)?$/))) {
    const app = apps.find((a) => a.id === Number(m[1]));
    if (!app) return fail(404, "Application not found");
    const isStage = Boolean(m[2]);

    if (method === "GET" && !isStage) return ok(publicApp(app, true));

    if (method === "PATCH" && !isStage) {
      const b = normalize(body || {});
      const errors = validateApp(b, true);
      if ("stage" in b) errors.stage = "Use PATCH /api/applications/:id/stage";
      if (Object.keys(errors).length) return invalid(errors);
      for (const k of ["company_id", "role_title", "deadline", "link", "priority", "notes"]) {
        if (k in b) app[k] = k === "company_id" ? Number(b[k]) : k === "role_title" ? b[k].trim() : b[k];
      }
      app.updated_at = now();
      return ok(publicApp(app));
    }

    if (method === "PATCH" && isStage) {
      const target = body?.stage;
      if (!STAGES.includes(target)) return invalid({ stage: "Invalid stage" });
      let pos = body.position === undefined ? 0 : body.position;
      if (!Number.isInteger(pos) || pos < 0) return invalid({ position: "Invalid position" });
      const old = app.stage;
      const column = apps.filter((a) => a.stage === target && a.id !== app.id).sort(byPosition);
      pos = Math.min(pos, column.length);
      column.splice(pos, 0, app);
      app.stage = target;
      column.forEach((a, i) => (a.position = i));
      if (old !== target) {
        app.stage_history.push({ id: nextHistoryId++, from_stage: old, to_stage: target, changed_at: now() });
        app.updated_at = now();
        renumber(old);
      }
      return ok(publicApp(app, true));
    }

    if (method === "DELETE" && !isStage) {
      apps.splice(apps.indexOf(app), 1);
      renumber(app.stage);
      return ok(null, 204);
    }
  }

  // ---------- companies
  if (method === "GET" && path === "/api/companies") {
    let list;
    if (q.get("status") === "all") {
      if (currentUser.role !== "admin") return fail(403, "Admin only");
      list = companies;
    } else {
      list = companies.filter((c) => c.status === "approved" || c.created_by === currentUser.id);
    }
    const out = list
      .map(({ created_by, ...c }) => c)
      .sort((a, b) => a.name.localeCompare(b.name));
    return ok(out);
  }

  if (method === "POST" && path === "/api/companies") {
    const name = String(body?.name ?? "").trim();
    const errors = {};
    if (name.length < 1 || name.length > 100) errors.name = "Required (1-100 characters)";
    if (body?.website) {
      try {
        new URL(body.website);
      } catch {
        errors.website = "Invalid URL";
      }
    }
    if (Object.keys(errors).length) return invalid(errors);
    if (companies.some((c) => c.name.toLowerCase() === name.toLowerCase())) return fail(409, "Company already exists");
    const c = {
      id: nextCompanyId++,
      name,
      industry: body.industry || null,
      website: body.website || null,
      status: "pending",
      created_by: currentUser.id,
    };
    companies.push(c);
    const { created_by, ...out } = c;
    return ok(out, 201);
  }

  if (method === "GET" && (m = path.match(/^\/api\/companies\/(\d+)\/timeline$/))) {
    const c = companies.find((x) => x.id === Number(m[1]) && x.status === "approved");
    if (!c) return fail(404, "Company not found");
    const enough = c.id === 1; // fake: only Spotify has >= 5 applications
    return ok({
      company_id: c.id,
      company_name: c.name,
      applications_count: enough ? 18 : 3,
      median_days_applied_to_oa: enough ? 6 : null,
      median_days_applied_to_interview: enough ? 14 : null,
      interview_rate: enough ? 0.33 : null,
      offer_rate: enough ? 0.06 : null,
    });
  }

  // ---------- stats
  if (method === "GET" && path === "/api/stats") {
    const by_stage = Object.fromEntries(STAGES.map((s) => [s, apps.filter((a) => a.stage === s).length]));
    const reached = (a, s) => a.stage_history.some((h) => h.to_stage === s);
    const applied = apps.filter((a) => reached(a, "applied"));
    const today = dayOffset(0);
    const inWeek = dayOffset(7);
    const followups = apps
      .filter((a) => a.stage === "applied")
      .map((a) => ({
        id: a.id,
        company_name: publicApp(a).company_name,
        role_title: a.role_title,
        days_since_update: Math.floor((Date.now() - Date.parse(a.updated_at)) / 86400000),
      }))
      .filter((f) => f.days_since_update >= 14)
      .sort((a, b) => b.days_since_update - a.days_since_update);
    return ok({
      total: apps.length,
      by_stage,
      interview_rate: applied.length ? applied.filter((a) => reached(a, "interview")).length / applied.length : null,
      offer_rate: applied.length ? applied.filter((a) => reached(a, "offer")).length / applied.length : null,
      overdue_count: apps.filter((a) => a.deadline && a.deadline < today).length,
      due_this_week_count: apps.filter((a) => a.deadline && a.deadline >= today && a.deadline <= inWeek).length,
      followups,
    });
  }

  // ---------- admin
  if (path.startsWith("/api/admin/")) {
    if (currentUser.role !== "admin") return fail(403, "Admin only");

    if (method === "GET" && path === "/api/admin/users") {
      return ok(
        users.map((x) => ({
          id: x.id,
          username: x.username,
          role: x.role,
          is_active: x.is_active,
          application_count: x.id === 1 ? apps.length : 0,
          created_at: x.created_at,
        }))
      );
    }

    if (method === "PATCH" && (m = path.match(/^\/api\/admin\/users\/(\d+)$/))) {
      const target = users.find((x) => x.id === Number(m[1]));
      if (!target) return fail(404, "User not found");
      if (typeof body?.is_active !== "boolean") return invalid({ is_active: "Must be true or false" });
      if (target.id === currentUser.id && !body.is_active) return fail(400, "You cannot disable your own account");
      target.is_active = body.is_active;
      return ok({
        id: target.id,
        username: target.username,
        role: target.role,
        is_active: target.is_active,
        application_count: target.id === 1 ? apps.length : 0,
        created_at: target.created_at,
      });
    }

    if ((m = path.match(/^\/api\/admin\/companies\/(\d+)$/))) {
      const c = companies.find((x) => x.id === Number(m[1]));
      if (!c) return fail(404, "Company not found");

      if (method === "PATCH") {
        if (body?.merge_into !== undefined) {
          const target = companies.find((x) => x.id === Number(body.merge_into));
          if (!target || target.id === c.id) return invalid({ merge_into: "Invalid target company" });
          apps.forEach((a) => {
            if (a.company_id === c.id) a.company_id = target.id;
          });
          companies.splice(companies.indexOf(c), 1);
          const { created_by, ...out } = target;
          return ok(out);
        }
        const errors = {};
        if ("name" in (body || {})) {
          const name = String(body.name).trim();
          if (!name || name.length > 100) errors.name = "Required (1-100 characters)";
          else if (companies.some((x) => x.id !== c.id && x.name.toLowerCase() === name.toLowerCase())) return fail(409, "Company already exists");
        }
        if (body?.status !== undefined && !["pending", "approved"].includes(body.status)) errors.status = "Invalid status";
        if (Object.keys(errors).length) return invalid(errors);
        for (const k of ["name", "industry", "website", "status"]) if (k in body) c[k] = k === "name" ? body[k].trim() : body[k];
        const { created_by, ...out } = c;
        return ok(out);
      }

      if (method === "DELETE") {
        if (apps.some((a) => a.company_id === c.id)) return fail(409, "Company has applications, merge it instead");
        companies.splice(companies.indexOf(c), 1);
        return ok(null, 204);
      }
    }
  }

  return fail(404, "Not found");
}
