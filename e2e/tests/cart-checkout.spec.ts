import { test, expect } from "@playwright/test";
import { loginAs, ensureAuthenticated } from "../helpers/auth.js";
import { CUSTOMER, PRODUCT } from "../helpers/seed-data.js";

test.describe("Cart and Checkout", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, CUSTOMER);
  });

  test("logged-in customer can add a product to the cart", async ({ page }) => {
    // Navigate to a product detail page
    await page.goto(`/products/${PRODUCT.slug}`);
    await ensureAuthenticated(page);

    // Click "Add to Cart"
    await page.getByRole("button", { name: "Add to Cart" }).click();

    // Wait for the success feedback
    await expect(page.getByText(/added to cart/i)).toBeVisible();

    // Navigate to the cart page
    await page.goto("/cart");

    // The cart should show the heading
    await expect(
      page.getByRole("heading", { name: "Shopping Cart" }),
    ).toBeVisible();

    // The product name should appear in the cart
    await expect(page.getByText(PRODUCT.name).first()).toBeVisible();

    // "Proceed to Checkout" link should be available
    await expect(
      page.getByRole("link", { name: "Proceed to Checkout" }),
    ).toBeVisible();
  });

  test("customer can complete COD checkout", async ({ page }) => {
    // Ensure there is an item in the cart
    await page.goto(`/products/${PRODUCT.slug}`);
    await ensureAuthenticated(page);
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await expect(page.getByText(/added to cart/i)).toBeVisible();

    // Go to checkout via the cart
    await page.goto("/cart");
    await page.getByRole("link", { name: "Proceed to Checkout" }).click();

    // Should be on the checkout page
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

    // Step 1: Shipping Address — if the customer has saved addresses,
    // the first one should be pre-selected. If not, the test still validates
    // the checkout page loads correctly.

    // Step 2: Payment Method — select COD (may already be selected)
    const codLabel = page.getByText("Cash on Delivery");
    await codLabel.click();

    // Step 3: Place the order
    await page.getByRole("button", { name: "Place Order" }).click();

    // Should navigate to the order confirmation page
    await expect(page).toHaveURL(/\/checkout\/confirmation/);
    await expect(
      page.getByRole("heading", { name: /Order Placed Successfully/i }),
    ).toBeVisible();

    // Confirmation should show COD as the payment method
    await expect(page.getByText("Cash on Delivery")).toBeVisible();
  });

  test.afterAll(async ({ browser }) => {
    // Clean up: clear the cart so re-runs don't accumulate items
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginAs(page, CUSTOMER);
      await page.goto("/cart");

      // Only clear if cart is not empty
      const clearButton = page.getByText("Clear all");
      if (await clearButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await clearButton.click();
        // Confirm the clear dialog
        const confirmButton = page.getByRole("button", { name: "Clear Cart" });
        if (
          await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          await confirmButton.click();
        }
        // Wait for empty cart state
        await expect(page.getByText("Your cart is empty")).toBeVisible({
          timeout: 5000,
        });
      }
    } finally {
      await context.close();
    }
  });
});
