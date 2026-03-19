# PC Hub

E-commerce web application for selling computer hardware. Built with Angular, Express.js, MySQL, and Prisma.

## Tech Stack

| Layer         | Technology                              |
| ------------- | --------------------------------------- |
| Frontend      | Angular 21, Tailwind CSS v4, TypeScript |
| Backend       | Express.js 5, TypeScript                |
| Database      | MySQL 8.0                               |
| ORM           | Prisma ORM v7                           |
| Image Storage | Cloudinary                              |
| Auth          | JWT (access + refresh tokens)           |

## Prerequisites

- Node.js 24+
- npm
- Docker and Docker Compose (optional — for local MySQL)

## Getting Started

### 1. Clone and install

```bash
git clone <repository-url>
cd pc-hub

# Install API dependencies
npm --prefix apps/api install

# Install Web dependencies
npm --prefix apps/web install
```

### 2. Start MySQL

```bash
docker compose up -d mysql
```

This starts MySQL 8.0 with a `pc_hub_dev` database and a `pc_hub_test` database (via `docker/mysql/init.sql`).

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values. At minimum, set strong JWT secrets (32+ characters).

### 4. Run database migrations

```bash
cd apps/api
npx prisma generate
npx prisma migrate deploy
```

### 5. Seed sample data (optional)

```bash
cd apps/api
npm run db:seed
```

