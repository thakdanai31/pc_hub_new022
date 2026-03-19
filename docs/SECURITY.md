# PC Hub Security Document

## 1. Overview

This document defines the security expectations and baseline security architecture for PC Hub.

The project must be designed for real-world production use with strong practical security, not only functional correctness. Security decisions must reduce risk across authentication, authorization, input validation, file uploads, data handling, reporting, and privileged back office operations.

Security goals:
- protect user accounts and sessions
- prevent unauthorized access
- reduce common web application risks
- protect sensitive business and payment-related data
- support auditable privileged actions
- align implementation with OWASP Top 10-aware practices

---

## 2. Security Principles

The project must follow these principles:

- never trust client input
- validate all external input
- enforce authorization on the backend
- minimize attack surface
- store only necessary sensitive data
- fail safely without exposing internals
- prefer least privilege
- protect session lifecycle carefully
- log sensitive actions appropriately
- keep security controls maintainable and explicit

---

## 3. Authentication Security

## 3.1 Password Handling
Passwords must be handled securely at all times.

Requirements:
- hash passwords using `bcryptjs`
- never store plain text passwords
- never log raw passwords
- never return password-related data in API responses
- apply password verification through bcrypt comparison only

Recommended implementation notes:
- store the result in a field such as `passwordHash`
- use a reasonable bcrypt cost factor for current production conditions
- centralize password hashing and comparison logic in the auth service

## 3.2 Access Token
Access tokens are used for authenticated API access.

Requirements:
- access tokens must be short-lived
- access tokens must contain only minimal necessary claims
- access tokens must not include sensitive internal data
- access tokens must be signed with a strong server-side secret

Recommended claims:
- user id
- role
- email if required
- token version or session metadata only if needed

## 3.3 Refresh Token
Refresh tokens are used for long-lived session continuity.

Requirements:
- refresh tokens must live longer than access tokens
- refresh tokens must support server-side revocation
- refresh tokens must be rotated on refresh
- refresh tokens must not be stored in plain text in the database
- hashed refresh token values must be stored server-side

Recommended behavior:
- issue a new refresh token during each successful refresh
- revoke or replace the previous refresh token record
- reject replayed or revoked refresh tokens

## 3.4 Session Revocation
Logout and session invalidation must be reliable.

Requirements:
- logout must revoke the active refresh token
- refresh flow must invalidate superseded refresh tokens
- disabled users must not be able to continue refreshing sessions
- suspicious token reuse should invalidate the affected session chain if practical

---

## 4. Token Transport and Storage Strategy

## 4.1 Access Token Storage
Recommended strategy:
- keep access token in memory on the frontend
- avoid persisting access tokens in long-term browser storage unless a justified design requires it

Reason:
- reduces exposure to persistent client-side token theft scenarios

## 4.2 Refresh Token Transport
Recommended strategy:
- transport refresh token using an HTTP-only cookie
- set secure cookie flags in production
- use appropriate same-site behavior according to deployment architecture

Cookie expectations in production:
- HttpOnly
- Secure
- SameSite configured intentionally
- limited path if useful

## 4.3 Refresh Endpoint Security
The refresh endpoint must:
- validate refresh token presence and integrity
- verify token hash against server-side records
- check expiry and revocation state
- rotate token on success
- return a new access token only after successful verification

---

## 5. Authorization Security

## 5.1 Backend Authorization
Authorization must always be enforced on the backend.

Requirements:
- do not rely on frontend guards for real security
- all protected routes must verify the authenticated user
- privileged routes must verify role-based permissions
- resource ownership must be enforced for customer-scoped resources

Examples:
- customers may only view their own orders
- customers may only edit their own addresses
- customers may only upload slips for eligible orders they own
- staff may review orders but cannot manage privileged users
- admins may manage privileged users and full catalog data

## 5.2 Role Model
Roles:
- CUSTOMER
- STAFF
- ADMIN

Access expectations:
- CUSTOMER routes require authenticated customer ownership context
- STAFF routes allow staff and admin
- ADMIN routes allow admin only

