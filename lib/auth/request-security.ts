import { NextResponse } from "next/server";

/**
 * These routes are called only by this app's browser client. Requiring the
 * request Origin to match the API origin prevents cross-site form/fetch
 * requests from exchanging codes, refreshing credentials, or signing out.
 */
export function requireSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  try {
    if (new URL(origin).origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  return null;
}

/** Ensures the code exchange uses this browser origin and no untrusted path. */
export function isValidPopupRedirectUri(redirectUri: string, request: Request): boolean {
  try {
    const redirect = new URL(redirectUri);
    const requestOrigin = new URL(request.url).origin;
    return (
      redirect.origin === requestOrigin &&
      redirect.pathname === "/" &&
      !redirect.search &&
      !redirect.hash &&
      !redirect.username &&
      !redirect.password
    );
  } catch {
    return false;
  }
}
