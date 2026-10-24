# Mend

A community tool for reporting and tracking local problems: water cuts, power faults and potholes. Residents drop a pin on a map, neighbours confirm it instead of filing duplicates, moderators move it through to "resolved", and a public page shows what is open and what has been fixed.

> Portfolio project. Built to practise map-based apps, role-based access, multi-tenant data isolation and privacy-conscious public APIs.

![Reports list and map](docs/map.png)

## The problem

In many neighbourhoods, outages and road faults are reported in WhatsApp and Facebook groups. The same problem is posted ten times, nobody knows how many people are affected, and there is no record of whether it was ever fixed.

Mend turns that scattered chatter into one list: **one real problem, one report, many confirmations, and a visible status.**

## Features

- **Communities:** anyone can start a community (a ward, a suburb, a campus) and become its admin. Residents join an existing one.
- **Map reporting:** click the map to place a report, choose a category (water, power, pothole, other), add a title and details.
- **Duplicate check:** after placing a pin, Mend shows open reports of the same type within 250 m and offers "I have this too" instead of a new report.
- **Confirmations:** neighbours back an existing report. At 3 people affected it moves from *Reported* to *Confirmed* automatically.
- **Status tracking:** every report moves through Reported, Confirmed, In progress and Resolved, with a history and optional notes from moderators.
- **Moderators:** the admin promotes residents to moderator. Moderators and admins update report statuses.
- **Public status page:** anyone can open `/c/your-community` without an account to see open problems, fixes from the last 30 days and the typical time to fix.
- **Responsive:** list and map side by side on desktop, stacked on phones.

![Report detail with status track](docs/detail.png)

![Duplicate check when placing a pin](docs/duplicate-check.png)

![Public status page](docs/public.png)

## Tech stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Frontend | React, Vite, React Router                       |
| Map      | Leaflet and OpenStreetMap tiles                 |
| Backend  | Node.js, Express                                |
| Database | PostgreSQL on Neon (`@neondatabase/serverless`) |
| Auth     | JWT, bcrypt password hashing                    |

## Design decisions

**Duplicate detection.** The `/api/reports/nearby` endpoint first narrows candidates with a cheap latitude/longitude bounding box (served by a composite index), then applies the haversine formula to keep only reports within 250 m of the same category that are not yet resolved.

**Confirmation rule.** A person can confirm a report once (enforced by a composite primary key on `confirmations`), cannot confirm their own report (the reporter already counts as one voice) and cannot confirm a resolved report. At three people affected the status moves to *Confirmed* and an entry is written to the report's history.

**Tenant isolation.** Every community-owned table carries a `community_id`. The server takes the community from the signed JWT, never from the request body, and includes it in every query. Another community asking for the same report gets a `404`.

**Roles are checked against the database.** The role is stored in the JWT for convenience, but permission checks (`requireRole`) read the current role from the database. Promoting or demoting a user takes effect immediately instead of when their token expires.

**Privacy on the public page.** The public API returns only safe fields: no descriptions, no reporter identity and no emails. Coordinates are rounded to about 100 m, because a fault outside someone's home could otherwise reveal where they live. Resolved reports drop off the page after 30 days.

**Abuse protection.** Public endpoints are rate limited (120 requests a minute per IP) and sign-in and sign-up routes are limited to slow down password guessing.

**Atomic sign-up.** Starting a community creates the community and its admin inside one database transaction, so a failure never leaves an orphaned community.

## Roles

| Action                          | Resident | Moderator | Admin |
| ------------------------------- | :------: | :-------: | :---: |
| View reports in own community   |   Yes    |    Yes    |  Yes  |
| Report a problem                |   Yes    |    Yes    |  Yes  |
| Confirm someone else's report   |   Yes    |    Yes    |  Yes  |
| Update a report's status        |    No    |    Yes    |  Yes  |
| Promote or demote moderators    |    No    |    No     |  Yes  |
| View the public status page     | Anyone, no account needed          |||

## Data model

- `communities` (id, name, slug, center_lat, center_lng)
- `users` (id, community_id, email, password_hash, role)
- `reports` (id, community_id, category, title, description, lat, lng, status, created_by, created_at, resolved_at)
- `confirmations` (report_id, user_id), primary key on the pair
- `updates` (id, report_id, user_id, new_status, note, created_at), the report history

## API overview