## 5.3 Resource Ownership Checks
Ownership checks must be explicit in business logic and route handling.

Resources requiring ownership enforcement include:
- addresses
- cart
- cart items
- orders
- payment slips
- customer order payment detail views

---

## 6. Input Validation

## 6.1 Zod Validation Requirement
Zod must be used to validate all important external input.

Required validation targets:
- request bodies
- query parameters
- route parameters
- authentication payloads
- reporting filters
- environment variables
- upload metadata where applicable

## 6.2 Validation Rules
Validation must ensure:
- correct data type
- required fields exist
- enum values are allowed
- strings have safe length limits
- emails are well-formed
- numbers are within allowed ranges
- pagination values are bounded
- IDs are in expected format
- unexpected or dangerous input is rejected when appropriate

## 6.3 Validation Placement
Validation should occur before business logic execution.

Recommended pattern:
- parse input via dedicated Zod schemas
- reject invalid input early
- pass only validated data into services

---

## 7. File Upload Security

## 7.1 Upload Use Cases
The initial version supports uploads for:
- product images
- brand images if used
- PromptPay payment slips

## 7.2 Upload Rules
All uploads must follow strict rules:
- allow only approved MIME types
- enforce file size limits
- reject unknown or suspicious file types
- do not trust filename extension alone
- process uploads through backend-controlled flow
- store only safe returned metadata in the database

## 7.3 Payment Slip Upload Security
Payment slip uploads are sensitive because they affect payment review.

Requirements:
- only authenticated customers may upload slips
- customers may upload slips only for their own eligible orders
- slip uploads must be linked to payment records
- staff/admin must be able to review slips
- rejection reasons must be stored safely when used
- upload attempts on invalid order states must fail safely

## 7.4 Cloudinary Security
Cloudinary integration must follow safe practices:
- upload through the backend
- keep Cloudinary credentials in environment variables
- never expose secret credentials to the client
- store returned public IDs for deletion/replacement flows
- restrict transformation and upload behavior intentionally

---

## 8. API Security Controls

## 8.1 Rate Limiting
Rate limiting must be applied to sensitive routes.

At minimum, protect:
- register
- login
- refresh
- logout if appropriate
- password-related flows if later added
- payment slip upload
- privileged back office actions
- report export routes if abuse risk exists

Goals:
- reduce brute-force attempts
- reduce credential stuffing risk
- reduce abuse of expensive operations

## 8.2 Security Headers
Use security headers middleware such as Helmet or equivalent.

Security header goals:
- reduce clickjacking risk
- reduce unsafe framing
- reduce MIME sniffing risks
- improve browser-side security defaults

## 8.3 CORS
CORS must be explicitly configured.

Requirements:
- allow only approved origins
- avoid permissive wildcard origin in production
- configure credentials intentionally based on cookie/token transport
- separate development and production origin policy

---

## 9. Error Handling Security

## 9.1 Global Error Handler
A centralized error handler must be used.

Requirements:
- normalize application error responses
- avoid leaking stack traces in production
- avoid exposing internal database details
- avoid revealing secret configuration or library internals

## 9.2 Safe Error Messages
Client-facing error messages should be:
- clear enough for the user
- not overly detailed
- not useful for attackers

Examples:
- login failure should not reveal whether email or password was incorrect in overly specific ways
- authorization failure should not leak internal route policy details
- upload failure should not expose internal storage configuration

---

## 10. Logging and Auditability

## 10.1 Request Logging
The backend should log requests in a structured way.

Requirements:
- avoid logging raw passwords
- avoid logging full tokens
- avoid logging highly sensitive personal data unless necessary
- sanitize or omit sensitive headers and fields

## 10.2 Audit Logging
Audit logging is recommended for privileged and security-sensitive actions.

Events to audit:
- admin creation of staff/admin accounts
- changes to privileged users
- product/category/brand active state toggles
- product creation, update, and deletion
- order approval or rejection
- payment approval or rejection
- report exports if business policy requires tracking

Audit fields may include:
- actor user id
- action
- entity type
- entity id
- timestamp
- safe metadata

---

## 11. Database Security

