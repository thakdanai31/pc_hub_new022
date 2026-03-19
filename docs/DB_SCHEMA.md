# PC Hub Database Schema Design

## 1. Overview

This document defines the intended relational database design for PC Hub.

Goals:
- support real-world e-commerce workflows
- maintain historical order correctness
- support role-based user management
- support catalog management
- support payment review for PromptPay QR
- support reporting and analytics
- support secure session handling

Database engine:
- MySQL

ORM:
- Prisma ORM v7

---

## 2. Design Principles

- use a single `User` model with role separation
- keep business history stable using snapshots
- avoid hard deletes for important business records where possible
- use explicit status enums
- use indexed foreign keys and lookup fields
- separate order state from payment state
- support server-side refresh token revocation

---

## 3. Core Entities

## 3.1 User
Represents all authenticated users.

Fields:
- id
- firstName
- lastName
- phoneNumber
- email
- passwordHash
- role
- isActive
- createdAt
- updatedAt

Notes:
- email must be unique
- role values: CUSTOMER, STAFF, ADMIN
- `isActive` allows disabling accounts without deleting them

## 3.2 Address
Represents customer shipping addresses.

Fields:
- id
- userId
- label
- recipientName
- phoneNumber
- line1
- line2
- district
- subdistrict
- province
- postalCode
- country
- isDefault
- createdAt
- updatedAt

Notes:
- belongs to one user
- a user can have multiple addresses

## 3.3 Category
Represents product categories.

Fields:
- id
- name
- slug
- description
- parentId
- isActive
- createdAt
- updatedAt

Notes:
- optional self-reference for nested categories
- admins can fully manage categories
- staff can only toggle active state

## 3.4 Brand
Represents product brands.

Fields:
- id
- name
- slug
- logoUrl
- logoPublicId
- isActive
- createdAt
- updatedAt

## 3.5 Product
Represents a sellable hardware product.

Fields:
- id
- categoryId
- brandId
- name
- slug
- sku
- description
- price
- stock
- warrantyMonths
- isActive
- createdAt
- updatedAt

Notes:
- belongs to one category
- belongs to one brand
- stock must never become negative
- inactive products are not purchasable by customers

## 3.6 ProductImage
Represents product gallery images.

Fields:
- id
- productId
- imageUrl
- imagePublicId
- altText
- sortOrder
- createdAt

---

## 4. Cart Domain

## 4.1 Cart
Represents a customer shopping cart.

Fields:
- id
- userId
- createdAt
- updatedAt

Notes:
- one cart per customer
- unique constraint on userId

## 4.2 CartItem
Represents a product line inside a cart.

Fields:
- id
- cartId
- productId
- quantity
- createdAt
- updatedAt

Notes:
- quantity must be positive
- unique constraint on cartId + productId

---

## 5. Order Domain

## 5.1 Order
Represents a placed order.

Fields:
- id
- userId
- addressSnapshot
- orderNumber
- paymentMethod
- status
- subtotalAmount
- shippingAmount
- totalAmount
- customerNote
- approvedByUserId
- approvedAt
- rejectedByUserId
- rejectedAt
- rejectReason
- createdAt
- updatedAt

Notes:
- `addressSnapshot` stores the selected shipping address data at order time
- `orderNumber` should be unique and human-friendly
- order status is independent from payment status

## 5.2 OrderItem
Represents a line item within an order.

Fields:
- id
- orderId
- productId
- productSnapshot
- quantity
- unitPrice
- lineTotal
- createdAt

Notes:
- `productSnapshot` stores product details at purchase time
- productId may still point to the source product for reference
- historical correctness must not depend on live product data

---

## 6. Payment Domain

## 6.1 Payment
Represents payment information for an order.

Fields:
- id
- orderId
- paymentMethod
- status
- amount
- promptPayReference
- reviewedByUserId
- reviewedAt
- rejectReason
- createdAt
- updatedAt

Notes:
- one primary payment record per order in the initial version
- payment methods: COD, PROMPTPAY_QR
- payment statuses: UNPAID, PENDING_REVIEW, APPROVED, REJECTED

## 6.2 PaymentSlip
Represents a PromptPay payment evidence upload.

Fields:
- id
- paymentId
- uploadedByUserId
- imageUrl
- imagePublicId
- uploadedAt

Notes:
- initial version may support one active slip per payment, but schema should allow multiple uploads if needed later
- link to `Payment`, not directly to `Order`, to keep payment modeling clean

---