| Method | Endpoint                                  | Access      | Description                                 |
| ------ | ----------------------------------------- | ----------- | ------------------------------------------- |
| POST   | `/api/auth/register-community`            | Public      | Start a community and become its admin      |
| POST   | `/api/auth/register`                      | Public      | Join a community as a resident              |
| POST   | `/api/auth/login`                         | Public      | Log in and receive a token                  |
| GET    | `/api/auth/me`                            | Logged in   | Current user and community                  |
| GET    | `/api/communities`                        | Public      | List communities (name and slug only)       |
| GET    | `/api/reports`                            | Logged in   | List reports (`?category=` and `?status=`)  |
| GET    | `/api/reports/nearby`                     | Logged in   | Open reports of a category near a point     |
| POST   | `/api/reports`                            | Logged in   | Create a report                             |
| GET    | `/api/reports/:id`                        | Logged in   | One report with its history                 |
| POST   | `/api/reports/:id/confirm`                | Logged in   | "I have this too"                           |
| DELETE | `/api/reports/:id/confirm`                | Logged in   | Take a confirmation back                    |
| PATCH  | `/api/reports/:id/status`                 | Moderator   | Change status, with an optional note        |
| GET    | `/api/team`                               | Admin       | List members of the community               |
| PATCH  | `/api/team/:id/role`                      | Admin       | Make a resident a moderator, or back        |
| GET    | `/api/public/:slug/summary`               | Public      | Counts and typical time to fix              |
| GET    | `/api/public/:slug/reports`               | Public      | Open and recently fixed reports (safe fields) |
| GET    | `/api/public/:slug/reports/:id`           | Public      | One report's status history                 |

## Running it locally

You need Node.js 18 or newer and a free [Neon](https://neon.tech) PostgreSQL database.

### 1. Clone and install

```bash
git clone https://github.com/Jayday0707-MNC/mend.git
cd mend

cd server && npm install
cd ../client && npm install
```

### 2. Create the database tables

Open the Neon SQL Editor and run:

```sql
CREATE TABLE communities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  community_id INT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('resident', 'moderator', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  community_id INT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('water', 'power', 'pothole', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'reported'
    CHECK (status IN ('reported', 'confirmed', 'in_progress', 'resolved')),
  created_by INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE confirmations (
  report_id INT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (report_id, user_id)
);

CREATE TABLE updates (
  id SERIAL PRIMARY KEY,
  report_id INT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id),
  new_status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX reports_community_status_idx ON reports (community_id, status);
CREATE INDEX reports_nearby_idx ON reports (community_id, category, lat, lng);
```

### 3. Configure the server

Copy `server/.env.example` to `server/.env` and fill it in:

```
DATABASE_URL=postgresql://user:password@your-host.neon.tech/neondb?sslmode=require
JWT_SECRET=a-long-random-string
PORT=5000
```

### 4. Start both apps

```bash
# terminal 1
cd server
npm run dev

# terminal 2
cd client
npm run dev
```

Open the address Vite prints (usually http://localhost:5173), choose **Start one** to create a community, then invite a friend to **Join a community** to try confirmations. The public page lives at `/c/<your-community-slug>`.

## Project structure

```
mend/
  server/
    index.js              Express app and route wiring
    db.js                 Neon connection pool
    middleware/
      auth.js             JWT check and database-backed role check
      rateLimit.js        Small in-memory rate limiter
    routes/
      auth.js             Sign-up, sign-in, current user
      communities.js      Public list of communities
      reports.js          Reports, duplicate check, confirmations, status
      team.js             Admin: members and moderator roles
      public.js           Public status page API (safe fields only)
  client/
    src/
      App.jsx             Routes, including the public page
      Layout.jsx          Top bar
      Reports.jsx         List and map workspace
      NewReport.jsx       Report form with duplicate check
      ReportDetail.jsx    Status track, history, confirm and moderate
      MapView.jsx         Leaflet map with category pins
      PublicPage.jsx      Logged-out status page
      Team.jsx            Moderator management and public link
      AuthPage.jsx        Log in, join or start a community
```

## Known limitations

- Mend is a community tool. It is **not connected to any municipality's systems**, so a report does not notify a council by itself.
- The rate limiter keeps counts in memory, which is fine for a single server but would need a shared store such as Redis to run on several.
- Map tiles come from OpenStreetMap's public servers, which suit development and small projects. A public launch should use a tile provider with its own usage terms.
- Role changes take effect immediately on the server, but a user's open page may need a refresh to show the new options.

## Roadmap

- [ ] Photo uploads on reports
- [ ] Email notification to the reporter when the status changes
- [ ] Phone-number sign-up for residents without email
- [ ] Automated tests for the isolation, confirmation and duplicate-check rules
- [ ] Deployment (Vercel + Render + Neon)