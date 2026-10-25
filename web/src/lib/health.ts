// Deployment check (verification log #27): can this host reach every upstream we read?
export async function check(name: string, run: () => Promise<unknown>) {
  const t = Date.now();
  try {
    return { name, ok: true, value: String(await run()), ms: Date.now() - t };
  } catch (e) {
    console.error(`[health] ${name} failed:`, e); // details stay in the server log: they can contain a keyed RPC URL
    return { name, ok: false, error: "unreachable", ms: Date.now() - t };
  }
}
