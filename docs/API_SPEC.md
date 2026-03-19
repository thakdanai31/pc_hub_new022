# PC Hub API Specification

## 1. Overview

This document describes the planned REST API for PC Hub.

Principles:
- JSON-based REST API
- role-based authorization
- Zod validation for all external input
- consistent error responses
- predictable route naming
- pagination for list endpoints where relevant

Base path suggestion:
- `/api/v1`

---

## 2. Authentication Rules

Auth levels:
- Public: no authentication required
- Customer: authenticated customer only
- Staff: authenticated staff or admin
- Admin: authenticated admin only

Token model:
- access token for API access
- refresh token for refresh flow

---

## 3. Auth Endpoints

## 3.1 Register
- Method: `POST`
- Path: `/api/v1/auth/register`
- Auth: Public
- Purpose: Create a new customer account

Request body:
- firstName
- lastName
- phoneNumber
- email
- password

Response:
- user summary
- access token if desired by final design
- refresh token transport handled securely by backend strategy

## 3.2 Login
- Method: `POST`
- Path: `/api/v1/auth/login`
- Auth: Public
- Purpose: Authenticate a user

Request body:
- email
- password

Response:
- authenticated user summary
- access token
- refresh token transport handled securely

## 3.3 Refresh Session
- Method: `POST`
- Path: `/api/v1/auth/refresh`
- Auth: Public with valid refresh mechanism
- Purpose: Rotate refresh token and issue new access token

Response:
- new access token
- refreshed session context

## 3.4 Logout
- Method: `POST`
- Path: `/api/v1/auth/logout`
- Auth: Authenticated
- Purpose: End the current session

Response:
- success confirmation

## 3.5 Current Session
- Method: `GET`
- Path: `/api/v1/auth/me`
- Auth: Authenticated
- Purpose: Return current authenticated user summary

Response:
- id
- email
- firstName
- lastName
- role
- isActive

---

## 4. Customer Account Endpoints

## 4.1 List My Addresses
- Method: `GET`
- Path: `/api/v1/account/addresses`
- Auth: Customer
- Purpose: Get the current customer's addresses

## 4.2 Create Address
- Method: `POST`
- Path: `/api/v1/account/addresses`
- Auth: Customer
- Purpose: Create a shipping address

Request body:
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

## 4.3 Update Address
- Method: `PATCH`
- Path: `/api/v1/account/addresses/:addressId`
- Auth: Customer
- Purpose: Update one of the current customer's addresses

## 4.4 Delete Address
- Method: `DELETE`
- Path: `/api/v1/account/addresses/:addressId`
- Auth: Customer
- Purpose: Delete one of the current customer's addresses if allowed

## 4.5 Set Default Address
- Method: `POST`
- Path: `/api/v1/account/addresses/:addressId/default`
- Auth: Customer
- Purpose: Mark an address as default

---

## 5. Catalog Endpoints

## 5.1 List Categories
- Method: `GET`
- Path: `/api/v1/categories`
- Auth: Public
- Purpose: List active categories for storefront or all categories for privileged views depending on query and auth

Query examples:
- page
- limit
- search
- isActive

## 5.2 Get Category Detail
- Method: `GET`
- Path: `/api/v1/categories/:categoryId`
- Auth: Staff/Admin for inactive detail if needed, Public for active detail if exposed

## 5.3 List Brands
- Method: `GET`
- Path: `/api/v1/brands`
- Auth: Public
- Purpose: List active brands

## 5.4 Get Brand Detail
- Method: `GET`
- Path: `/api/v1/brands/:brandId`
- Auth: Public or privileged depending on status

## 5.5 List Products
- Method: `GET`
- Path: `/api/v1/products`
- Auth: Public
- Purpose: Browse products

Query:
- page
- limit
- search
- categoryId
- brandId
- minPrice
- maxPrice
- sort
- isActive for privileged views

Response:
- paginated product list with summary fields

## 5.6 Get Product Detail
- Method: `GET`
- Path: `/api/v1/products/:productId`
- Auth: Public for active products
- Purpose: Get product detail

## 5.7 Get Product by Slug
- Method: `GET`
- Path: `/api/v1/products/slug/:slug`
- Auth: Public
- Purpose: Friendly storefront lookup

---

## 6. Cart Endpoints

## 6.1 Get Current Cart
- Method: `GET`
- Path: `/api/v1/cart`
- Auth: Customer
- Purpose: Return current customer's cart

## 6.2 Add Item to Cart
- Method: `POST`
- Path: `/api/v1/cart/items`
- Auth: Customer
- Purpose: Add or increase a cart item

Request body:
- productId
- quantity

## 6.3 Update Cart Item Quantity
- Method: `PATCH`
- Path: `/api/v1/cart/items/:cartItemId`
- Auth: Customer
- Purpose: Update quantity