Seeds 3 users, 6 categories, 6 brands, and 12 products. See [Seed Data](#seed-data) for details.

### 6. Start development servers

```bash
# From project root — run in separate terminals
npm run dev:api    # API on http://localhost:3000
npm run dev:web    # Web on http://localhost:4200
```

The web dev server proxies `/api` requests to the API server automatically.

## Project Structure

```
pc-hub/
├── apps/
│   ├── api/              # Express.js backend
│   │   ├── prisma/       # Schema, migrations, seed
│   │   ├── src/          # Application source
│   │   └── tests/        # API integration tests
│   └── web/              # Angular frontend
│       └── src/          # Application source
├── e2e/                  # Playwright end-to-end tests
├── docker/
│   ├── mysql/            # MySQL init scripts
│   ├── nginx/            # nginx config (Docker-only)
│   └── docker-compose.production.yml  # Optional self-hosted Docker stack
├── docs/                 # Project documentation
└── docker-compose.yml          # Development (local MySQL only)
```

## Available Scripts

### Root

| Script                  | Description                              |
| ----------------------- | ---------------------------------------- |
| `npm run dev:api`       | Start API dev server with hot reload     |
| `npm run dev:web`       | Start Angular dev server                 |
| `npm run build:all`     | Build both API and Web                   |
| `npm run lint:all`      | Lint both API and Web                    |
| `npm run test:all`      | Run all unit/integration tests           |
| `npm run test:e2e`      | Run Playwright E2E tests                 |
| `npm run test:e2e:headed` | Run E2E tests in headed browser mode   |

### API (`apps/api`)

| Script                      | Description                   |
| --------------------------- | ----------------------------- |
| `npm run dev`               | Start with hot reload (tsx)   |
| `npm run build`             | Compile TypeScript            |
| `npm start`                 | Run compiled server           |
| `npm run lint`              | ESLint                        |
| `npm run typecheck`         | TypeScript type checking      |
| `npm test`                  | Run tests (Vitest)            |
| `npm run db:generate`       | Generate Prisma client        |
| `npm run db:migrate`        | Create/apply migrations (dev) |
| `npm run db:migrate:deploy` | Apply migrations (production) |
| `npm run db:seed`           | Seed sample data              |

### Web (`apps/web`)

| Script          | Description                        |
| --------------- | ---------------------------------- |
| `npm start`     | Start dev server                   |
| `npm run build` | Production build                   |
| `npm run lint`  | ESLint via Angular CLI             |
| `npm test`      | Run tests (Vitest via Angular CLI) |

## Database

### Migrations

The project uses Prisma's migration-based workflow:

- **Development:** `npx prisma migrate dev` — creates and applies migrations
- **Production/CI:** `npx prisma migrate deploy` — applies existing migrations only

### Seed Data

The seed script (`apps/api/prisma/seed.ts`) creates:

| Entity     | Count | Details                                                |
| ---------- | ----- | ------------------------------------------------------ |
| Users      | 3     | admin@pchub.com / staff@pchub.com / customer@pchub.com |
| Categories | 6     | CPU, GPU, RAM, Motherboard, Storage, PSU               |
| Brands     | 6     | AMD, Intel, NVIDIA, Corsair, Samsung, Seasonic         |
| Products   | 12    | 2 per category with realistic specs and prices         |

Default passwords: `Admin@1234`, `Staff@1234`, `Customer@1234`

The seed is idempotent — safe to run multiple times.

## Deployment

The recommended deployment targets are **Vercel** (frontend) and **Railway** (API + MySQL). The API and frontend are platform-agnostic and do not require Docker in production.

### Recommended Architecture

```
Vercel  ─── serves Angular static build
             rewrites /api/* → Railway API URL

Railway ─── runs Express API (Node.js)
             connects to Railway-managed MySQL
```

### Deploy Frontend to Vercel

1. Import the repository in Vercel.
2. Set the **Root Directory** to `apps/web`.
3. Vercel auto-detects Angular. The build command is `npx ng build` and output is `dist/web/browser`.
4. Add a rewrite so `/api/:path*` proxies to your Railway API URL. Create `apps/web/vercel.json` or configure in the Vercel dashboard:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://<your-railway-api-url>/api/:path*"
    }
  ]
}
```

5. The production environment file (`src/environments/environment.ts`) already uses the relative path `/api/v1`, which works with the rewrite above.

### Deploy API to Railway

1. Create a new Railway project with a **MySQL** service and a **Node.js** service.
2. Set the Node.js service **Root Directory** to `apps/api`.
3. Set the **Build Command** to `npx prisma generate && npm run build`.
4. Set the **Start Command** to `npx prisma migrate deploy && node dist/server.js`.
5. Configure environment variables in the Railway dashboard (see [Environment Variables](#environment-variables) below).
6. Railway provides `DATABASE_URL` automatically for linked MySQL services.

### Seed on Railway

```bash
# Via Railway CLI
railway run --service api -- npx tsx prisma/seed.ts
```

### Self-Hosted Docker (optional)

A Docker Compose production stack is available in `docker/docker-compose.production.yml` for self-hosted or local full-stack testing. See `docker/` for Dockerfiles and nginx config. This is **not** the primary deployment path.

```bash
docker compose -f docker/docker-compose.production.yml up -d --build
```

## Environment Variables

### API

These variables are required on any platform (Railway, Docker, or local):

| Variable                   | Required | Default       | Description                                                |
| -------------------------- | -------- | ------------- | ---------------------------------------------------------- |
| `DATABASE_URL`             | Yes      | —             | MySQL connection string (`mysql://user:pass@host:3306/db`) |
| `PORT`                     | No       | `3000`        | API server port (Railway sets this automatically)          |
| `NODE_ENV`                 | No       | `development` | `development`, `test`, or `production`                     |
| `CORS_ORIGIN`              | Yes      | —             | Allowed CORS origin (must not be `*` in production)        |
| `JWT_ACCESS_SECRET`        | Yes      | —             | Access token signing secret (min 32 chars)                 |
| `JWT_REFRESH_SECRET`       | Yes      | —             | Refresh token signing secret (min 32 chars)                |
| `JWT_ACCESS_EXPIRES`       | No       | `15m`         | Access token expiry                                        |
| `JWT_REFRESH_EXPIRES_DAYS` | No       | `7`           | Refresh token expiry in days                               |
| `CLOUDINARY_CLOUD_NAME`    | No       | —             | Cloudinary cloud name                                      |
| `CLOUDINARY_API_KEY`       | No       | —             | Cloudinary API key                                         |
| `CLOUDINARY_API_SECRET`    | No       | —             | Cloudinary API secret                                      |
| `PROMPTPAY_ID`             | No       | —             | PromptPay ID for QR generation                             |

## Testing

```bash
# API tests (Vitest + Supertest)
cd apps/api && npm test

# Web tests (Vitest via Angular CLI)
cd apps/web && npx ng test --watch=false

# E2E tests (Playwright — starts dev servers automatically)
cd e2e && npm test
```

API and E2E tests require a running MySQL instance. The API test suite uses `NODE_ENV=test` which disables rate limiting. The E2E suite uses Playwright with Chromium and runs against seeded data.

## CI

GitHub Actions runs on push to `main` and on pull requests. Three jobs:

- **API:** lint, typecheck, build, and test against MySQL 8.0
- **Web:** lint, build, and test
- **E2E:** runs after API and Web pass; seeds the database, starts both servers, runs Playwright tests, and uploads the HTML report as a CI artifact

See `.github/workflows/ci.yml`.

## Documentation

Detailed project documentation is available in the `docs/` directory:

- `PRD.md` — Product requirements
- `ARCHITECTURE.md` — System architecture
- `DB_SCHEMA.md` — Database schema
- `API_SPEC.md` — API specification
- `SECURITY.md` — Security practices
- `TESTING.md` — Testing strategy
- `PHASES.md` — Implementation phases
