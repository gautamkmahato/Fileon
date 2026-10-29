import { NextResponse } from "next/server";
import { revokeGoogleToken } from "@/lib/auth/google-token";
import { clearAuthSession, readAuthSession } from "@/lib/auth/auth-cookie";
import { requireSameOrigin } from "@/lib/auth/request-security";

export async function POST(req: Request) {
  const rejected = requireSameOrigin(req);
  if (rejected) return rejected;

  const session = await readAuthSession();
  if (session?.refreshToken) {
    try {
      await revokeGoogleToken(session.refreshToken);
    } catch {
      /* ignore */
    }
  }
  await clearAuthSession();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
