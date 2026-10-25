#!/usr/bin/env bash
# p50/p95 response time of a cached endpoint. Usage: scripts/latency.sh [url] [requests]
# Target (tasks/todo.md T14): p95 < 1.5 s on cached /api/yields.
set -euo pipefail
URL="${1:-https://musd-compass.vercel.app/api/yields?amount=2000}"
N="${2:-20}"
curl -fsS -o /dev/null "$URL"  # warm the cache first; that request is not counted
for _ in $(seq "$N"); do curl -fsS -o /dev/null -w '%{time_total}\n' "$URL"; done | sort -n | awk -v n="$N" '
  { t[NR] = $1 }
  END {
    p50 = t[int((n + 1) * 0.50)]; p95 = t[int(n * 0.95 + 0.999)]
    printf "requests %d  p50 %.3fs  p95 %.3fs  max %.3fs\n", n, p50, p95, t[n]
    exit (p95 < 1.5 ? 0 : 1)
  }'
