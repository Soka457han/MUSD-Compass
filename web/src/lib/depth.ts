/** How much MUSD a Slipstream concentrated-liquidity pool (token0 mUSDC 6 dec, token1 MUSD 18 dec) absorbs before the
 *  MUSD price (in mUSDC) falls to `floorPrice`. Selling MUSD moves the tick up; crossing tick t upward adds liquidityNet(t). */
const Q96 = 2n ** 96n;
const MAX_STEPS = 50;

export type DepthInput = { sqrtPriceX96: bigint; tick: number; liquidity: bigint; tickSpacing: number; liquidityNet: Map<number, bigint> };

/** shortcut: sqrt at a tick comes from floating point (relative error ~1e-16, about 1e-7 on the MUSD amount); upgrade to TickMath if exact tick maths is ever needed. */
function sqrtAtTick(tick: number): bigint {
  return BigInt(Math.round(Math.pow(1.0001, tick / 2) * 2 ** 96));
}

function isqrt(n: bigint): bigint {
  let x = 1n << (BigInt(n.toString(2).length) / 2n + 1n); // starts above the root, Newton falls to floor(sqrt)
  for (let y = (x + n / x) >> 1n; y < x; y = (x + n / x) >> 1n) x = y;
  return x;
}

const priceAt = (sqrt: bigint) => Number((2n ** 192n * 10n ** 20n) / sqrt ** 2n) / 1e8;

/** Second 32-byte word of a Slipstream `ticks(int24)` return (liquidityNet, int128). The return has 10 words; only this one is read. */
export function decodeLiquidityNet(data: string): bigint {
  if (!/^0x[0-9a-fA-F]{128,}/.test(data)) throw new Error("short ticks() return");
  return BigInt.asIntN(128, BigInt("0x" + data.slice(66, 130)));
}

export function musdSellDepth(input: DepthInput, floorPrice: number): { musd: number; usdc: number; endPrice: number } {
  const floorSqrt = isqrt((2n ** 192n * 10n ** 20n) / BigInt(Math.round(floorPrice * 1e8)));
  let s = input.sqrtPriceX96;
  let liq = input.liquidity;
  let musd = 0n;
  let usdc = 0n;
  let tick = (Math.floor(input.tick / input.tickSpacing) + 1) * input.tickSpacing;
  for (let i = 0; i < MAX_STEPS && s < floorSqrt; i++, tick += input.tickSpacing) {
    const next = sqrtAtTick(tick);
    const to = next < floorSqrt ? next : floorSqrt;
    if (to > s) {
      musd += (liq * (to - s)) / Q96;
      usdc += (liq * Q96 * (to - s)) / (s * to);
      s = to;
    }
    if (s === next) liq += input.liquidityNet.get(tick) ?? 0n;
  }
  return { musd: Number(musd) / 1e18, usdc: Number(usdc) / 1e6, endPrice: priceAt(s) };
}
