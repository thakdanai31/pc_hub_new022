/**
 * Seed data constants matching the idempotent seed script (apps/api/prisma/seed.ts).
 * Keep these in sync if the seed changes.
 */

export const CUSTOMER = {
  email: 'customer@pchub.com',
  password: 'Customer@1234',
  firstName: 'Customer',
} as const;

export const STAFF = {
  email: 'staff@pchub.com',
  password: 'Staff@1234',
  firstName: 'Staff',
} as const;

export const ADMIN = {
  email: 'admin@pchub.com',
  password: 'Admin@1234',
  firstName: 'Admin',
} as const;

/** First seeded product — safe to use in add-to-cart tests because stock = 25 */
export const PRODUCT = {
  name: 'AMD Ryzen 9 7950X',
  slug: 'amd-ryzen-9-7950x',
  sku: 'CPU-AMD-7950X',
  brand: 'AMD',
  category: 'CPU',
} as const;
