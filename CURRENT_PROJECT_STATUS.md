# Current Project Status

## Purpose

This file is a short handoff summary for future work. It is not the source of truth over the codebase. If this file and the repository differ, trust the repository state first.

## Project Overview

PC Hub is a full-stack e-commerce system for selling computer hardware.

- Frontend: Angular standalone app in `apps/web`
- Backend: Express 5 + TypeScript in `apps/api`
- Database: MySQL with Prisma
- Roles: `CUSTOMER`, `STAFF`, `ADMIN`

## Core Architecture

### Backend

The backend follows the existing pattern:

- routes -> controllers -> services -> Prisma
- Zod validation at request boundaries
- JWT access token + refresh token auth
- role-based authorization middleware
- audit logging for important privileged actions

### Frontend

The frontend follows the existing pattern:

- Angular standalone components
- signals for local state
- shared layout shells for storefront and backoffice
- shared UI primitives for alerts, badges, empty states, pagination, dialogs, and headers

## Major Features Already Implemented

### Auth and Account

- customer registration and login
- refresh-token auth flow
- unique email and unique phone-number registration
- minimal phone normalization before uniqueness checks
- forgot-password / reset-password flow
- password reset tokens stored as hashes
- token expiry and single-use reset behavior
- password reset email delivery wired for Brevo SMTP

### Orders and Payments

- cart, checkout, buy-now, and order creation
- COD and PromptPay QR flows
- payment slip upload and review flow
- customer order history and order detail pages
- order cancellation metadata separated from rejection metadata

### Claims

- backend claim system for purchased delivered products
- customer claim create/history/detail flow in storefront
- backoffice claim list/detail/status/admin-note flow
- hardened claim status transition rules
- duplicate active-claim protection

### Inventory

- manual inventory management in backoffice
- restock
- adjust-in
- adjust-out
- inventory transaction history
- per-product inventory history view
- order-driven stock deduction when an order first enters the committed processing state
- stock restoration on committed-order cancellation

### Inventory Reconciliation

- admin-only reconciliation report endpoint
- dry-run-first backfill flow
- missing `SALE` / `RETURN_IN` detection
- manual-review-only handling for ambiguous cases
- backoffice reconciliation UI

### User Management

- backoffice user list and edit flow
- customer accounts included in admin user management
- admin-only soft ban / unban
- temporary ban support with:
  - `bannedUntil`
  - `banReason`
  - `bannedAt`
  - `bannedByUserId`
- automatic temporary-ban expiry during auth checks

### Backoffice UI

- dashboard summary and alerts
- claims management UI
- inventory management UI
- inventory reconciliation UI
- user management UI

### Localization

Frontend bilingual support is already in place for the scoped pages that were implemented:

- shared navigation/layout text
- auth pages
- storefront order and claim pages
- backoffice dashboard, users, claims, and inventory pages

Language switching supports Thai and English and persists across refreshes.

## Important Database / Schema Additions Already Present

The Prisma schema already includes support for these later additions:

- `Claim`
- `InventoryTransaction`
- `PasswordResetToken`
- order cancellation metadata
- user temporary-ban metadata

There are committed migrations for these areas. Production deployment should use migration history, not ad hoc schema pushes.

## Frontend Areas Already Present

### Storefront

- auth pages
- product browsing
- cart and checkout
- order history and detail
- customer claims

### Backoffice

- dashboard
- users
- orders
- claims
- inventory
- reconciliation
- other catalog/admin areas from earlier phases

## Operational Notes

### Deployment

The project is set up around:

- frontend deployment to Vercel
- backend + MySQL deployment to Railway
- optional Docker-based self-hosted flow

### Password Reset Email

The password reset flow now expects proper Brevo SMTP configuration in production.

Required production variables:

- `APP_WEB_URL`
- `MAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

Brevo-specific notes:

- `SMTP_HOST=smtp-relay.brevo.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER` must be the real Brevo SMTP login
- `SMTP_PASS` must be the Brevo SMTP key, not the REST API key

### Migration Safety

If deploying to an existing non-empty database that predates the current Prisma migration history, baseline it carefully first. Do not blindly run migration commands against an old production database without checking migration state.

## Testing and Verification State

The repository already has:

- API integration tests
- frontend unit/spec coverage on important pages and flows
- Playwright E2E coverage

Common root scripts:

- `npm run build:all`
- `npm run lint:all`
- `npm run test:all`
- `npm run test:e2e`

## Important Current Caveats

- Existing handoff documents may be older than the current repository state.
- The repository state should be treated as the source of truth.
- Some lower-priority pages outside the translated scope may still remain English-first.
- Password reset email delivery depends on valid Brevo SMTP credentials and a verified sender.
- Deployment readiness depends on correct Prisma migration handling and environment setup.

## Recommended Starting Point For The Next Round

Before making more changes later:

1. Check `git status`
2. Read `README.md`
3. Read `CLAUDE.md`
4. Trust the current repository state over older handoff notes
5. Re-run only the relevant build, lint, and tests for the area being changed

## Quick File Pointers

- Backend entry: `apps/api/src/app.ts`
- Prisma schema: `apps/api/prisma/schema.prisma`
- Frontend routes: `apps/web/src/app/app.routes.ts`
- Shared storefront layout: `apps/web/src/app/layouts/storefront`
- Shared backoffice layout: `apps/web/src/app/layouts/backoffice`
- Root docs: `README.md`, `CLAUDE.md`, `docs/`
