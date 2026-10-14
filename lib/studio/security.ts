import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { studioQuery } from "./db";
import { assertStudio, hash, OWNER } from "./protocol";
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
export function studioOrigin(request: Request) {
  // Next's standalone server may expose an internal localhost URL. The HTTP Host
  // identifies the site the browser actually visited; browsers cannot forge it.
  const fallback = new URL(request.url);
  const host = request.headers.get("host") || fallback.host;
  const protocol =
    request.headers.get("x-forwarded-proto") === "https"
      ? "https:"
      : fallback.protocol;
  const origin = new URL(protocol + "//" + host);
  assertStudio(
    !origin.username && !origin.password && origin.host === host.toLowerCase(),
    "Invalid website host.",
  );
  return origin.origin;
}
export function sameOrigin(request: Request) {
  assertStudio(
    request.headers.get("origin") === studioOrigin(request),
    "Request origin rejected.",
    403,
  );
  assertStudio(
    !request.headers.get("sec-fetch-site") ||
      request.headers.get("sec-fetch-site") === "same-origin",
    "Request origin rejected.",
    403,
  );
}
export function admin(request: NextRequest, mutate = false) {
  const denied = requireAdmin(request);
  assertStudio(!denied, "Sign in to Moyo admin first.", denied?.status || 401);
  if (mutate) sameOrigin(request);
}
export async function device(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  assertStudio(token, "Connect your authorised Stillbounds device.", 401);
  const { rows } = await studioQuery(
    "SELECT id FROM stillbounds_devices WHERE token_hash=$1 AND owner_id=$2 AND revoked=FALSE AND expires_at>NOW()",
    [hash(token), OWNER],
  );
  assertStudio(
    rows.length,
    "Device access expired or was revoked. Connect again.",
    401,
  );
  return rows[0].id as string;
}
export async function limited(
  request: Request,
  action: string,
  count: number,
  seconds: number,
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = hash(`${action}:${ip}`);
  const { rows } = await studioQuery(
    `INSERT INTO stillbounds_limits(key,hits,since) VALUES($1,1,NOW())
  ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN stillbounds_limits.since<NOW()-($2::int*INTERVAL '1 second') THEN 1 ELSE stillbounds_limits.hits+1 END,
  since=CASE WHEN stillbounds_limits.since<NOW()-($2::int*INTERVAL '1 second') THEN NOW() ELSE stillbounds_limits.since END RETURNING hits`,
    [key, seconds],
  );
  assertStudio(
    rows[0].hits <= count,
    "Too many requests. Please try again later.",
    429,
  );
}
export async function viewer(request: NextRequest, id: string) {
  const token = request.cookies.get(`sb-review-${id}`)?.value;
  assertStudio(
    token && /^[A-Za-z0-9_-]{43}$/.test(token),
    "Enter your private review access code.",
    401,
  );
  const { rows } = await studioQuery(
    `SELECT v.* FROM stillbounds_versions v JOIN stillbounds_viewers s ON s.version_id=v.id
   WHERE v.id=$1 AND s.token_hash=$2 AND s.expires_at>NOW() AND v.state='published' AND v.expires_at>NOW()`,
    [id, hash(token)],
  );
  assertStudio(rows.length, "This review is unavailable or has expired.", 401);
  return rows[0];
}
