import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Picker credentials for a signed-in user.
 * Kept off the client bundle. Google's Picker still receives them in the
 * browser when it opens, so the API key must stay restricted to the Picker
 * API and this site's origins.
 */
export async function GET(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token || !(await isOurGoogleToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_PICKER_API_KEY;
  const appId = process.env.GOOGLE_PICKER_APP_ID;
  if (!apiKey || !appId) {
    return NextResponse.json({ error: "Picker is not configured" }, { status: 503 });
  }

  return NextResponse.json(
    { apiKey, appId },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/** Token must be a live Google access token issued for this app's OAuth client. */
async function isOurGoogleToken(token: string): Promise<boolean> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return false;
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
    );
    if (!res.ok) return false;
    const info = (await res.json()) as { aud?: string; azp?: string };
    return info.aud === clientId || info.azp === clientId;
  } catch {
    return false;
  }
}
