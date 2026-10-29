import { NextResponse } from "next/server";
import { GoogleTokenError, refreshAccessToken } from "@/lib/auth/google-token";
import {
  clearAuthSession,
  getGoogleOAuth,
  isServerAuthConfigured,
  readAuthSession,
} from "@/lib/auth/auth-cookie";
import { requireSameOrigin } from "@/lib/auth/request-security";

export async function POST(req: Request) {
  const rejected = requireSameOrigin(req);
  if (rejected) return rejected;

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

    return NextResponse.json(
      { access_token: tokens.access_token, expires_in: tokens.expires_in },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[auth/refresh] token refresh failed", err);
    // `invalid_grant` means Google has revoked or expired the refresh token.
    // Network and Google 5xx errors are temporary, so preserve the session.
    if (err instanceof GoogleTokenError && err.code === "invalid_grant") {
      await clearAuthSession();
      return NextResponse.json(
        { error: "Your Google session has expired. Please sign in again." },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: "Unable to refresh the Google session. Please try again." },
      { status: 503 },
    );
  }
}
