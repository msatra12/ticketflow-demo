# TicketFlow

A full-stack ITSM ticketing platform — sign-up/login with admin approval,
department-based RBAC, an agent console with SLA tracking and a monthly
leaderboard, and an employee self-service request catalog. One repo, one
Vercel deployment: static frontend + serverless API + Postgres.

## Architecture

```
public/index.html      Frontend — vanilla JS, calls the API via fetch()
api/index.js            Express app exported as a Vercel serverless function
                         (also runnable directly with `node api/index.js` locally)
routes/                 auth · accounts (approvals) · tickets · stats
middleware/              JWT auth + department/role RBAC guards
db/
  pool.js                 Postgres connection pool
  schema.sql               table definitions
  init.js                   creates tables + seeds demo data on first request
  repositories.js          Accounts / Tickets / Audit — all SQL lives here
utils/leaderboard.js     point-weighted monthly ranking calculation
scripts/reset.js          wipe + reseed the database on demand
vercel.json               routes /api/* to the function, everything else to /public
```

Why this split: routes never touch SQL directly, and `db/repositories.js` never
touches HTTP — that boundary is what lets you swap Postgres for something else,
or add a second frontend, without a rewrite.

## RBAC model

- Any account with `department = 'IT'` gets agent-level access: sees every
  ticket, can assign/resolve, sees the leaderboard.
- The one seeded `role = 'admin'` account additionally unlocks the Approvals
  tab and the audit log.
- Everyone else only sees and comments on their own tickets.

## Deploying — one project on Vercel

1. Push this repo to GitHub.
2. On vercel.com, **Add New → Project** and import the repo.
3. Before the first deploy (or right after), go to the **Storage** tab →
   **Create Database → Postgres**, then **Connect** it to this project.
   Vercel automatically injects `POSTGRES_URL` into your environment — you
   don't set it by hand.
4. Under **Settings → Environment Variables**, add `JWT_SECRET` (any long
   random string).
5. Deploy. First request to any `/api/*` route creates the tables and seeds
   demo data automatically — nothing to run manually.

Your whole app — UI and API — now lives at one URL.

## Running locally

Needs a Postgres instance (local install, Docker, or a free one from
Neon/Supabase — anything `pg` can connect to).

```bash
npm install
cp .env.example .env      # point POSTGRES_URL at your database, set JWT_SECRET
npm run dev                 # serves both the API and public/ at localhost:4000
```

Reset the database anytime: `npm run seed:reset`.

## Demo credentials

| Role     | Email           | Password |
|----------|-----------------|----------|
| Admin    | admin@demo.io   | ******** |
| IT staff | sarah@demo.io   | demo123  |
| Employee | alex@demo.io    | demo123  |

## API reference

All routes except `/health`, `/auth/signup`, `/auth/login` require
`Authorization: Bearer <token>`.

| Method | Route | Access | Notes |
|--------|-------|--------|-------|
| GET | `/api/health` | public | liveness check |
| POST | `/api/auth/signup` | public | creates a pending account |
| POST | `/api/auth/login` | public | returns `{ token, user }` |
| GET | `/api/auth/me` | auth | current user |
| GET | `/api/accounts/pending` | admin | pending sign-ups |
| POST | `/api/accounts/:id/approve` | admin | body: `{ department? }` |
| POST | `/api/accounts/:id/deny` | admin | |
| GET | `/api/tickets` | auth | own tickets, or all if IT staff. Query: `status`, `priority`, `search` |
| POST | `/api/tickets` | auth | body: `{ subject, description, priority, category }` |
| GET | `/api/tickets/:id` | auth | visibility enforced |
| PATCH | `/api/tickets/:id` | IT staff | body: `{ status?, assigneeName? }` |
| POST | `/api/tickets/:id/comments` | auth | body: `{ body }` |
| GET | `/api/stats/dashboard` | auth | scoped counts |
| GET | `/api/stats/leaderboard` | IT staff | monthly points + badges |
| GET | `/api/stats/audit` | admin | full audit trail |

Leaderboard points are weighted by urgency (`Critical 20, High 12, Medium 6,
Low 3`) and computed live from tickets resolved in the current calendar
month — the "reset on the 1st" falls out of that date filter automatically.

## License

MIT
