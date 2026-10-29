const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
  refresh_token?: string;
}

export class GoogleTokenError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

async function requestGoogleToken(body: URLSearchParams): Promise<GoogleTokenResponse> {
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    throw new GoogleTokenError("Google token service is unavailable", undefined, true);
  }

  const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const code = typeof payload?.error === "string" ? payload.error : undefined;
    throw new GoogleTokenError("Google token request was rejected", code, res.status >= 500);
  }
  if (
    !payload ||
    typeof payload.access_token !== "string" ||
    !payload.access_token ||
    typeof payload.expires_in !== "number" ||
    !Number.isFinite(payload.expires_in) ||
    payload.expires_in <= 0 ||
    payload.token_type !== "Bearer"
  ) {
    throw new GoogleTokenError("Google returned an invalid token response", undefined, true);
  }

  return {
    access_token: payload.access_token,
    expires_in: payload.expires_in,
    token_type: payload.token_type,
    scope: typeof payload.scope === "string" ? payload.scope : undefined,
    refresh_token: typeof payload.refresh_token === "string" ? payload.refresh_token : undefined,
  };
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
  return requestGoogleToken(body);
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
  return requestGoogleToken(body);
}

export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}
