import { type NextRequest, NextResponse, after } from "next/server";
import { studioRequest } from "@/lib/studio/service";
import { deliverReviewMail } from "@/lib/studio/mail";
import { StudioError } from "@/lib/studio/protocol";
import { privateHeaders } from "@/lib/studio/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const response = await studioRequest(request, (await context.params).path);
    if (response.ok && request.method === "POST")
      after(async () => {
        await deliverReviewMail({ limit: 3, deadline: Date.now() + 20000 });
      });
    return response;
  } catch (error) {
    const expected = error instanceof StudioError;
    if (!expected) console.error("Stillbounds Studio request failed");
    return NextResponse.json(
      {
        error: expected ? error.message : "Studio is temporarily unavailable.",
      },
      {
        status: expected ? error.status : 503,
        headers: {
          ...privateHeaders,
          ...(expected && error.status === 429 ? { "Retry-After": "5" } : {}),
        },
      },
    );
  }
}
export { handle as GET, handle as POST, handle as DELETE };
