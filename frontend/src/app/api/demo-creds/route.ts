import { NextResponse } from "next/server";

/**
 * Server-side route that serves demo account passwords.
 * Credentials are never baked into source — they live in DEMO_CREDS_JSON (server env var).
 *
 * Expected JSON shape in DEMO_CREDS_JSON:
 * {
 *   "platform": ["pass1", "pass2", "pass3", "pass4", "pass5"],
 *   "clients":  ["pass1", "pass2", "pass3", "pass4", "pass5"]
 * }
 */
export async function GET() {
  const raw = process.env.DEMO_CREDS_JSON;
  if (!raw) {
    return NextResponse.json({ platform: [], clients: [] });
  }
  try {
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ platform: [], clients: [] });
  }
}
