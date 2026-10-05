import { NextResponse } from "next/server";
import { exchangeAuthorizationCode } from "@/lib/auth/google-token";
import { clearAuthSession, getGoogleOAuth, isServerAuthConfigured, writeAuthSession } from "@/lib/auth/auth-cookie";

export async function POST(req: Request) {
  if (!isServerAuthConfigured()) {
    return NextResponse.json({ error: "Server auth is not configured" }, { status: 503 });
  }
  const oauth = getGoogleOAuth();
  if (!oauth) {
    return NextResponse.json({ error: "Google OAuth is not configured" }, { status: 503 });
  }

  let body: { code?: string; redirectUri?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { code, redirectUri } = body;
  if (!code || !redirectUri) {
    return NextResponse.json({ error: "code and redirectUri are required" }, { status: 400 });
  }

  try {
    const tokens = await exchangeAuthorizationCode({
      code,
      redirectUri,
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret,
    });

    if (!tokens.refresh_token) {
      return NextResponse.json(
        { error: "No refresh token returned. Try signing out of Google and sign in again." },
        { status: 400 },
      );
    }

    await writeAuthSession(tokens.refresh_token);

    return NextResponse.json({
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
    });
  } catch (err) {
    console.error("[auth/google]", err);
    await clearAuthSession();
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sign-in failed" },
      { status: 401 },
    );
  }
}
