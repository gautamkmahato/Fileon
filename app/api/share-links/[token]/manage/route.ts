import { NextResponse } from "next/server";
import { patchStored } from "@/lib/shares/server-store";
import { isShareToken } from "@/lib/shares/token";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!isShareToken(token)) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const manageKey = typeof body.manageKey === "string" ? body.manageKey : "";
  if (!isShareToken(manageKey)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patch: { status?: "active" | "revoked"; expiresAt?: string | null; delete?: boolean } = {};
  if (body.status === "revoked" || body.status === "active") patch.status = body.status;
  if (body.expiresAt === null || typeof body.expiresAt === "string") {
    patch.expiresAt = body.expiresAt as string | null;
  }
  if (body.delete === true) patch.delete = true;

  const ok = await patchStored(token, manageKey, patch);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true });
}