Request body:
- quantity

## 6.4 Remove Cart Item
- Method: `DELETE`
- Path: `/api/v1/cart/items/:cartItemId`
- Auth: Customer
- Purpose: Remove one line item

## 6.5 Clear Cart
- Method: `DELETE`
- Path: `/api/v1/cart`
- Auth: Customer
- Purpose: Clear all cart items

---

## 7. Checkout and Order Endpoints

## 7.1 Create Checkout from Cart
- Method: `POST`
- Path: `/api/v1/checkout/cart`
- Auth: Customer
- Purpose: Validate selected cart and create an order

Request body:
- addressId
- paymentMethod
- customerNote

## 7.2 Buy Now Checkout
- Method: `POST`
- Path: `/api/v1/checkout/buy-now`
- Auth: Customer
- Purpose: Create an order directly from a single product

Request body:
- productId
- quantity
- addressId
- paymentMethod
- customerNote

## 7.3 List My Orders
- Method: `GET`
- Path: `/api/v1/account/orders`
- Auth: Customer
- Purpose: Return current customer's orders

Query:
- page
- limit
- status

## 7.4 Get My Order Detail
- Method: `GET`
- Path: `/api/v1/account/orders/:orderId`
- Auth: Customer
- Purpose: Return details of one customer-owned order

---

## 8. Payment Endpoints

## 8.1 Get Payment Detail for My Order
- Method: `GET`
- Path: `/api/v1/account/orders/:orderId/payment`
- Auth: Customer
- Purpose: Return payment state and related info

## 8.2 Get PromptPay QR Data
- Method: `GET`
- Path: `/api/v1/account/orders/:orderId/promptpay`
- Auth: Customer
- Purpose: Return QR-related data for PromptPay payment flow

## 8.3 Upload Payment Slip
- Method: `POST`
- Path: `/api/v1/account/orders/:orderId/payment-slip`
- Auth: Customer
- Purpose: Upload PromptPay payment proof

Request:
- multipart/form-data
- file field for slip image

Response:
- payment slip summary
- updated payment status if applicable

---

## 9. Staff and Admin Order Review Endpoints

## 9.1 List Reviewable Orders
- Method: `GET`
- Path: `/api/v1/backoffice/orders`
- Auth: Staff
- Purpose: List orders for staff/admin review

Query:
- page
- limit
- status
- paymentMethod
- customerSearch
- dateFrom
- dateTo

## 9.2 Get Backoffice Order Detail
- Method: `GET`
- Path: `/api/v1/backoffice/orders/:orderId`
- Auth: Staff
- Purpose: Get full order detail for review

## 9.3 Approve Payment / Order Step
- Method: `POST`
- Path: `/api/v1/backoffice/orders/:orderId/approve`
- Auth: Staff
- Purpose: Approve a reviewable order/payment step

Request body:
- note if needed

## 9.4 Reject Payment / Order Step
- Method: `POST`
- Path: `/api/v1/backoffice/orders/:orderId/reject`
- Auth: Staff
- Purpose: Reject a reviewable order/payment step

Request body:
- reason

## 9.5 Advance Order Status
- Method: `POST`
- Path: `/api/v1/backoffice/orders/:orderId/status`
- Auth: Staff
- Purpose: Move order to next allowed operational status

Request body:
- status

---

## 10. Staff and Admin Catalog Endpoints

## 10.1 Admin Create Category
- Method: `POST`
- Path: `/api/v1/backoffice/categories`
- Auth: Admin
- Purpose: Create category

## 10.2 Admin Update Category
- Method: `PATCH`
- Path: `/api/v1/backoffice/categories/:categoryId`
- Auth: Admin
- Purpose: Update category

## 10.3 Admin Delete Category
- Method: `DELETE`
- Path: `/api/v1/backoffice/categories/:categoryId`
- Auth: Admin
- Purpose: Delete category if business rules allow

## 10.4 Staff/Admin Toggle Category Active State
- Method: `POST`
- Path: `/api/v1/backoffice/categories/:categoryId/toggle-active`
- Auth: Staff
- Purpose: Toggle active/inactive

## 10.5 Admin Create Brand
- Method: `POST`
- Path: `/api/v1/backoffice/brands`
- Auth: Admin
- Purpose: Create brand

## 10.6 Admin Update Brand
- Method: `PATCH`
- Path: `/api/v1/backoffice/brands/:brandId`
- Auth: Admin
- Purpose: Update brand

## 10.7 Admin Delete Brand
- Method: `DELETE`
- Path: `/api/v1/backoffice/brands/:brandId`
- Auth: Admin
- Purpose: Delete brand

