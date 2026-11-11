# LinkBox API

LinkBox is a backend API that helps developers build bookmarking applications where users can save web links, organize them into collections, tag them, and automatically pull rich previews (like titles, descriptions, images, and site names) from the pages they save.

It handles the messy parts behind the scenes, like removing tracking parameters from URLs, preventing duplicate saves, verifying users via email OTP, rotating refresh tokens, and scraping metadata in the background so the main API stays fast and responsive.

---

## System Architecture

```mermaid
flowchart LR
    Client["Web/Mobile Client"]
    API["LinkBox API Server"]
    Worker["Background Worker"]
    Redis[("Redis Queue")]
    Postgres[("PostgreSQL Database")]

    Client -- "HTTPS API" --> API
    API -- "Enqueue scrape job" --> Redis
    Worker -- "Pull job" --> Redis
    Worker -- "Store metadata" --> Postgres
    API -- "Read/Write" --> Postgres

    style Client fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#fff
    style API fill:#2e1065,stroke:#8b5cf6,stroke-width:2px,color:#fff
    style Worker fill:#2e1065,stroke:#8b5cf6,stroke-width:2px,color:#fff
    style Redis fill:#4c0519,stroke:#ef4444,stroke-width:2px,color:#fff
    style Postgres fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#fff
```

---

## Features

### Asynchronous Metadata Scraping
When a user saves a link, the API immediately stores it as `PENDING` and pushes a background job to a Redis queue. A BullMQ worker then fetches the page and extracts OpenGraph metadata (title, description, image, site name) with automatic retries. The link becomes `READY` once scraping succeeds, or `FAILED` if it exhausts all retries.

```mermaid
sequenceDiagram
    actor Client
    participant API as API Server
    participant Redis as Redis Queue
    participant Worker as Background Worker
    participant DB as Database

    Client->>API: Save a new link
    API->>DB: Store link as PENDING
    API->>Redis: Enqueue scrape job
    API-->>Client: Return 201 created
    Redis->>Worker: Process job
    Worker->>Worker: Scrape OpenGraph metadata
    Worker->>DB: Update link to READY
```

### URL Canonicalization and Deduplication
The API strips tracking parameters like `utm_source`, `fbclid`, `gclid`, `si`, and `ref` from URLs, removes hash fragments, and normalizes hostnames. A compound unique constraint on `userId` and `canonicalUrl` prevents the same user from saving the same link twice, even if it came from different sharing platforms.

```mermaid
flowchart LR
    UserLink["User pastes link"] --> Clean["Strip tracking params"] --> Check["Check duplicate"] --> Save["Save canonical URL"]

    style UserLink fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#fff
    style Clean fill:#2e1065,stroke:#8b5cf6,stroke-width:2px,color:#fff
    style Check fill:#2e1065,stroke:#8b5cf6,stroke-width:2px,color:#fff
    style Save fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#fff
```

### Secure Authentication
Users register with email and password, then verify their account with a 6-digit OTP sent via email. Login issues short-lived access tokens and long-lived refresh tokens. Refresh tokens are hashed, rotated on each use, and can be revoked on logout. Password reset also uses OTP verification.

```mermaid
sequenceDiagram
    actor User
    participant API as API Server
    participant DB as Database

    User->>API: Register with email/password
    API->>DB: Create unverified user + OTP
    API->>User: Send OTP email
    User->>API: Submit OTP
    API->>DB: Mark user verified
```

### Collections and Tags
Users can create named collections to group their links and apply tags for flexible organization. Collections enforce unique names per user, tags are created per user, and tags attach to links through a many-to-many relationship. All resource access is scoped to the authenticated owner to prevent unauthorized reads or modifications.

---

## Installation

1. Clone the repository:

```bash
git clone https://github.com/osegee/linkbox.git
cd linkbox
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root of the project:

```env
PORT=5000
DATABASE_URL="postgresql://user:password@localhost:5432/linkbox?schema=public"
REDIS_URL="redis://127.0.0.1:6379"
JWT_ACCESS_SECRET="your_access_token_secret"
JWT_REFRESH_SECRET="your_refresh_token_secret"
RESEND_API_KEY="your_resend_api_key"
```

4. Set up the database:

```bash
npx prisma migrate dev
npx prisma generate
```

5. Start the development server:

```bash
npm run dev
```

---

## Usage

Once the server is running, it listens on the port defined in your `.env` file (default `5000`). You can check the health endpoint:

```bash
curl http://localhost:5000/health
```

You should see:

```json
{
  "success": true,
  "data": { "status": "ok" }
}
```

To register a new user:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Ada Lovelace",
    "email": "ada@example.com",
    "password": "securepassword"
  }'
```

To save a new link:

```bash
curl -X POST http://localhost:5000/api/links \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article?utm_source=twitter",
    "collectionId": "<optional-collection-id>"
  }'
```

---

## Technologies Used

| Technology | Description |
|------------|-------------|
| [Node.js](https://nodejs.org/) | JavaScript runtime |
| [TypeScript](https://www.typescriptlang.org/) | Typed JavaScript |
| [Express](https://expressjs.com/) | Web framework |
| [Prisma](https://www.prisma.io/) | ORM and schema management |
| [PostgreSQL](https://www.postgresql.org/) | Relational database |
| [Redis](https://redis.io/) | In-memory queue broker for BullMQ |
| [BullMQ](https://bullmq.io/) | Background job queue |
| [Cheerio](https://cheerio.js.org/) | Server-side HTML parsing |
| [Zod](https://zod.dev/) | Schema validation |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | JWT handling |
| [bcrypt](https://github.com/kelektiv/node.bcrypt.js) | Password hashing |
| [Resend](https://resend.com/) | Transactional email delivery |
| [Helmet](https://helmetjs.github.io/) | Security headers |
| [Morgan](https://github.com/expressjs/morgan) | HTTP request logging |

---

## Author

Built by **Osegee**.

---

## Badges

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
