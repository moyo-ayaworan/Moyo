export function GET() {
  return Response.json(
    { protocol: "mofolio-review-v1", apiBase: "/api/mofolio/studio" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
