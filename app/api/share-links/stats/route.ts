import { NextResponse } from "next/server";
import { statsFor } from "@/lib/shares/server-store";
import { isShareToken } from "@/lib/shares/token";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let tokens: unknown;
  try {
    const body = await req.json();
    tokens = body?.tokens;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(tokens)) {
    return NextResponse.json({ counts: {} });
  }
  const list = tokens.filter((t): t is string => typeof t === "string" && isShareToken(t)).slice(0, 200);
  const counts = await statsFor(list);
  return NextResponse.json({ counts });
}
