# PC Hub Architecture Document

## 1. Overview

PC Hub is a production-ready e-commerce web application for selling computer hardware. The system is designed with a modern customer-facing storefront and a secure role-based back office for staff and admins.

The architecture must support:

- clean architecture of concerns
- strict type safety
- maintainability
- secure authentication and authorization
- scalable catalog and order workflows
- production-friendly deployment

---

## 2. High-Level Architecture

The application uses a two-app repository structure:

- `apps/web` for the Angular frontend
- `apps/api` for the Express.js backend

The backend exposes a REST API consumed by the frontend.

External services:

- MySQL for relational data
- Cloudinary for image storage
- Docker Compose for local development database services

## 3. Recommmended Repository Structure

```text
/
  apps/
    web/
      src/
        app/
          core/
          shared/
          features/
          layouts/
        assets/
        environments/
      public/
      package.json
      angular.json
      tsconfig.json

    api/
      src/
        config/
        common/
        middleware/
        modules/
        routes/
        utils/
        app.ts
        server.ts
      prisma/
        schema.prisma
        seed.ts
      tests/
      package.json
      tsconfig.json

  docs/
    PRD.md
    ARCHITECTURE.md
    DB_SCHEMA.md
    API_SPEC.md
    SECURITY.md
    TESTING.md
    PHASES.md

  docker/
    mysql/
  docker-compose.yml
  README.md
  CLAUDE.md
```

## 4. Frontend Architecture

### 4.1 Frontend Principles

The frontend must:

- use Angular 21
- use standalone components
- use Tailwind CSS v4
- use typed reative forms
- use lazy-loaded feature routes
- separate public storefront and back office layouts
- keep services focused and reusable

### 4.2 Frontend Layers

```text
core/
```

Application-wide infrasturture:

- auth service
- route guards
- HTTP interceptors
- app config
- token/session utilities
- global error handling helpers

```text
shared/
```

Reusable building blocks:

- UI components
- pipes
- directives
- form helpers
- reusable models and constants

```text
features/
```

Business features split by domain:

- auth
- catalog
- cart
- checkout
- orders
- account
- admin
- staff

```text
layouts/
```

Shell layouts:

- storefront layout
- dashboard layout

### 4.3 Routing Strategy

Use route-based lazy loading.

Suggested route groups:

- /
- /products
- /products/:slug
- /cart
- /checkout
- /login
- /register
- /account/address
- /account/orders
- /account/orders/:id
- /backoffice
- /backoffice/orders
- /backoffice/products
- /backoffice/categories
- /backoffice/brands
- /backoffice/users
- /backoffice/reports
- /backoffice/analytics

### 4.4 Frontend State Strategy

Use Angular signals and focused services:

- local component state with signals
- shared feature state in services
- no external state library unless a real need emerges

### 4.5 Frontend Auth Strategy

- store access token in memory
- use refresh token flow for session continuity
- use HTTP interceptor to attach access token
- on expired access token, call refresh endpoint and retry request
- use route guards for authenticated and role-based routes

### 4.6 Frontend UX/UI Strategy

The storefront must feel premium and modern:

- refined spacing
- responsive product grids
- polished navigation
- strong typography hierarchy
- clear empty states
- trustworthy checkout experience

The back office must be:

- efficient
- readable
- role-aware
- easy to navigate for staff and admins

## 5. Backend Architecture

### 5.1 Backend Principles

The backend must:

- use Express.js 5
- use TypeScript
- keep controllers thin
- place business logic in services/use-cases
- validate external input with Zod
- centralize security and error handling
- use Prisma as the database access layer

### 5.2 backend Layers

```text
config/
```

Configuration and bootstrapping:

- environment validation
- database initialization
- Cloudinary configuration
- app configuration helpers

```text
common/
```

Shared cross-module utilities:

- response helpers
- error classes
- pagination helpers
- constants
- shared schemas where appropriate

```text
middleware/
```

Cross-cutting request processing:

- auth middleware
- role middleware
- validation middleware
- error handler
- rate limiting
- request logging
- upload restrictions
- secure headers
- CORS

```text
modules/
```

Feature modules grouped by domain:

- auth
- users
- addresses
- categories
- brands
- products
- carts
- orders
- payments
- reports
- dashboard

Each module should contain:

- controller
- service
- repository or direct Prisma access
- abstraction where useful
- route definitions
- zod schemas
- types/interfaces if needed

### 5.3 Request Flow

Typical request lifecycle:

- request enters Express app
- security middleware runs
- request logging runs
- validation middleware parses inputs
- auth middleware resolves user if needed
- role middleware enforces access
- controller calls service
- service performs business logic and database operations
- response is returned in a consistent shape
- errors are handled by a global error handler

### 5.4 Response Strategy

Use consistent JSON responses.

Typical success structure:

- success
- message
- data
- pagination if relevant
  Typical error structure:
- success
- message
- error code
- validation details when safe and appropriate

## 6. Module Boundaries

### 6.1 Auth Module

Responsibilities:

- register
- login
- refresh
- logout
- password hashing
- token issuance and revocation

### 6.2 User and Address Modules

Responsibilities:

- user profule access where needed
- address CRUD for customers
- privileged user management for admins

### 6.3 Catalog Modules

Responsibilities:

- categories
- brands
- products
- product images
- visibility state
- warranty data

### 6.4 Cart Module

Responsibilities:

- current cart retrieval
- add/remove/update cart items
- clear cart
- stock-aware cart validation

### 6.5 Order Module

Responsibilities:

- create order
- order history
- order detail
- order status tracking
- stock validation and reservation/decrement logic

### 6.6 Payment Module

Responsibilities:

- COD flow handling
- PromptPay QR flow
- payment record handling
- payment slip upload/review
- payment approval/rejection

### 6.7 Report and Dashboard Modules

Responsibilities:

- daily sales reports
- admin analytics
- export Excel
- export PDF

## 7. Authentication and Session Architecture

### 7.1 Token Strategy

- short-lived access token
- longer-lived refresh token
- refresh token rotation
- server-side revocation support

### 7.2 Access Token

Contains only required claims such as:

- user id
- role
- email if needed

Used for:

- authenticated API calls
- route authorization context

### 7.3 Refresh Token

Used to:

- obtain a new access token
- keep users signed in without repeated login

Must support:

- secure storage
- server-side invalidation
- rotation and replay protection strategy

### Logout

Logout must:

- invalidate or revoke the refresh token record server-side
- clear refresh token transport from the client
- ensure future refresh attempts fail

## 8. File Upload Architecture

### 8.1 Upload Use Cases

Uploads are needed for:

- product images
- brand images or logos of used
- PromptPay payment slips

### 8.2 Upload Flow

1. client submits file
2. backend validates file type and size
3. backend uploads to Cloudinary
4. backend stores returned asset referrence in database
5. backend returns safe metadata to frontend

### 8.3 Upload Rules

- accept only approved MIME types
- set size limits
- reject unexcepted file types
- separate product image flow payment slip flow conceptually
- ensure only authorized users can upload payment slips to their own orders

## 9. Reporting Architecture

### 9.1 Staff Reports

Staff can access:

- daily sales summary
- export to Excel
- export to PDF

### 9.2 Admin Analytics

Admins can access:

- total revenue summaries
- order status distribution
- top-selling products
- category performance
- recent order trends

### 9.3 Report Generation Strategy

- query data from relational tables
- aggregate on the backend
- generate Excel and PDF files on demand
- keep report generation behind authenticated privileged routes

## 10. Deployment Overview

### 10.1 Local Development

Use Docker Compose for:

- MySQL
- optional admin DB UI if needed later

Frontend:

- Angular dev server

Backend:

- Node.js runtime with watch mode

### 10.2 Production Deployment

Preferred targets: **Vercel** (frontend) and **Railway** (API + MySQL).

Frontend:

- build static Angular assets
- deploy to Vercel (or any static hosting with rewrite/proxy support)

Backend:

- build TypeScript to JavaScript
- deploy to Railway (or any Node.js hosting platform)
- use environment variables for secrets and config

Database:

- Railway-managed MySQL or any managed MySQL provider

Images:

- Cloudinary

A self-hosted Docker Compose stack is available in `docker/` as an optional fallback.

### 10.3 Configuration Strategy

All environment variables must be validated at startup.
The backend must fail fast on invalid or missing required configuration.

## 11. Scalability and Maintainability Notes

- use pagination for list endpoints
- keep modules independent
- avoid cross-module hidden couping
- store order snapshots so historical orders remain accurate
- design statuses and enums carefully to support future reporting
- prefer explicit contracts over implicit behavior

## 12. Architecture Decisions to Preserve

The following decisions should remain stable unless a strong reason appears:

- repository split into apps/web and apps/api
- Angular standalone architecture
- Express module-based backend structure
- Prisma as the ORM and DB access layer
- Zod as the validation layer
- Cloudinary for image storage
- strict role separation across customer, staff, and admin
