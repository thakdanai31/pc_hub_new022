# PC Hub Product Requirements Document (PRD)

## 1. Product Overview

PC Hub is a production-ready e-commerce web application for selling computer hardware and accessories. The platform is designed for real-world use, with a modern storefront for customers and a secure back office for staff and administrators.

The system supports the sale of products such as CPUs, GPUs, RAM, mainboards, PSUs, SSDs, HDDs, cases, and monitors. Customers can browse products, manage carts, purchase items, upload payment slips for PromptPay QR payments, and track their orders. Staff and admins can review orders, manage catalog visibility, and handle reporting and dashboard operations according to role permissions.

---

## 2. Product Goals

### Primary Goals
- Build a real-world, medium-to-large, production-ready e-commerce platform.
- Deliver a modern, premium-quality user experience for customers.
- Support secure authentication and session management.
- Support role-based back office operations for staff and admins.
- Provide reliable checkout and order management workflows.
- Support both Cash on Delivery (COD) and PromptPay QR payment flows.
- Support payment slip upload and manual review for PromptPay orders.
- Maintain strong security practices aligned with OWASP Top 10 awareness.
- Ensure maintainable architecture, strict typing, and high code quality.

### Secondary Goals
- Provide daily sales reporting for staff.
- Provide deeper analytics and dashboard insights for admins.
- Enable export of reports in Excel and PDF formats.
- Keep the application deployable and production-ready at all times.

---

## 3. Target Users

### 3.1 Customers
Customers visit the storefront to browse products, manage their cart, place orders, pay using available payment methods, and track their own orders.

### 3.2 Staff
Staff users access the back office to review customer orders, approve or reject payment-related submissions, manage visibility status of products and categories, view daily sales summaries, and export reports.

### 3.3 Admins
Admins have full access to the system, including catalog management, user management, advanced dashboard insights, and all staff capabilities.

---

## 4. User Roles and Permissions

## 4.1 Customer
A customer can:
- Register an account
- Log in with email and password
- Stay signed in through access token and refresh token flows
- Browse products
- Filter/search products
- View product details
- Add products to cart
- Update cart quantities
- Remove items from cart
- Clear the cart
- Buy a single product directly without using the cart
- Add and manage shipping addresses
- Place orders
- Choose a payment method
- Upload a payment slip for PromptPay QR payments
- View and track their own orders

A customer cannot:
- Access back office pages
- Manage other users
- Manage product or category records
- Approve or reject orders

## 4.2 Staff
A staff user can:
- Access the back office
- View products and categories
- Toggle product/category status between ACTIVE and INACTIVE
- Review customer orders
- Approve or reject relevant order/payment review steps
- View daily sales summaries
- Export daily sales reports to Excel and PDF

A staff user cannot:
- Create products
- Edit product details
- Delete products
- Create categories
- Edit categories
- Delete categories
- Access admin-only analytics
- Create or manage admin users
- Fully manage staff/admin accounts

## 4.3 Admin
An admin can:
- Perform all staff actions
- Access full dashboard analytics
- Create, update, and delete categories
- Create, update, and delete products
- Manage brands
- Manage product images
- Manage product warranty information
- Manage staff and admin users
- Manage all relevant business data across the system

---

## 5. Product Scope

## 5.1 In Scope

### Customer-Facing Storefront
- Homepage / landing page
- Product listing page
- Product detail page
- Search and filtering
- Brand and category browsing
- Cart management
- Buy-now flow
- Checkout flow
- Address management
- Order history
- Order tracking

### Authentication and Account
- User registration
- User login
- Session persistence with access token and refresh token
- Logout
- Role-aware frontend and backend access control

### Payment
- Cash on Delivery (COD)
- PromptPay QR payment
- Payment slip upload after QR payment
- Staff/admin review of payment-related order workflow

### Back Office
- Staff dashboard
- Admin dashboard
- Order review and approval/rejection
- Product/category visibility toggling for staff
- Full catalog CRUD for admin
- User management for admin
- Reporting export in Excel and PDF

### Security and Quality
- Zod validation
- Strict TypeScript
- OWASP-aware security design
- Build/lint/test workflow
- Production-ready architecture

