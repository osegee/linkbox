# LinkBox API — Asynchronous Bookmarking & Link Management Backend

A production-grade RESTful API built with **Node.js, TypeScript, Express, Prisma (PostgreSQL), and BullMQ (Redis)**. LinkBox allows users to save, organize, and deduplicate web links into collections and tags while asynchronously scraping OpenGraph metadata in the background.

---

## Architectural Highlights

- **Decoupled Ingestion & Background Scraping (BullMQ + Redis + Cheerio):** Saving a link (`POST /api/links`) never blocks the HTTP request waiting on slow third-party websites. The API canonicalizes the URL, persists the record as `PENDING` in milliseconds, and dispatches a job to a Redis-backed BullMQ queue. A background worker scrapes OpenGraph metadata (`og:title`, `og:description`, `og:image`, `og:site_name`) with automatic exponential backoff retries and transitions the link to `READY` (or `FAILED` after exhausting retries).
- **URL Canonicalization & Deduplication Engine:** Incoming URLs are normalized by stripping marketing/tracking parameters (`utm_source`, `fbclid`, `gclid`, `si`, `ref`), removing hash fragments, and standardizing hostnames. A compound unique constraint (`@@unique([userId, canonicalUrl])`) prevents duplicate saves across different sharing platforms while preserving the original URL.
- **Stateful Session Security & Refresh Token Rotation:** Uses short-lived JWT access tokens paired with database-backed refresh token rotation, grace-window concurrency handling, reuse detection, and SHA-256 hashed OTP verification flows.
- **Relational Organization Layer:** Supports 1-to-Many **Collections** (folders with aggregated link counts) and Many-to-Many **Tags** via an explicit `LinkTag` join table using idempotent batch operations and strict user-ownership checks (IDOR prevention).
- **End-to-End Type Safety & Validation:** Request bodies and parameters are validated at the routing boundary using **Zod** schemas and strongly typed Express controller generics.

---

## Tech Stack

- **Runtime & Language:** Node.js, TypeScript
- **Framework:** Express.js
- **Database & ORM:** PostgreSQL, Prisma ORM
- **Queue & Message Broker:** Redis (`ioredis`), BullMQ
- **HTML Parsing:** Cheerio
- **Authentication & Security:** JSON Web Tokens (`jsonwebtoken`), `bcrypt`, Node `crypto` (SHA-256), Zod

---

## System Workflow: Saving a Link

```text
Client (POST /api/links)
  │
  ├── 1. Zod validates URL format & payload
  ├── 2. URL Utility strips trackers (utm_*, fbclid, si) -> generates canonicalUrl
  ├── 3. Prisma saves Link with status: "PENDING"
  ├── 4. BullMQ pushes { linkId, url } to Redis Queue
  └── 5. Returns 201 Created immediately (~30ms)
         │
         ▼ (Asynchronous Background Process)
BullMQ Worker
  ├── 6. Pulls job from Redis Queue
  ├── 7. Fetches HTML & extracts OpenGraph tags via Cheerio
  └── 8. Updates Link in PostgreSQL -> status: "READY" (or "FAILED" after 3 retries)
```

---

## Project Structure

```text
src/
├── config/          # Prisma client & Redis connection setup
├── controllers/     # Express route handlers (Auth, Collections, Tags, Links)
├── middleware/      # JWT Auth Guard, Zod validator, Global Error Handler
├── queues/          # BullMQ producer queue & background scraping worker
├── routes/          # Express routers mounted under /api/*
├── schemas/         # Zod validation schemas & inferred TypeScript types
├── services/        # Business logic & Prisma database queries
├── utils/           # URL canonicalizer, Cheerio HTML scraper, JWT/OTP helpers, AppError
├── app.ts           # Express app configuration & middleware wiring
└── server.ts        # HTTP server entry point
```

---

## Getting Started Locally

### 1. Prerequisites

- **Node.js** (v18+)
- **PostgreSQL** (Local or Neon)
- **Redis** (Local `redis-server` or Upstash)

### 2. Installation

```bash
git clone <your-repo-url>
cd linkbox-backend
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
DATABASE_URL="postgresql://user:password@localhost:5432/linkbox?schema=public"
REDIS_URL="redis://127.0.0.1:6379"

JWT_SECRET="your_access_token_secret"
JWT_REFRESH_SECRET="your_refresh_token_secret"

# Email / OTP Configuration
RESEND_API_KEY="your_resend_api_key"
```

### 4. Database Migration & Development Server

```bash
# Generate Prisma client and push migrations
npx prisma migrate dev

# Start the development server (API + BullMQ Worker)
npm run dev
```

---

## API Endpoints Overview

### Authentication (`/api/auth`)

| Method | Endpoint                 | Description                                         | Auth Required |
| :----- | :----------------------- | :-------------------------------------------------- | :-----------: |
| `POST` | `/api/auth/register`     | Register a new user account & send verification OTP |      No       |
| `POST` | `/api/auth/verify-email` | Verify account with 6-digit OTP                     |      No       |
| `POST` | `/api/auth/login`        | Authenticate user & issue Access + Refresh tokens   |      No       |
| `POST` | `/api/auth/refresh`      | Rotate refresh token & issue new token pair         |      No       |
| `POST` | `/api/auth/logout`       | Revoke active session refresh token                 |      Yes      |

### Collections (`/api/collections`)

| Method   | Endpoint               | Description                                  | Auth Required |
| :------- | :--------------------- | :------------------------------------------- | :-----------: |
| `POST`   | `/api/collections`     | Create a new collection (folder)             |      Yes      |
| `GET`    | `/api/collections`     | List user collections with total link counts |      Yes      |
| `GET`    | `/api/collections/:id` | Get single collection details and its links  |      Yes      |
| `PATCH`  | `/api/collections/:id` | Rename or update collection description      |      Yes      |
| `DELETE` | `/api/collections/:id` | Delete a collection                          |      Yes      |

### Tags (`/api/tags`)

| Method   | Endpoint                         | Description                                | Auth Required |
| :------- | :------------------------------- | :----------------------------------------- | :-----------: |
| `POST`   | `/api/tags`                      | Create a new tag                           |      Yes      |
| `GET`    | `/api/tags`                      | Get all tags belonging to the user         |      Yes      |
| `PATCH`  | `/api/tags/:id`                  | Rename an existing tag                     |      Yes      |
| `DELETE` | `/api/tags/:id`                  | Delete a tag                               |      Yes      |
| `POST`   | `/api/tags/links/:linkId`        | Attach an array of tags to a specific link |      Yes      |
| `DELETE` | `/api/tags/links/:linkId/:tagId` | Detach a single tag from a link            |      Yes      |

### Links (`/api/links`)

| Method   | Endpoint         | Description                                                  | Auth Required |
| :------- | :--------------- | :----------------------------------------------------------- | :-----------: |
| `POST`   | `/api/links`     | Normalize URL, save link (`PENDING`), and enqueue scrape job |      Yes      |
| `GET`    | `/api/links`     | List saved links (supports `?collectionId=` filter)          |      Yes      |
| `GET`    | `/api/links/:id` | Get a single link with its collection and attached tags      |      Yes      |
| `PATCH`  | `/api/links/:id` | Update link title, note, folder, favourite, or archive state |      Yes      |
| `DELETE` | `/api/links/:id` | Permanently delete a link                                    |      Yes      |

---

## License

ISC
