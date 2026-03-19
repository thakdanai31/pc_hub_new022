import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth.js';
import { CUSTOMER } from '../helpers/seed-data.js';

test.describe('Authentication', () => {
  test('customer can log in and see the homepage', async ({ page }) => {
    await loginAs(page, CUSTOMER);

    // Should land on the homepage
    await expect(page).toHaveURL('/');

    // Homepage hero should be visible
    await expect(
      page.getByRole('heading', { name: /Build Your/i }),
    ).toBeVisible();

    // Nav should show authenticated state (Cart link visible)
    await expect(page.getByRole('link', { name: /Cart/i })).toBeVisible();
  });

  test('guest is redirected from protected route to login', async ({
    page,
  }) => {
    // Navigate directly to a protected route without logging in
    await page.goto('/cart');

    // Should be redirected to the login page
    await expect(page).toHaveURL(/\/login/);

    // Login form should be visible
    await expect(
      page.getByRole('heading', { name: 'Sign in' }),
    ).toBeVisible();
  });
});
