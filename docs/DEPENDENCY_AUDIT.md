# Dependency Audit — 2026-03-16

## Summary

Phase 7D dependency audit completed. No `any`, `unknown` escape hatches, `@ts-ignore`, or `@ts-expect-error` found in production code. All npm audit advisories are in transitive dev-tool dependency chains with no runtime exposure.

## npm audit — API (apps/api)

9 advisories (5 moderate, 4 high). All trace to two transitive chains:

| Package | Severity | Chain | Runtime exposure |
|---------|----------|-------|-----------------|
| `hono` <=4.12.6 | high | `prisma` → `@prisma/dev` → `hono` | None — Prisma CLI internal |
| `@hono/node-server` <1.19.10 | high | `prisma` → `@prisma/dev` → `@hono/node-server` | None — Prisma CLI internal |
| `lodash` 4.x | moderate | `prisma` → `@prisma/dev` → `chevrotain` → `lodash` | None — Prisma schema parser |
| `lodash` 4.x | moderate | `cloudinary` → `lodash` | Indirect — Cloudinary internal use only; we do not call `_.unset`/`_.omit` |
| `chevrotain` 10.x | moderate | `prisma` → `@prisma/dev` → `@mrleebo/prisma-ast` → `chevrotain` | None — dev tooling |

**Resolution:** Not fixable without downgrading Prisma from v7 to v6 (`npm audit fix --force`), which is a breaking change. No non-breaking fixes available. These vulnerabilities do not affect our application runtime — `hono`, `@hono/node-server`, and `chevrotain` are never imported by our code; `lodash` prototype pollution requires calling `_.unset`/`_.omit` which we never do.

**Action:** Monitor for upstream Prisma v7 patch that updates `@prisma/dev` dependencies.

## npm audit — Web (apps/web)

2 high-severity advisories in the same `prisma`/`hono` chain (shared monorepo tooling). Same assessment: no runtime exposure, no non-breaking fix available.

## TypeScript quality sweep

| Check | Result |
|-------|--------|
| `any` in production code | 0 occurrences |
| `@ts-ignore` | 0 occurrences |
| `@ts-expect-error` | 0 occurrences |
| `unknown` escape hatches | 0 — all 13 `unknown` uses are justified (type guards, Angular generics, dynamic query builders) |
| `strict: true` | Enabled in both tsconfig files |
| `noImplicitAny` | Implied by `strict: true` |

## Dependency hygiene fix

- Moved `@types/multer` and `@types/pdfkit` from `dependencies` to `devDependencies` in `apps/api/package.json` (type-only packages, not needed at runtime).

## Verified dependencies

All production dependencies in both apps are actively imported and used. `@prisma/adapter-mariadb` is used in `apps/api/src/config/database.ts` for the MySQL connection adapter.
