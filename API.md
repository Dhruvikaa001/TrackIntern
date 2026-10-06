**Conventions**

• All bodies are JSON. Dates are YYYY-MM-DD strings, and timestamps are ISO strings.
• Stages: wishlist, applied, oa, interview, offer, rejected.
• Priorities: low, medium, high.
• Errors always use this shape:

{ "error": "Validation failed", "fields": { "role_title": "Role title is required" } }

fields appears only on 400 responses.

| Status | Meaning | Client shows |
| --- | --- | --- |
| 200 / 201 | OK / created | Success toast |
| 204 | Deleted | Success toast |
| 400 | Validation error | Inline field messages |
| 401 | Not logged in | Redirect to login |
| 403 | Not allowed (e.g. non-admin) | Error toast |
| 404 | Not found or not yours | Error toast, remove from UI |
| 409 | Conflict (username or company exists) | Inline field message |
| 500 | Server error | Banner with Retry |


**Auth**

POST /api/auth/register  { "username": "dhruvi", "password": "secret123" }
  → 201 { "id": 3, "username": "dhruvi", "role": "user" }   (+ sets cookie)
POST /api/auth/login     { "username": "dhruvi", "password": "secret123" }
  → 200 { "id": 3, "username": "dhruvi", "role": "user" }   (+ sets cookie)
POST /api/auth/logout    → 204   (clears cookie)
GET  /api/auth/me        → 200 { "id": 3, "username": "dhruvi", "role": "user" }  | 401

**Applications**

The application object returned everywhere:

{
  "id": 12,
  "company_id": 4,
  "company_name": "Grab",
  "role_title": "Data Science Intern",
  "stage": "applied",
  "priority": "high",
  "deadline": "2026-10-20",
  "link": "https://grab.careers/...",
  "notes": "Referral from senior",
  "created_at": "2026-09-30T08:12:00Z",
  "updated_at": "2026-10-02T10:00:00Z"
}

GET    /api/applications?q=grab&stage=applied&priority=high&sort=deadline
       sort ∈ deadline | updated | company        → 200 [ app, app, ... ]
GET    /api/applications/12                        → 200 { ...app, "history": [
         { "from_stage": null, "to_stage": "wishlist", "changed_at": "..." },
         { "from_stage": "wishlist", "to_stage": "applied", "changed_at": "..." } ] }
POST   /api/applications   { company_id, role_title, stage?, priority?, deadline?, link?, notes? }
                                                   → 201 app
PATCH  /api/applications/12  { any editable field except stage }  → 200 app
PATCH  /api/applications/12/stage  { "stage": "interview" }       → 200 app
DELETE /api/applications/12                        → 204
GET    /api/applications/stats                     → 200 { "counts": { "applied": 5, ... }, "total": 14 }

**Companies**

GET  /api/companies            → 200 [ { "id": 4, "name": "Grab", "industry": "Tech" }, ... ]  (approved only)
POST /api/companies  { "name": "Shopee", "industry": "E-commerce", "website": "..." }
                               → 201 { id, name, status: "pending" }  | 409 if name exists
GET  /api/companies/4/timeline → 200 { "applications": 38, "median_days_to_oa": 9,
                                      "interview_rate": 0.21 }   (fields null if fewer than 5)
                                      
**Admin (403 for non-admins)**

GET    /api/admin/companies?status=pending   → 200 [ { id, name, industry, website, status, created_by_username } ]
PATCH  /api/admin/companies/7  { "status": "approved", "name"?: "..." }  → 200 company
DELETE /api/admin/companies/7               → 204   (409 if applications still use it)
GET    /api/admin/users                     → 200 [ { id, username, role, is_active, app_count } ]
PATCH  /api/admin/users/3  { "is_active": false }  → 200 user
