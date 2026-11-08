// Usage: node scripts/speed-check.mjs [baseUrl]   (default https://musd-compass.vercel.app)
// One untimed warm-up per path, then 5 timed runs reading the full body. Exit 1 if a median is over budget.
const base = (process.argv[2] ?? "https://musd-compass.vercel.app").replace(/\/$/, "");
const paths = ["/", "/vault", "/my", "/stats", "/api/yields"];
const budget = (p) => (p.startsWith("/api/") ? 3000 : 2000);
const get = async (url) => {
  const t = performance.now();
  const r = await fetch(url);
  await r.arrayBuffer();
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return performance.now() - t;
};
let fail = false;
console.log(`Speed check: ${base}`);
for (const p of paths) {
  const url = (n) => base + p + (p.startsWith("/api/") ? `?warm=1&t=${n}` : "");
  const times = [];
  try {
    await get(url(0));
    for (let i = 1; i <= 5; i++) times.push(await get(url(i)));
  } catch (e) {
    console.log(`${p.padEnd(14)} ERROR ${e.message}`);
    fail = true;
    continue;
  }
  times.sort((a, b) => a - b);
  const med = times[2], max = times[4], over = med > budget(p);
  fail ||= over;
  console.log(`${p.padEnd(14)} median ${med.toFixed(0).padStart(5)} ms  max ${max.toFixed(0).padStart(5)} ms  budget ${budget(p)} ms  ${over ? "OVER" : "ok"}`);
}
process.exit(fail ? 1 : 0);
