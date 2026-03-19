# Implementation Phases

## Phase 1
Project foundation and scaffolding
- Repository structure with `apps/web` and `apps/api`
- Angular 21 frontend setup
- Express.js 5 backend setup
- TypeScript setup
- MySQL with Docker Compose
- Prisma setup
- Tailwind CSS v4 setup
- Base lint/build/test configuration
- Environment validation with Zod
- Basic security middleware
- Global error handling
- Request logging
- Health and readiness checks
- Initial README and run scripts

## Phase 2
Authentication, sessions, and customer account
- Register
- Login
- Access token
- Refresh token
- Refresh token rotation and revocation
- Logout
- Current session / me endpoint
- Role-based authorization
- Frontend auth guards and interceptor
- Address management

## Phase 3
Catalog and storefront browsing
- Categories
- Brands
- Products
- Product images
- Warranty
- Public product listing
- Product detail page
- Search, filter, and pagination
- Admin catalog CRUD
- Staff active/inactive toggle

## Phase 4
Shopping flow
- Cart
- Cart items
- Buy now
- Checkout
- Address selection
- Order summary
- Stock validation
- Cart clearing / post-checkout behavior

## Phase 5
Payments and orders
- Order creation
- Payment entity and payment statuses
- COD flow
- PromptPay QR flow
- PromptPay QR generation
- Slip upload
- Payment review / approve / reject
- Order review / approve / reject
- Customer order history
- Customer order tracking
- Stock decrement and stock restoration rules

## Phase 6
Back office and reports
- Back office layout and protected routes
- Staff dashboard
- Admin dashboard
- Staff daily sales
- Admin analytics dashboard
- Report filters
- Export Excel
- Export PDF
- Privileged user management for admin

## Phase 7
Hardening and production readiness
- Security review
- Testing expansion
- Performance cleanup
- Logging and auditability review
- Dependency audit
- CI pipeline
- Deployment readiness