## 5.2 Out of Scope (Initial Version)
The following features are not included in the initial version unless explicitly added later:
- Online card payments
- Wallet payments
- Real-time shipment provider integrations
- Product reviews and ratings
- Wishlist
- Coupons and promotions
- Multi-vendor marketplace support
- Multi-language UI
- Multi-currency pricing
- Automated tax calculation
- Refund automation
- Chat support system

---

## 6. Product Categories

The platform must support at least the following product groups:
- CPU
- GPU
- RAM
- Mainboard
- PSU
- SSD
- HDD
- Case
- Monitor

The system should be designed so new categories can be added later by admins.

---

## 7. Functional Requirements

## 7.1 Registration
- A user must register before logging in.
- Required registration fields:
  - first name
  - last name
  - phone number
  - email
  - password
- Email must be unique.
- Password must be securely hashed before storage.
- Registration input must be validated.

## 7.2 Login
- Users must log in using:
  - email
  - password
- Invalid credentials must return a safe error response.
- Successful login must issue:
  - short-lived access token
  - long-lived refresh token
- Users should remain signed in until logout or token/session invalidation.

## 7.3 Session Management
- Access token must be used for authenticated API access.
- Refresh token must be used to obtain new access tokens without requiring the user to log in again.
- The system must support secure logout.
- Session/token handling must support revocation and secure refresh logic.

## 7.4 Catalog Browsing
- Customers must be able to browse all active products.
- Customers must be able to filter/search by:
  - category
  - brand
  - keyword
  - price range
  - active availability state as relevant
- Product detail pages must show:
  - name
  - images
  - brand
  - category
  - description
  - price
  - stock
  - warranty information
  - active/inactive availability rules for customer visibility

## 7.5 Product and Brand Requirements
Each product must support:
- product name
- slug
- SKU
- description
- brand association
- category association
- price
- stock
- warranty information
- image gallery
- active/inactive status

Each brand must support:
- name
- slug
- optional logo/image
- active/inactive status

## 7.6 Cart Management
A customer must be able to:
- add a product to cart
- increase quantity
- decrease quantity
- remove a line item
- clear the entire cart

Business rules:
- Quantity cannot exceed current stock.
- Inactive or unavailable products cannot be purchased.
- Cart operations must validate stock at relevant points.

## 7.7 Buy Now
- A customer can purchase a single product directly without adding it to the cart first.
- The buy-now flow must still validate stock, shipping address, and payment method.

## 7.8 Address Management
A customer must be able to:
- create addresses
- edit addresses
- delete addresses where allowed by business rules
- set a default address

Each address should support typical shipping fields such as:
- full name or recipient name if needed
- phone number
- address line 1
- address line 2
- district/subdistrict or equivalent structure
- province/state
- postal code
- country
- default flag

## 7.9 Checkout
The checkout flow must allow the customer to:
- select cart items or buy-now item
- select a shipping address
- choose a payment method
- review order totals before confirming the order

The system must:
- validate stock before creating the order
- create order snapshots so historical order details remain correct even if products change later

## 7.10 Payment Methods
The initial version supports exactly:
- Cash on Delivery (COD)
- PromptPay QR

### COD
- Customer places the order without uploading a payment slip.
- Order enters a valid order status for COD processing and staff review/handling.

### PromptPay QR
- Customer chooses PromptPay QR at checkout.
- The system presents the QR payment flow.
- After transfer, the customer uploads a slip image as proof of payment.
- The order/payment enters a pending review state.
- Staff/admin can review and approve or reject the related payment/order step.

## 7.11 Payment Slip Upload
- Slip upload is required for PromptPay QR payments.
- Uploaded files must be restricted to safe file types and size limits.
- Uploaded files must be stored securely through the image cloud service.
- Staff/admin must be able to view the slip for review.
- Rejection must support a reason.

## 7.12 Order Management
A customer must be able to:
- view order history
- view order details
- track their own order status

Staff/admin must be able to:
- view incoming orders
- review pending items
- approve or reject according to workflow
- update order progression where permitted by business rules

## 7.13 Staff Operations
Staff must be able to:
- access a back office interface
- review order/payment-related tasks
- approve/reject reviewable submissions
- view daily sales summaries
- export reports to Excel
- export reports to PDF
- view all products and categories
- toggle ACTIVE/INACTIVE status for products and categories

Staff must not be able to:
- create products
- edit product core information
- delete products
- create/edit/delete categories
- access admin-only analytics
- fully manage privileged users

