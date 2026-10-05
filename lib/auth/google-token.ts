const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
  refresh_token?: string;
}

export async function exchangeAuthorizationCode(opts: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  }
  return JSON.parse(text) as GoogleTokenResponse;
}

export async function refreshAccessToken(opts: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    refresh_token: opts.refreshToken,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google token refresh failed (${res.status}): ${text}`);
  }
  return JSON.parse(text) as GoogleTokenResponse;
}

export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}
