# TrackIntern

An internship application tracker. Students log each application, move it through stages (Wishlist, Applied, OA, Interview, Offer, Rejected), and see deadlines at a glance. Admins approve new companies and manage accounts, but never see anyone's application details.

Built for a web-development course by Dhruvikaa (server, auth, admin) and Sandra Braun (client UI).

## Tech stack

- Client: vanilla JavaScript (ES modules) + [Pico CSS](https://picocss.com) (CSS only, no framework)
- Server: Node.js 22+, Express 5
- Database: SQLite via `better-sqlite3`
- Auth: session cookies, two roles (`user`, `admin`)

## Run it

Requires Node.js 22 or newer.

```bash
npm install
npm run seed     # creates data/app.db with demo data (resets it if it exists)
npm start        # or: npm run dev  (auto-restarts on changes)
```

Open http://localhost:3000.

### Demo logins

| Username | Password | Role |
| --- | --- | --- |
| `demo` | `demo1234` | user (about a dozen applications) |
| `admin` | `admin1234` | admin |
| `student1` ... `student11` | `demo1234` | users with their own data |

## Project structure

```
public/            client (index.html, css/, js/)
server/
  server.js        app setup, middleware order, route mounting
  middleware.js    authenticate, requireAuth, requireAdmin, errorHandler
  auth.js          password hashing, sessions, cookies
  validate.js      input validation for applications
  db.js            SQLite connection (foreign keys ON)
  schema.sql       table definitions
  seed.js          demo data
  routes/          auth, applications, companies, admin
API.md             the contract between client and server
security-check.js  automated security checks (see below)
```

## How it works

- **Passwords** are hashed with scrypt and a random per-user salt, and compared with `crypto.timingSafeEqual`.
- **Sessions** are random 32-byte tokens stored in a `sessions` table with an expiry. The cookie is `HttpOnly` and `SameSite=Strict`.
- **Every query uses `?` placeholders.** The sort option is checked against a whitelist and never put into SQL.
- **Ownership:** every application query includes `WHERE user_id = ?`, so another user's application returns 404.
- **Stage moves** update the application and write a `stage_history` row inside one transaction.
- **Companies:** user suggestions start as `pending` and are visible only to the suggester until an admin approves them. A company still used by applications cannot be deleted (409).
- **Errors** always use the shape `{ "error": "...", "fields": { ... } }`. See `API.md`.

## Database

Five tables: `users`, `sessions`, `companies`, `applications`, `stage_history`. Deleting a user or application cascades to their sessions, applications and history; deleting a company that applications use is blocked.

## Security check

With the server running in one terminal, run this in another:

```bash
node security-check.js
```

It creates temporary `sectest_` accounts, checks authentication, roles, ownership, validation, injection handling, the company approval flow, disabling users and logout, then deletes its own data. Run `npm run seed` afterwards if you want a fresh demo database.

## Known limitations

- The cookie has no `Secure` flag because the app runs on plain `http://localhost`. It must be added behind HTTPS.
- No rate limiting on login.
- Single-process SQLite; not meant for many concurrent users.

## API

See [API.md](API.md).
