# Frontend Redesign Tasks — "Neon Forge"

Design direction: Bold, technical, premium. Dark hero surfaces, glassmorphism cards, electric indigo/violet accents, micro-animations, mobile-first responsive.

**Ground rules:**
- HTML/CSS changes only (no `.ts` logic changes unless required for new UI behavior)
- No new dependencies — Tailwind CSS v4 only
- Preserve all existing functionality
- Build + lint + test must pass after each slice
- Mobile-first responsive on every page

---

## Slice 0 — Design Foundation (Global Styles + Tokens)

**Files:** `apps/web/src/styles.css`

- [x] New CSS custom properties: glass effects, glow shadows, gradient border tokens
- [x] New animation keyframes: fade-up, scale-in, slide-in, stagger, glow-pulse
- [x] Updated button system: primary (gradient + glow), secondary (glass), destructive, ghost
- [x] Form field redesign: better focus rings with glow, refined border radius and padding
- [x] New card system: glass cards, bordered cards, highlighted cards with gradient borders
- [x] Typography refinements: display/heading/body with tighter tracking
- [x] Status indicator system update
- [x] **Build passes**
- [x] **Lint passes**
- [x] **Tests pass**

---

## Slice 1 — Storefront Layout Shell

**Files:** `apps/web/src/app/layouts/storefront/storefront-layout.html`, `storefront-layout.ts`

- [x] Navbar: sticky blur backdrop, animated logo, category nav links, search in nav
- [x] Navbar: user dropdown menu (replace inline links), mobile hamburger + slide-out drawer
- [x] Navbar: cart icon with animated badge count
- [x] Footer: multi-column with trust badges, gradient border top, social-style links
- [x] Mobile: bottom navigation bar for key actions (home, products, cart, account)
- [x] **Build passes**
- [x] **Lint passes**
- [x] **Tests pass**

---

## Slice 2 — Homepage

**Files:** `apps/web/src/app/features/home/home.html`, `home.ts`

- [x] Hero: full-width animated gradient mesh background, split layout, bold typography
- [x] Category showcase: horizontal scroll cards with icons per category
- [x] Featured products section or "new arrivals" highlight
- [x] Stats/social proof strip with animated counters
- [x] Value props: icon-forward cards with hover effects
- [x] CTA banner: glassmorphism card with gradient animated border
- [x] **Build passes**
- [x] **Lint passes**
- [x] **Tests pass**

---

## Slice 3 — Auth Pages (Login + Register)

**Files:** `apps/web/src/app/features/auth/login/login.html`, `register/register.html`

- [x] Login: animated gradient brand panel, refined form card with glass effect
- [x] Login: show/hide password toggle, better loading spinner
- [x] Register: password strength indicator, better field grouping
- [x] Both: social proof on brand panel (customer count, trust signals)
- [x] Both: mobile-optimized single-column layout
- [x] **Build passes**
- [x] **Lint passes**
- [x] **Tests pass**

---

## Slice 4 — Product List + Product Card

**Files:** `apps/web/src/app/features/catalog/product-list/product-list.html`, `apps/web/src/app/shared/components/product-card/product-card.html`

- [x] Filter bar: collapsible sidebar on desktop, chip-style active filters, clear all
- [x] Product card: glass card with hover zoom + overlay quick-add, brand badge, better price display
- [x] Grid/list view toggle
- [x] Skeleton loading with stagger animation
- [x] Active filter chips above grid
- [x] Empty/error states with illustration feel
- [x] **Build passes**
- [x] **Lint passes**
- [x] **Tests pass**

---

## Slice 5 — Product Detail

**Files:** `apps/web/src/app/features/catalog/product-detail/product-detail.html`

- [x] Gallery: lightbox-style zoom on click, animated thumbnail selection
- [x] Product info: sticky sidebar, tabbed specs/description/warranty
- [x] Price card: glassmorphism with glow effect on CTA
- [x] Stock indicator: visual progress bar style
- [x] Breadcrumb: pill-style with hover transitions
- [x] Quantity selector with better styling
- [x] Cart feedback: animated success toast
- [x] **Build passes**
- [x] **Lint passes**
- [x] **Tests pass**

---

## Slice 6 — Cart Page

**Files:** `apps/web/src/app/features/cart/cart-page.html`

- [x] Cart items: refined card layout, inline stepper, remove animation
- [x] Order summary: glass card, sticky, animated total
- [x] Empty cart: illustrated empty state
- [x] Progress indicator: Cart → Checkout → Confirmation step dots
- [x] Trust signals with icons
- [x] **Build passes**
- [x] **Lint passes**
- [x] **Tests pass**

---

## Slice 7 — Checkout + Order Confirmation

**Files:** `apps/web/src/app/features/checkout/checkout-page.html`, `order-confirmation.html`

- [x] Step progress bar: visual with active/completed states
- [x] Address cards: radio selection with checkmark animation
- [x] Payment method: visual radio cards with icons
- [x] Order summary sidebar: collapsible on mobile, sticky on desktop
- [x] Confirmation: celebration animation, order summary, next-steps CTA
- [x] **Build passes**
- [x] **Lint passes**
- [x] **Tests pass**

---

## Slice 8A — Profile Management (New Feature)

**Scope:** Backend endpoint + frontend profile page. Users can edit first name, last name, phone number. Email and password are read-only/not editable.

### Backend (`apps/api`)
- [x] Add `PATCH /api/v1/account/profile` endpoint (auth required, CUSTOMER/STAFF/ADMIN)
- [x] Zod schema: `firstName`, `lastName`, `phoneNumber` (all optional, at least one required)
- [x] Service: update user in DB, return updated user
- [x] Add backend test for profile update (9 tests)
- [x] **API build passes**
- [x] **API lint passes**
- [x] **API tests pass** (25 files, 322 tests)

