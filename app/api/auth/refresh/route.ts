import { NextResponse } from "next/server";
import { refreshAccessToken, revokeGoogleToken } from "@/lib/auth/google-token";
import {
  clearAuthSession,
  getGoogleOAuth,
  isServerAuthConfigured,
  readAuthSession,
} from "@/lib/auth/auth-cookie";

export async function POST() {
  if (!isServerAuthConfigured()) {
    return NextResponse.json({ error: "Server auth is not configured" }, { status: 503 });
  }
  const oauth = getGoogleOAuth();
  if (!oauth) {
    return NextResponse.json({ error: "Google OAuth is not configured" }, { status: 503 });
  }

  const session = await readAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const tokens = await refreshAccessToken({
      refreshToken: session.refreshToken,
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret,
    });

    return NextResponse.json({
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
    });
  } catch (err) {
    console.error("[auth/refresh]", err);
    try {
      await revokeGoogleToken(session.refreshToken);
    } catch {
      /* ignore */
    }
    await clearAuthSession();
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Session expired" },
      { status: 401 },
    );
  }
}
