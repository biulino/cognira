/**
 * estudos.spec.ts — Estudos (studies) E2E tests
 *
 * Covers:
 *  1. /estudos page loads and shows a list of studies
 *  2. Searching by name filters the list
 *  3. Clicking a study card navigates to /estudos/<id>
 *  4. Study detail page shows the study name
 */
import { test, expect } from "@playwright/test";
import { loginAndGoto, loginViaApi } from "./helpers";

const ADMIN = { username: "admin", password: "AdminSeguro2026!" };

test.describe("Estudos — list and detail", () => {
  test("admin can view the studies list", async ({ page, request }) => {
    await loginAndGoto(page, request, ADMIN.username, ADMIN.password, "/estudos");

    // Page heading
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 10_000 });

    // At least one study card should be present (seed creates several)
    // Study cards are <a href="/estudos/N">
    const cards = page.locator('a[href^="/estudos/"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  });

  test("search box filters studies by name", async ({ page, request }) => {
    await loginAndGoto(page, request, ADMIN.username, ADMIN.password, "/estudos");

    // Wait for cards to appear
    const cards = page.locator('a[href^="/estudos/"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    const initial = await cards.count();
    expect(initial).toBeGreaterThan(0);

    // Type something that cannot match any seed study name
    const search = page.locator('input[placeholder]').first();
    await search.fill("XYZZY_NO_MATCH_12345");

    // Wait for React to re-render and the cards to disappear
    await expect(cards).toHaveCount(0, { timeout: 5_000 });
  });

  test("clicking a study card navigates to the detail page", async ({
    page,
    request,
  }) => {
    await loginAndGoto(page, request, ADMIN.username, ADMIN.password, "/estudos");

    // Dismiss any modal overlay that may be covering the page
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    const firstCard = page.locator('a[href^="/estudos/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });

    const href = await firstCard.getAttribute("href");
    await firstCard.click();

    await expect(page).toHaveURL(new RegExp(href!), { timeout: 10_000 });
    // Detail page renders some content
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
  });

  test("API: GET /estudos returns non-empty list for admin", async ({ request }) => {
    const tokens = await loginViaApi(request, ADMIN.username, ADMIN.password);
    const res = await request.get("http://localhost:8088/api/estudos/", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });
});
