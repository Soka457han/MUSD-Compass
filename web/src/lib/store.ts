// Upstash Redis over REST. Every failure path resolves to null so callers degrade to a no-op.
type Arg = string | number;

const conf = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
};

export const storeConfigured = (): boolean => conf() !== null;

async function post(path: string, body: unknown): Promise<unknown | null> {
  const c = conf();
  if (!c) return null;
  try {
    const res = await fetch(c.url + path, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function redis(...cmd: Arg[]): Promise<unknown | null> {
  const j = (await post("", cmd)) as { result?: unknown; error?: string } | null;
  return j && !j.error ? (j.result ?? null) : null;
}

export async function pipeline(cmds: Arg[][]): Promise<unknown[] | null> {
  const j = await post("/pipeline", cmds);
  if (!Array.isArray(j)) return null;
  return j.map((x: { result?: unknown; error?: string }) => (x && !x.error ? (x.result ?? null) : null));
}