## 7. Session Domain

## 7.1 RefreshToken
Represents server-side refresh token records.

Fields:
- id
- userId
- tokenHash
- expiresAt
- revokedAt
- replacedByTokenId
- createdAt
- updatedAt

Notes:
- store hashed refresh token value
- support rotation
- support revocation
- support token replacement chains if needed

---

## 8. Optional Audit Domain

## 8.1 AuditLog
Optional but recommended for privileged actions.

Fields:
- id
- actorUserId
- action
- entityType
- entityId
- metadata
- createdAt

Possible uses:
- admin user updates
- product status toggles
- order approval/rejection
- payment review actions

---

## 9. Relationships

## 9.1 Main Relationships
- User 1:N Address
- User 1:1 Cart
- Cart 1:N CartItem
- Product 1:N CartItem
- Category 1:N Product
- Brand 1:N Product
- Product 1:N ProductImage
- User 1:N Order
- Order 1:N OrderItem
- Order 1:1 Payment
- Payment 1:N PaymentSlip
- User 1:N RefreshToken
- User 1:N AuditLog as actor
- User optional relation to Order approval/rejection fields
- User optional relation to Payment review fields

---

## 10. Enums

## 10.1 UserRole
- CUSTOMER
- STAFF
- ADMIN

## 10.2 PaymentMethod
- COD
- PROMPTPAY_QR

## 10.3 OrderStatus
Recommended initial values:
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

## 10.4 PaymentStatus
Recommended initial values:
- UNPAID
- PENDING_REVIEW
- APPROVED
- REJECTED

---

## 11. Snapshots

## 11.1 Address Snapshot
Orders must store a copy of the selected shipping address at checkout.
Reason:
- later edits to the address must not change historical order records

## 11.2 Product Snapshot
Order items must store product purchase-time details such as:
- product name
- SKU
- brand name if useful
- category name if useful
- warranty information if relevant
- unit price

Reason:
- price and product data can change after the order is placed

---

## 12. Indexing Recommendations

## 12.1 User
- unique index on email
- index on role
- index on isActive

## 12.2 Address
- index on userId
- composite index on userId + isDefault if needed

## 12.3 Category
- unique index on slug
- index on parentId
- index on isActive

## 12.4 Brand
- unique index on slug
- unique index on name if desired
- index on isActive

## 12.5 Product
- unique index on slug
- unique index on sku
- index on categoryId
- index on brandId
- index on isActive
- index on createdAt
- optional composite indexes for catalog filtering

## 12.6 ProductImage
- index on productId
- composite index on productId + sortOrder

## 12.7 Cart
- unique index on userId

## 12.8 CartItem
- index on cartId
- index on productId
- unique composite index on cartId + productId

## 12.9 Order
- unique index on orderNumber
- index on userId
- index on status
- index on paymentMethod
- index on createdAt

## 12.10 OrderItem
- index on orderId
- index on productId

## 12.11 Payment
- unique index on orderId
- index on status
- index on paymentMethod
- index on reviewedByUserId

## 12.12 PaymentSlip
- index on paymentId
- index on uploadedByUserId
- index on uploadedAt

## 12.13 RefreshToken
- index on userId
- index on expiresAt
- index on revokedAt

---

## 13. Lifecycle Considerations

## 13.1 Cart Lifecycle
- cart exists for active customer
- items can be added/updated/removed
- successful checkout converts selected items into an order
- cart may then be partially or fully cleared depending on checkout design

## 13.2 Order Lifecycle
- order created
- payment flow diverges by payment method
- order can be approved/rejected
- approved orders continue to processing/shipping
- rejected/cancelled orders may trigger stock restoration

## 13.3 Payment Lifecycle
- COD creates payment record with unpaid or COD-specific state model
- PromptPay creates pending payment expectation
- slip upload moves payment into review-related state
- staff/admin approves or rejects

---

## 14. Integrity Rules

- a customer must only access their own addresses, carts, orders, and slips
- only staff/admin can review payments and orders in back office flows
- stock decrement must happen transactionally at order creation or confirmation point
- rejected/cancelled orders must restore stock when appropriate
- inactive products/categories/brands should not appear in customer purchase flows
- deletion of important business records should be restricted or replaced with active-state control

---

## 15. Future-Friendly Notes

The schema should be designed so it can later support:
- coupons
- multiple payment attempts
- shipment tracking
- refund handling
- product reviews
- inventory movement logs

These are not required in the initial version but should not be blocked by the initial structure.