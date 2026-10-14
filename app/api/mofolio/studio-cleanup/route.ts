import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { cleanupStudio } from "@/lib/studio/service";
import { privateHeaders } from "@/lib/studio/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET,
    supplied = request.headers.get("authorization");
  if (
    !expected ||
    !supplied ||
    supplied.length !== `Bearer ${expected}`.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(`Bearer ${expected}`))
  )
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: privateHeaders },
    );
  try {
    await cleanupStudio();
    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  } catch {
    return NextResponse.json(
      { error: "Cleanup unavailable" },
      { status: 503, headers: privateHeaders },
    );
  }
}
