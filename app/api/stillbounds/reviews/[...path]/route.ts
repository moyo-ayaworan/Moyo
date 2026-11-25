import { NextRequest, NextResponse, after } from "next/server";
import { stillboundsAuth } from "@/lib/stillboundsAuth";
import { studioRequest } from "@/lib/studio/service";
import { deliverReviewMail } from "@/lib/studio/mail";
import { studioQuery } from "@/lib/studio/db";
import { assertStudio, StudioError, bodyJSON } from "@/lib/studio/protocol";
import { sameOrigin, privateHeaders, limited } from "@/lib/studio/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await context.params).path;
    assertStudio(
      ["versions", "pair", "connections"].includes(path[0]),
      "Route not found.",
      404,
    );
    const headers = new Headers(request.headers);
    const authorization = headers.get("authorization");
    if (authorization) {
      assertStudio(
        /^Bearer [A-Za-z0-9._~-]{16,4096}$/.test(authorization),
        "Sign in to your Stillbounds account.",
        401,
      );
      headers.delete("cookie");
    } else if (request.method !== "GET") sameOrigin(request);
    const session = await stillboundsAuth().api.getSession({
      headers,
      query: { disableCookieCache: true },
    });
    assertStudio(session?.user, "Sign in to your Stillbounds account.", 401);
    assertStudio(
      session.user.emailVerified === true,
      "Verify your email before publishing reviews.",
      403,
    );
    const workspace = "account:" + session.user.id;
    await studioQuery(
      "INSERT INTO stillbounds_workspace(id) VALUES($1) ON CONFLICT DO NOTHING",
      [workspace],
    );
    if (path[0] === "pair") {
      assertStudio(
        path.length === 1 && request.method === "POST",
        "Route not found.",
        404,
      );
      await limited(request, "account-review-pair-" + workspace, 15, 600);
      const input = await bodyJSON(request);
      assertStudio(
        typeof input.userCode === "string" &&
          /^[A-F0-9]{10}$/.test(input.userCode) &&
          input.confirm === true,
        "Confirm the review connection code shown on your own Mac.",
      );
      const result = await studioQuery(
        `UPDATE stillbounds_pairings SET approved=TRUE,owner_id=$2 WHERE user_code=$1 AND expires_at>NOW() AND consumed=FALSE AND approved=FALSE RETURNING user_code`,
        [input.userCode, workspace],
      );
      assertStudio(
        result.rows.length,
        "Code expired, already approved, or not found.",
        404,
      );
      return NextResponse.json({ ok: true }, { headers: privateHeaders });
    }
    if (path[0] === "connections") {
      assertStudio(
        path.length === 1 && request.method === "DELETE",
        "Route not found.",
        404,
      );
      await studioQuery(
        "UPDATE stillbounds_devices SET revoked=TRUE WHERE owner_id=$1",
        [workspace],
      );
      return NextResponse.json({ ok: true }, { headers: privateHeaders });
    }
    const response = await studioRequest(request, path, workspace);
    if (response.ok && request.method === "POST")
      after(async () => {
        await deliverReviewMail({ limit: 3, deadline: Date.now() + 20000 });
      });
    return response;
  } catch (error) {
    const known = error instanceof StudioError;
    return NextResponse.json(
      {
        error: known
          ? error.message
          : "Reviews are temporarily unavailable. Please try again.",
      },
      { status: known ? error.status : 503, headers: privateHeaders },
    );
  }
}
export { handle as GET, handle as POST, handle as DELETE };