## 10.8 Staff/Admin Toggle Brand Active State
- Method: `POST`
- Path: `/api/v1/backoffice/brands/:brandId/toggle-active`
- Auth: Staff
- Purpose: Toggle active/inactive

## 10.9 Admin Create Product
- Method: `POST`
- Path: `/api/v1/backoffice/products`
- Auth: Admin
- Purpose: Create product

Request body:
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

## 10.10 Admin Update Product
- Method: `PATCH`
- Path: `/api/v1/backoffice/products/:productId`
- Auth: Admin
- Purpose: Update product

## 10.11 Admin Delete Product
- Method: `DELETE`
- Path: `/api/v1/backoffice/products/:productId`
- Auth: Admin
- Purpose: Delete product if allowed or apply controlled archive logic

## 10.12 Staff/Admin Toggle Product Active State
- Method: `POST`
- Path: `/api/v1/backoffice/products/:productId/toggle-active`
- Auth: Staff
- Purpose: Toggle active/inactive

## 10.13 Admin Upload Product Image
- Method: `POST`
- Path: `/api/v1/backoffice/products/:productId/images`
- Auth: Admin
- Purpose: Upload product image

Request:
- multipart/form-data

## 10.14 Admin Delete Product Image
- Method: `DELETE`
- Path: `/api/v1/backoffice/products/:productId/images/:imageId`
- Auth: Admin
- Purpose: Remove product image

---

## 11. User Management Endpoints

## 11.1 Admin List Privileged Users
- Method: `GET`
- Path: `/api/v1/backoffice/users`
- Auth: Admin
- Purpose: List staff/admin users and optionally customers if final scope allows

## 11.2 Admin Create Staff User
- Method: `POST`
- Path: `/api/v1/backoffice/users/staff`
- Auth: Admin
- Purpose: Create staff account

## 11.3 Admin Create Admin User
- Method: `POST`
- Path: `/api/v1/backoffice/users/admin`
- Auth: Admin
- Purpose: Create admin account

## 11.4 Admin Update User Role/Status
- Method: `PATCH`
- Path: `/api/v1/backoffice/users/:userId`
- Auth: Admin
- Purpose: Update user status or profile fields allowed by policy

## 11.5 Admin Disable User
- Method: `POST`
- Path: `/api/v1/backoffice/users/:userId/disable`
- Auth: Admin
- Purpose: Disable a user account

---

## 12. Reporting Endpoints

## 12.1 Staff Daily Sales Summary
- Method: `GET`
- Path: `/api/v1/backoffice/reports/daily-sales`
- Auth: Staff
- Purpose: Return daily sales summary

Query:
- date

## 12.2 Staff Export Daily Sales Excel
- Method: `GET`
- Path: `/api/v1/backoffice/reports/daily-sales/excel`
- Auth: Staff
- Purpose: Export daily sales as Excel

## 12.3 Staff Export Daily Sales PDF
- Method: `GET`
- Path: `/api/v1/backoffice/reports/daily-sales/pdf`
- Auth: Staff
- Purpose: Export daily sales as PDF

## 12.4 Admin Analytics Summary
- Method: `GET`
- Path: `/api/v1/backoffice/analytics/summary`
- Auth: Admin
- Purpose: Return admin dashboard summary data

## 12.5 Admin Revenue Trend
- Method: `GET`
- Path: `/api/v1/backoffice/analytics/revenue-trend`
- Auth: Admin
- Purpose: Return chart data for revenue over time

## 12.6 Admin Top Products
- Method: `GET`
- Path: `/api/v1/backoffice/analytics/top-products`
- Auth: Admin
- Purpose: Return best-selling products

---

## 13. Health and System Endpoints

## 13.1 Health Check
- Method: `GET`
- Path: `/api/v1/health`
- Auth: Public
- Purpose: Basic server health check

## 13.2 Readiness Check
- Method: `GET`
- Path: `/api/v1/ready`
- Auth: Public or internal use
- Purpose: Verify service readiness including DB connectivity if desired

---

## 14. Validation Expectations

For all applicable endpoints:
- validate params
- validate query strings
- validate JSON body
- validate file metadata for uploads

Use Zod schemas for:
- auth payloads
- IDs and pagination
- catalog forms
- address forms
- checkout payloads
- approval/rejection payloads
- reporting filters

---

## 15. Response Conventions

## 15.1 Success Response
Suggested shape:
- success: true
- message
- data

## 15.2 Paginated Response
Suggested shape:
- success: true
- message
- data
- pagination:
  - page
  - limit
  - total
  - totalPages

## 15.3 Error Response
Suggested shape:
- success: false
- message
- code
- details when safe and relevant

---

## 16. Notes

Final request and response field names may be refined during implementation, but route responsibilities and access rules must remain aligned with this document and the PRD.