### Frontend (`apps/web`)
- [x] Add profile route `/account/profile` in app.routes.ts
- [x] Create profile page component with edit form
- [x] Display: email (read-only), first name (editable), last name (editable), phone (editable)
- [x] Show role badge (read-only)
- [x] Success/error feedback on save
- [x] Add "Profile" link to storefront navbar user dropdown + mobile drawer
- [x] Add ProfileService with getProfile + updateProfile methods
- [x] **Web build passes**
- [x] **Web lint passes**
- [x] **Web tests pass** (27 files, 113 tests)

---

## Slice 8B — Customer Account Pages Redesign

**Files:** `order-history.html`, `order-detail.html`, `address-list.html`, `address-form.html`

- [x] Order history: refined list with status badges, better card layout
- [x] Order detail: progress tracker, payment section styling
- [x] Address list: card grid with default badge, better actions
- [x] Address form: refined field styling, inline validation
- [x] **Build passes**
- [x] **Lint passes**
- [x] **Tests pass**

---

## Slice 9 — Backoffice Layout Shell

**Files:** `apps/web/src/app/layouts/backoffice/backoffice-layout.html`, `backoffice-layout.ts`

- [x] Sidebar: collapsible to icon-only, section dividers, active item accent + bg
- [x] Sidebar: notification badges on menu items (e.g. pending orders count)
- [x] Top bar: search spotlight (Cmd+K feel), user dropdown with role badge
- [x] Breadcrumb trail in top bar
- [x] Mobile: slide-over sidebar with overlay backdrop
- [x] **Build passes**
- [x] **Lint passes**
- [x] **Tests pass**

---

## Slice 10 — Backoffice Dashboard

**Files:** `apps/web/src/app/features/backoffice/dashboard/dashboard-page.html`

- [x] Stat cards: gradient accent borders, trend arrows, mini sparkline (CSS-only)
- [x] Recent orders table preview with inline status badges
- [x] Quick actions: icon card grid with descriptions
- [x] Welcome banner with user greeting and time-of-day context
- [x] **Build passes**
- [x] **Lint passes**
- [x] **Tests pass**

---

## Slice 11 — Backoffice Orders

**Files:** `apps/web/src/app/features/backoffice/orders/order-list.html`, `order-detail.html`

- [x] Order table: sortable columns, inline status badges, customer info
- [x] Filter bar: status tabs + search + date range picker
- [x] Order detail: split layout (info left, timeline/actions right), slip viewer
- [x] Approve/reject: styled modal with reason input
- [x] **Build passes**
- [x] **Lint passes**
- [x] **Tests pass**

---

## Slice 12 — Backoffice Catalog (Products, Categories, Brands)

**Files:** `apps/web/src/app/features/backoffice/products/product-list.html`, `product-form.html`, `categories/category-list.html`, `category-form.html`, `brands/brand-list.html`, `brand-form.html`

- [x] Tables: image thumbnails, toggle switches for active state, action menus
- [x] Product form: two-column (form + preview), drag-drop image upload zone
- [x] Category list: visual hierarchy with tree indentation
- [x] Brand form: logo preview
- [x] Rich validation feedback on all forms
- [x] **Build passes**
- [x] **Lint passes**
- [x] **Tests pass**

---

## Slice 13 — Backoffice Reports, Analytics, Users

**Files:** `apps/web/src/app/features/backoffice/reports/daily-sales.html`, `analytics/analytics-page.html`, `users/user-list.html`, `users/user-form.html`

- [x] Daily sales: date picker, stat summary cards, styled table + export buttons
- [x] Analytics: KPI cards with comparison, top products, revenue summary
- [x] User list: avatar + role badges, status toggles
- [x] User form: role selector with visual cards
- [x] **Build passes**
- [x] **Lint passes**
- [x] **Tests pass**

---

## Slice 14 — 404 Page + Shared Components Polish

**Files:** `apps/web/src/app/features/not-found/not-found.html`, all 9 shared components under `apps/web/src/app/shared/components/`

- [x] 404 page: illustrated state with animated elements, back-to-home CTA
- [x] alert-banner: updated with new design tokens
- [x] confirm-dialog: glass overlay + refined card
- [x] data-table: updated row styling, hover states
- [x] empty-state: illustration slot, better typography
- [x] loading-skeleton: updated shimmer to match new palette
- [x] page-header: breadcrumb integration, action buttons slot
- [x] pagination: pill-style page buttons, active state glow
- [x] product-card: (done in Slice 4)
- [x] status-badge: refined color system with dot indicator
- [x] **Build passes**
- [x] **Lint passes**
- [x] **Tests pass**

---

## Summary

| Slice | Description | Status |
|-------|------------|--------|
| 0 | Design foundation | ✅ Done |
| 1 | Storefront layout | ✅ Done |
| 2 | Homepage | ✅ Done |
| 3 | Auth pages | ✅ Done |
| 4 | Product list + card | ✅ Done |
| 5 | Product detail | ✅ Done |
| 6 | Cart page | ✅ Done |
| 7 | Checkout + confirmation | ✅ Done |
| 8A | Profile management (new feature) | ✅ Done |
| 8B | Customer account pages redesign | ✅ Done |
| 9 | Backoffice layout | ✅ Done |
| 10 | Backoffice dashboard | ✅ Done |
| 11 | Backoffice orders | ✅ Done |
| 12 | Backoffice catalog CRUD | ✅ Done |
| 13 | Backoffice reports/analytics/users | ✅ Done |
| 14 | 404 + shared components | ✅ Done |
