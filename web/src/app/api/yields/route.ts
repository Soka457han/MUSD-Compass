import { allow } from "@/lib/rateLimit";
import { loadSources } from "@/lib/sources";
import { buildYields, parseQuery } from "@/lib/yields";

// Source data is cached for 5 minutes (use cache: remote); a cold refresh scans 34 log windows, about 40 s on 4 Nov 2026.
// 300 s is the Hobby limit with Fluid compute: a cold fill cut off at 60 s never saved its cache, so every visit failed.
// Docs: https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration
export const maxDuration = 300;

const CORS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" };

export async function GET(req: Request) {
  if (!allow(req)) return Response.json({ error: "Too many requests — try again in a minute." }, { status: 429, headers: CORS });
  const parsed = parseQuery(new URL(req.url).searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400, headers: CORS });
  const sources = await loadSources();
  return Response.json(buildYields(sources, parsed.query), { headers: CORS });
}
