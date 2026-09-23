import { NextResponse } from "next/server";
import { getStored, toPublic, upsertStored, type StoredShareLink } from "@/lib/shares/server-store";
import { isShareToken } from "@/lib/shares/token";

export const runtime = "nodejs";

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!isShareToken(token)) return bad(400, "Invalid link");
  const row = await getStored(token);
  if (!row) return bad(404, "Not found");
  return NextResponse.json(toPublic(row));
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!isShareToken(token)) return bad(400, "Invalid link");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad(400, "Invalid JSON");
  }

  const manageKey = typeof body.manageKey === "string" ? body.manageKey : "";
  if (!isShareToken(manageKey)) return bad(400, "Invalid key");

  const fileId = typeof body.fileId === "string" ? body.fileId.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  if (!fileId || !fileName) return bad(400, "Missing file");

  const row: StoredShareLink = {
    token,
    manageKey,
    userId: typeof body.userId === "string" ? body.userId.slice(0, 128) : "",
    fileId: fileId.slice(0, 128),
    fileName: fileName.slice(0, 1024),
    mimeType: typeof body.mimeType === "string" ? body.mimeType.slice(0, 256) : "application/octet-stream",
    status: body.status === "revoked" ? "revoked" : "active",
    expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : null,
    allowDownload: body.allowDownload !== false,
    viewCount: Number(body.viewCount) || 0,
    downloadCount: Number(body.downloadCount) || 0,
    revokedAt: typeof body.revokedAt === "string" ? body.revokedAt : null,
  };

  try {
    const saved = await upsertStored(token, row);
    return NextResponse.json(toPublic(saved));
  } catch {
    return bad(403, "Forbidden");
  }
}
