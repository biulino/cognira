/**
 * helpers.ts — shared utilities for E2E tests
 *
 * loginViaApi()  — call /auth/login directly and inject tokens into
 *                  localStorage so the frontend recognises the session.
 */
import { Page, APIRequestContext } from "@playwright/test";

const BASE_URL = "http://localhost:8088";
const API_BASE = `${BASE_URL}/api`;

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

/** POST /auth/login and return the token pair. */
export async function loginViaApi(
  request: APIRequestContext,
  username: string,
  password: string
): Promise<TokenPair> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { username, password },
  });
  if (!res.ok()) {
    throw new Error(
      `loginViaApi failed: ${res.status()} ${await res.text()}`
    );
  }
  return res.json() as Promise<TokenPair>;
}

/** Inject tokens into localStorage so Next.js treats the page as authenticated.
 *  Also pre-marks the OnboardingWizard as completed so it doesn't overlay the
 *  page and block pointer events during tests.
 */
export async function injectTokens(page: Page, tokens: TokenPair) {
  await page.addInitScript((t: TokenPair) => {
    localStorage.setItem("access_token", t.access_token);
    localStorage.setItem("refresh_token", t.refresh_token);
    // Suppress the once-per-browser onboarding overlay
    localStorage.setItem("onboarding_v2_done", "1");
  }, tokens);
}

/** Convenience: login via API then navigate to a URL with tokens pre-loaded. */
export async function loginAndGoto(
  page: Page,
  request: APIRequestContext,
  username: string,
  password: string,
  path: string
) {
  const tokens = await loginViaApi(request, username, password);
  await injectTokens(page, tokens);
  await page.goto(path);
}
