import { type Page, expect } from "@playwright/test";

/**
 * Log in via the UI login form.
 * Navigates to /login, fills email+password, submits, and waits
 * for redirect away from /login.
 */
export async function loginAs(
  page: Page,
  credentials: { email: string; password: string },
): Promise<void> {
  await page.goto("/login");

  await page.getByLabel("Email address").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Wait for successful redirect (login page disappears)
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * Wait for Angular's auth state to be fully restored after a full page load.
 * After page.goto(), Angular re-bootstraps and restoreToken() calls fetchMe()
 * asynchronously. This helper waits until the nav Cart link is visible,
 * proving that isAuthenticated() has become true.
 */
export async function ensureAuthenticated(page: Page): Promise<void> {
  await expect(page.getByRole("link", { name: /Cart/i })).toBeVisible({
    timeout: 10000,
  });
}
