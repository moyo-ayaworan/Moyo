import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { cleanupStudio } from "@/lib/studio/service";
import { privateHeaders } from "@/lib/studio/security";
import { queueReviewReminders } from "@/lib/studio/engagement";
import { deliverReviewMail } from "@/lib/studio/mail";
export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET,
    supplied = request.headers.get("authorization");
  if (
    !expected ||
    !supplied ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(`Bearer ${expected}`) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(`Bearer ${expected}`))
  )
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: privateHeaders },
    );
  try {
    await queueReviewReminders();
    const mail = await deliverReviewMail({
      limit: 5,
      deadline: Date.now() + 25000,
    });
    await cleanupStudio();
    return NextResponse.json(
      { ok: mail.deferred === 0, ...mail },
      { status: mail.deferred ? 503 : 200, headers: privateHeaders },
    );
  } catch {
    return NextResponse.json(
      { error: "Cleanup unavailable" },
      { status: 503, headers: privateHeaders },
    );
  }
}