## 11.1 Query Safety
Database access should use Prisma safely.

Requirements:
- prefer Prisma ORM query APIs
- avoid raw SQL unless absolutely necessary
- if raw SQL is required, parameterize it safely
- never build raw SQL from unsanitized user input

## 11.2 Data Protection
Sensitive data must be minimized and protected.

Requirements:
- store password hashes only
- store hashed refresh tokens only
- store only necessary payment-related metadata
- avoid unnecessary duplication of sensitive user information outside justified snapshots

## 11.3 Privilege Control
Database credentials used by the application should follow least privilege where feasible.

---

## 12. Transaction and Consistency Security

Sensitive business actions must be transactionally safe.

Required areas:
- checkout
- order creation
- stock decrement
- stock restoration on rejection/cancellation
- payment review state updates where consistency matters

Goals:
- prevent overselling
- prevent inconsistent order/payment state
- prevent partial writes that break business logic

---

## 13. OWASP Top 10 Considerations

## 13.1 Broken Access Control
Mitigation:
- backend role checks
- ownership checks
- explicit route protection
- no trust in frontend-only checks

## 13.2 Cryptographic Failures
Mitigation:
- bcrypt password hashing
- strong token secrets
- secure production transport
- minimal exposure of sensitive data

## 13.3 Injection
Mitigation:
- Zod validation
- safe Prisma usage
- careful handling of search/filter input
- no unsafe raw query construction

## 13.4 Insecure Design
Mitigation:
- documented workflows
- documented role permissions
- documented payment review process
- explicit architecture and security decisions

## 13.5 Security Misconfiguration
Mitigation:
- validated environment variables
- explicit CORS policy
- secure headers
- production-safe defaults
- no development stack traces in production

## 13.6 Vulnerable and Outdated Components
Mitigation:
- keep dependencies reasonably current
- avoid unnecessary packages
- review package choices before adoption

## 13.7 Identification and Authentication Failures
Mitigation:
- secure login flow
- refresh token rotation
- server-side revocation
- rate limiting on auth endpoints

## 13.8 Software and Data Integrity Failures
Mitigation:
- controlled deployment process
- dependency review
- careful upload handling
- no blind trust in client-submitted data

## 13.9 Security Logging and Monitoring Failures
Mitigation:
- structured request logging
- audit logging for sensitive actions
- clear operational review points

## 13.10 Server-Side Request Forgery
Mitigation:
- avoid arbitrary outbound fetches from user-supplied URLs
- restrict external service integrations to controlled configurations

---

## 14. Environment Security

All important environment variables must be validated at startup with Zod.

Examples:
- database connection settings
- JWT secrets
- refresh token secret if separate
- Cloudinary credentials
- frontend origin
- API port
- runtime mode

Behavior:
- fail fast on missing required values
- fail fast on invalid formats
- do not continue startup with partial invalid config

---

## 15. Frontend Security Notes

The frontend must support security but must not be treated as the primary enforcement layer.

Requirements:
- do not rely on frontend checks as true authorization
- handle expired sessions safely
- avoid exposing internal admin/staff functions to unauthorized users
- render user-facing content safely
- keep access token handling minimal and controlled

---

## 16. Back Office Security Notes

The back office handles privileged actions and must be protected carefully.

Requirements:
- require authenticated privileged access
- enforce role checks for staff/admin boundaries
- protect report export routes
- audit sensitive approval/rejection actions
- prevent staff from performing admin-only actions
- ensure admin user management routes are tightly restricted

---

## 17. Production Security Checklist

Before production release, confirm:
- HTTPS is enabled
- production cookie security settings are correct
- production CORS origins are correct
- JWT secrets are strong and private
- Cloudinary credentials are private
- rate limiting is enabled
- secure headers are enabled
- environment validation is active
- debug-only behavior is disabled
- logs do not expose secrets
- build, lint, and relevant tests pass

---

## 18. Security Definition of Done

A feature is not done unless:
- inputs are validated
- authorization is enforced
- errors fail safely
- sensitive actions are logged appropriately
- relevant OWASP-related risks have been considered
- no major security shortcuts were introduced