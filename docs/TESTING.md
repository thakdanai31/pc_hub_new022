# PC Hub Testing Strategy

## 1. Overview

This document defines the testing strategy for PC Hub.

The goal is to ensure that the application is not only functional, but also reliable, maintainable, and safe for production use. Testing must cover critical business flows, security-sensitive logic, integration boundaries, and role-based access behavior.

Testing principles:
- test important behavior, not fake coverage
- prioritize critical user and business flows
- keep tests maintainable and meaningful
- verify both happy paths and failure paths
- keep the application runnable after each implementation phase

---

## 2. Testing Goals

The testing strategy must ensure that:
- authentication works correctly
- session refresh and logout flows work correctly
- role-based authorization is enforced
- customers can browse, add to cart, checkout, and track orders
- PromptPay QR and slip upload workflows behave correctly
- staff/admin approval and rejection workflows behave correctly
- catalog and inventory behavior is correct
- report generation works for allowed users
- validation rules reject unsafe or malformed input
- major regressions are detected early

---

## 3. Testing Scope

The project should include tests for:
- backend unit logic
- backend integration flows
- API validation behavior
- authentication and authorization
- order and payment flows
- frontend critical component behavior
- frontend route guard and interceptor behavior
- end-to-end critical business journeys

---

## 4. Testing Levels

## 4.1 Unit Tests
Unit tests verify isolated logic.

Recommended targets:
- backend services
- utility helpers
- validation schema helpers where appropriate
- order status transition logic
- payment decision logic
- stock calculation logic
- frontend pure helpers
- frontend services with isolated logic
- route guards
- interceptors

Unit tests should:
- run fast
- avoid real external services
- focus on deterministic behavior

## 4.2 Integration Tests
Integration tests verify collaboration between multiple application layers.

Recommended backend integration targets:
- request → validation → controller → service → database
- auth and session flows
- address CRUD
- cart flows
- checkout flows
- order creation
- payment slip upload flow
- approval/rejection flows
- reporting endpoints

Integration tests should:
- hit real API routes
- use a test database
- verify database side effects
- verify status transitions and access restrictions

## 4.3 End-to-End Tests
End-to-end tests verify complete user workflows across the frontend and backend.

Critical flows to cover:
- customer registration and login
- product browsing and detail view
- add to cart and update cart
- buy now checkout
- cart checkout
- PromptPay QR order and slip upload
- staff review and approval
- admin catalog management
- daily report export flow if practical

E2E tests should focus on high-value business flows, not every minor UI detail.

---

## 5. Suggested Tooling

Final tooling may be refined during implementation, but the intended direction is:

### Backend
- test runner: Vitest
- API integration testing: Supertest

### Frontend
- Angular-supported unit/component testing setup
- Playwright for end-to-end browser testing in later phases

### Database Testing
- dedicated test MySQL database
- migrations applied before integration test runs
- controlled test seed data

---

## 6. Backend Testing Strategy

## 6.1 What to Unit Test
Unit test the business logic that has clear rules and branching.

Examples:
- password hashing/verification helpers
- token payload creation helpers
- order status transition rules
- payment approval/rejection logic
- stock validation logic
- cart quantity update rules
- report aggregation helpers
- date/filter utility helpers

## 6.2 What to Integration Test
Integration tests should verify real route behavior.

Must-cover backend integration areas:
- register
- login
- refresh
- logout
- current session lookup
- address CRUD
- category/brand/product list and detail behavior
- admin product/category management
- cart item add/update/remove/clear
- buy-now checkout
- cart checkout
- order listing and detail access
- payment slip upload
- staff/admin order approval and rejection
- report export access rules

## 6.3 What to Assert in Backend Tests
Backend tests should verify:
- expected HTTP status codes
- expected response shape
- correct database writes
- correct database updates
- rejection of invalid inputs
- rejection of unauthorized actions
- rejection of forbidden actions
- correct transaction outcomes
- correct stock changes
- correct stock restoration where applicable

---

## 7. Frontend Testing Strategy

## 7.1 Frontend Unit / Component Tests
Focus on:
- route guards
- auth state handling
- token refresh behavior in interceptors
- cart UI logic
- checkout form behavior
- validation feedback behavior
- role-based layout visibility where appropriate

Recommended component/service targets:
- auth service
- cart service
- checkout service
- order listing service
- route guards
- HTTP interceptor behavior
- important form components
- reusable UI components with meaningful logic

## 7.2 Frontend Behavioral Expectations
Frontend tests should confirm:
- protected routes require auth
- role-restricted routes block unauthorized users
- invalid form input shows correct validation feedback
- cart totals render correctly
- checkout cannot continue with missing required fields
- upload UI follows allowed workflow
- loading and error states are handled cleanly

---

## 8. End-to-End Testing Strategy

End-to-end tests should prioritize critical user journeys.

## 8.1 Customer Critical Flows
- register a new account
- log in successfully
- browse products
- filter/search catalog
- view product detail
- add product to cart
- update quantity
- remove item
- use buy-now flow
- create/select shipping address
- place COD order
- place PromptPay QR order
- upload payment slip
- view order history
- view order detail and status

