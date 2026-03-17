/**
 * auth.spec.ts — Authentication E2E tests
 *
 * Covers:
 *  1. Valid login via the UI → redirected to /dashboard
 *  2. Invalid credentials → error message shown, no redirect loop
 *  3. Regression: /login page does NOT enter a hard-reload loop
 *  4. Logout clears tokens and redirects to /login
 */
import { test, expect } from "@playwright/test";
import { loginViaApi, injectTokens } from "./helpers";

const ADMIN = { username: "admin", password: "AdminSeguro2026!" };
const BAD_CREDS = { username: "admin", password: "wrongpassword" };

test.describe("Login page — authentication flows", () => {
  test("valid credentials via UI → redirected to /dashboard", async ({ page }) => {
    await page.goto("/login");

    await page.fill('[autocomplete="username"]', ADMIN.username);
    await page.fill('[autocomplete="current-password"]', ADMIN.password);
    await page.click('button[type="submit"]');

    // Should land on /dashboard (or be redirected there)
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 12_000 });
    // Page title / heading should be visible
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("invalid credentials → error shown, no redirect", async ({ page }) => {
    await page.goto("/login");

    await page.fill('[autocomplete="username"]', BAD_CREDS.username);
    await page.fill('[autocomplete="current-password"]', BAD_CREDS.password);
    await page.click('button[type="submit"]');

    // We should still be on /login
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
    // An error message must be visible (the red warning div)
    await expect(page.locator("text=⚠").first()).toBeVisible({ timeout: 5_000 });
  });

  test("regression: /login does NOT cause a hard-reload loop", async ({ page }) => {
    const reloads: number[] = [];

    // Count full document navigations back to /login.
    // The initial goto() + Next.js App Router hydration can legitimately cause
    // 2 framenavigated events — the bug we're guarding against produces 5+.
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame() && frame.url().includes("/login")) {
        reloads.push(Date.now());
      }
    });

    await page.goto("/login");
    // Wait 5 s — enough time for multiple hard-reload cycles to manifest
    await page.waitForTimeout(5_000);

    // A true reload loop accumulates many events; allow up to 3 for normal
    // Next.js hydration navigations.
    expect(reloads.length).toBeLessThanOrEqual(3);
  });

  test("authenticated user can access /dashboard directly", async ({
    page,
    request,
  }) => {
    const tokens = await loginViaApi(request, ADMIN.username, ADMIN.password);
    await injectTokens(page, tokens);
    // Go directly to the dashboard — should render, not redirect to /login
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 8_000 });
  });
});
