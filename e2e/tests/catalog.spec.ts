import { test, expect } from "@playwright/test";
import { PRODUCT } from "../helpers/seed-data.js";

test.describe("Catalog browsing", () => {
  test("product list page loads and shows seeded products", async ({
    page,
  }) => {
    await page.goto("/products");

    // Page heading should be visible
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // At least one product card should render (seeded data has 12 products)
    // Product cards use the product name in an <h3>
    await expect(
      page.getByRole("heading", { name: PRODUCT.name }),
    ).toBeVisible();

    // The product card should show the brand name
    await expect(
      page.locator("app-product-card").getByText(PRODUCT.brand).first(),
    ).toBeVisible();
  });

  test("product detail page shows correct information", async ({ page }) => {
    await page.goto(`/products/${PRODUCT.slug}`);

    // Product name in the main heading
    await expect(
      page.getByRole("heading", { name: PRODUCT.name, level: 1 }),
    ).toBeVisible();

    // Brand name shown in detail area
    await expect(page.getByText(PRODUCT.brand).first()).toBeVisible();

    // SKU shown
    await expect(page.getByText(PRODUCT.sku, { exact: true })).toBeVisible();

    // Category name shown
    await expect(page.getByText(PRODUCT.category).first()).toBeVisible();

    // Add to Cart button should be visible (product has stock > 0)
    await expect(
      page.getByRole("button", { name: "Add to Cart" }),
    ).toBeVisible();

    // Buy Now button should be visible
    await expect(page.getByRole("button", { name: "Buy Now" })).toBeVisible();
  });
});