## 7.14 Admin Operations
Admins must be able to:
- access all back office areas
- manage products fully
- manage categories fully
- manage brands fully if included in catalog management scope
- manage staff users
- manage admin users
- access deep dashboard analytics
- review/approve/reject orders/payment-related workflows
- perform all staff operations

## 7.15 Reporting
The system must support:
- daily sales summary for staff
- deeper summary/analytics for admin
- export to Excel
- export to PDF

Admin dashboard insights may include:
- revenue summary
- order counts by status
- top-selling products
- category performance
- recent order trends

---

## 8. Order and Payment Lifecycle Requirements

The system must support clear lifecycle states for orders and payments.

### Example order lifecycle
- PENDING
- AWAITING_PAYMENT
- PAYMENT_SUBMITTED
- PAYMENT_REVIEW
- APPROVED
- REJECTED
- PROCESSING
- SHIPPED
- DELIVERED
- CANCELLED

### Example payment lifecycle
- UNPAID
- PENDING_REVIEW
- APPROVED
- REJECTED

Final exact status names may be refined during architecture and schema design, but the workflow must support:
- COD order flow
- PromptPay QR payment proof submission
- manual review
- approval/rejection
- order tracking after approval

---

## 9. Non-Functional Requirements

## 9.1 Security
- The project must follow OWASP Top 10-aware practices.
- All external input must be validated.
- Sensitive data must be protected.
- Passwords must be hashed using bcryptjs.
- Token flows must be implemented securely.
- Role-based authorization must be enforced on the backend.
- File uploads must be validated.
- Error responses must not leak sensitive internal details.

## 9.2 Performance
- The application should remain responsive for typical medium-sized catalog and order volumes.
- Listing pages should support pagination or scalable loading strategies.
- Expensive dashboard/report queries should be designed responsibly.

## 9.3 Maintainability
- The project must use TypeScript across the entire codebase.
- The codebase must be modular and maintainable.
- Business logic must be separated from transport/controller logic.
- No `any`, no unsafe type assertions, and no weak shortcut typing should be used.

## 9.4 Validation and Type Safety
- Zod must be used for validation where appropriate.
- API boundaries must validate request data.
- Environment variables must be validated at startup.
- Frontend forms should align with strict typed contracts.

## 9.5 Reliability
- Build, lint, and relevant tests must pass after meaningful changes.
- The application should be kept runnable after each implementation phase.
- Critical workflows must be covered by tests.

## 9.6 UX/UI
- The storefront must look modern, polished, and professional.
- The interface must be responsive.
- The UI must not feel like a low-quality demo or school project.
- The back office must be clean, efficient, and usable.

---

## 10. Success Criteria

The project is considered successful when:
- Customers can register, log in, browse products, and place orders successfully.
- Customers can pay via COD or PromptPay QR.
- Customers can upload payment slips for PromptPay orders.
- Staff/admin can review and approve/reject the required workflow steps.
- Staff can export daily sales reports.
- Admin can manage the catalog and privileged users.
- The application passes build, lint, and relevant test checks.
- The application is deployable and production-ready.

---

## 11. Risks and Constraints

### Risks
- Payment proof review is manual and requires clear operational workflow.
- Poorly designed token handling could weaken session security.
- Weak stock validation could cause overselling.
- Weak upload validation could create security risks.
- Dashboard/report queries may become heavy if schema/query design is poor.

### Constraints
- Frontend must use Angular 21 + Tailwind CSS v4.
- Backend must use Express.js 5.
- Database must use MySQL.
- ORM must use Prisma ORM v7.
- Images must use Cloudinary.
- Password hashing must use bcryptjs.
- JWT must use jsonwebtoken.
- Entire project must use TypeScript.

---

## 12. Open Decisions to Confirm During Architecture Phase

The following details may be refined during architecture and implementation, but must remain consistent with the product goals:
- Final exact order status names
- Final payment status names
- Whether brand management is a standalone admin module or part of catalog management
- Exact analytics widgets on the admin dashboard
- Exact report columns for Excel/PDF export
- Exact address field structure for the target shipping region
- Exact token transport and cookie strategy for refresh tokens

---

## 13. Final Notes

This PRD defines the business requirements and product expectations for PC Hub. It is intended to guide architecture, schema design, API design, frontend implementation, testing strategy, and deployment planning.

All implementation decisions must remain aligned with:
- production readiness
- maintainability
- strict typing
- security
- real-world usability