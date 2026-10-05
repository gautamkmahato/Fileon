import { NextResponse } from "next/server";
import { revokeGoogleToken } from "@/lib/auth/google-token";
import { clearAuthSession, readAuthSession } from "@/lib/auth/auth-cookie";

export async function POST() {
  const session = await readAuthSession();
  if (session?.refreshToken) {
    try {
      await revokeGoogleToken(session.refreshToken);
    } catch {
      /* ignore */
    }
  }
  await clearAuthSession();
  return NextResponse.json({ ok: true });
}