## 8.2 Staff Critical Flows
- log in as staff
- access back office
- view reviewable orders
- approve a valid payment/order step
- reject with reason when appropriate
- view daily sales summary
- export report

## 8.3 Admin Critical Flows
- log in as admin
- access admin-only dashboard
- create category
- create brand
- create product
- upload product image
- update product
- manage staff/admin user as allowed

---

## 9. Validation Testing

Validation must be tested intentionally.

## 9.1 Input Validation Cases
Test invalid cases such as:
- missing required fields
- invalid email format
- weak or malformed password payload shape
- invalid enum values
- negative or zero quantity where not allowed
- invalid pagination values
- invalid date filters
- invalid address payload shape
- invalid file upload type
- oversized upload

## 9.2 Validation Expectations
Tests should confirm:
- invalid input is rejected
- API returns safe error messages
- invalid data is not written to the database
- unexpected fields are handled according to policy

---

## 10. Authentication and Authorization Testing

## 10.1 Authentication Cases
Test:
- valid register
- duplicate email register failure
- valid login
- invalid login
- refresh with valid token
- refresh with revoked token
- refresh with expired token
- logout invalidates refresh flow
- disabled user cannot continue session flow

## 10.2 Authorization Cases
Test:
- customer cannot access staff/admin routes
- staff cannot access admin-only routes
- customer cannot access another customer's address
- customer cannot access another customer's order
- customer cannot upload slip for another customer's order
- staff can access staff routes
- admin can access staff and admin routes

---

## 11. Catalog and Inventory Testing

Test important catalog rules:
- inactive products do not appear in public purchase flows
- inactive categories/brands behave correctly in storefront queries
- admin can create/update/delete as allowed
- staff can toggle active state only
- stock cannot go below zero
- checkout fails when stock is insufficient
- concurrent order-related stock behavior is handled safely as far as practical in integration tests

---

## 12. Order and Payment Testing

This is one of the most critical areas.

## 12.1 Order Flow Cases
Test:
- create COD order successfully
- create PromptPay QR order successfully
- create buy-now order successfully
- order uses address snapshot
- order uses product snapshot
- order totals are stored correctly
- invalid order state transitions are rejected

## 12.2 Payment Flow Cases
Test:
- PromptPay order enters expected initial payment state
- payment slip upload changes payment/order state correctly
- staff/admin can approve reviewable payment flow
- rejection stores reason where required
- stock handling remains correct after rejection/cancellation according to business rules

---

## 13. Reporting Testing

Reporting tests should verify:
- staff can access daily sales summary
- admin can access analytics endpoints
- unauthorized users are blocked
- filters behave correctly
- exports return expected file responses
- export route failures fail safely

---

## 14. Test Data Strategy

## 14.1 Seed Data
Maintain controlled seed data for development and testing.

Recommended seed groups:
- sample categories
- sample brands
- sample products
- one customer
- one staff
- one admin
- a few carts and orders for reporting scenarios

## 14.2 Test Fixtures
Use explicit test fixtures or factories where appropriate.

Goals:
- keep tests readable
- avoid repetitive manual setup
- make status-driven scenarios easier to create

## 14.3 Isolation
Tests should be isolated from one another as much as practical.

Recommended strategies:
- reset database state between integration test groups
- use transactions/cleanup helpers if appropriate
- avoid hidden cross-test dependencies

---

## 15. Environments for Testing

## 15.1 Local Development Testing
Developers should be able to run:
- unit tests
- integration tests
- lint
- build

## 15.2 CI Testing
Continuous integration should run at least:
- lint
- build
- backend unit tests
- backend integration tests
- relevant frontend tests

E2E tests may run in a separate pipeline stage if needed.

---

## 16. Phase-Based Testing Expectations

## Phase 1
Must verify:
- frontend builds
- backend builds
- lint passes
- health endpoints work
- environment validation works

## Phase 2
Must verify:
- register/login/refresh/logout flows
- route protection
- address CRUD access control

## Phase 3
Must verify:
- catalog list/detail behavior
- admin CRUD behavior
- staff active/inactive toggles

## Phase 4
Must verify:
- cart flows
- buy-now flow
- checkout validation

## Phase 5
Must verify:
- order creation
- PromptPay QR flow
- slip upload
- approval/rejection logic
- customer order tracking

## Phase 6
Must verify:
- report endpoints
- analytics endpoints
- export behavior
- role restrictions

## Phase 7
Must verify:
- regression coverage
- security-sensitive flows
- deployment readiness checks

---

## 17. Non-Goals of Testing

The testing strategy should avoid:
- fake tests written only for coverage numbers
- brittle UI tests for minor styling details
- excessive mocking that hides real integration failures
- duplicate tests that provide no additional confidence

---

## 18. Definition of Done for Testing

A feature is not done unless:
- important business behavior is tested
- failure paths are considered
- role and ownership rules are verified
- validation behavior is verified where relevant
- build and lint pass
- relevant test suites pass