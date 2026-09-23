import { NextResponse } from "next/server";
import { getStored, hitStored, toPublic } from "@/lib/shares/server-store";
import { isShareToken } from "@/lib/shares/token";
import { isLinkAccessible } from "@/lib/shares/status";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!isShareToken(token)) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }
  let kind: "view" | "download" = "view";
  try {
    const body = await req.json();
    if (body?.kind === "download") kind = "download";
  } catch {
    /* default view */
  }

  const existing = await getStored(token);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isLinkAccessible(existing)) {
    return NextResponse.json(toPublic(existing), { status: 410 });
  }

  const next = await hitStored(token, kind);
  if (!next) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    viewCount: next.viewCount,
    downloadCount: next.downloadCount,
  });
}
