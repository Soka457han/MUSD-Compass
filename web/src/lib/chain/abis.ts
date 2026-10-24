import { parseAbi } from "viem";

// Minimal ABIs; selectors were checked against live contracts on 24 Oct 2026 (design §15).
export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export const smusdAbi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function claimYield() returns (uint256)",
  "event ProtocolYieldReceived(uint256 amount)",
  "event StrategyYieldReceived(uint256 amount)",
]);

export const priceFeedAbi = parseAbi(["function lastGoodPrice() view returns (uint256)"]);

export const poolAbi = parseAbi([
  "function getReserves() view returns (uint256 reserve0, uint256 reserve1, uint256 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function stable() view returns (bool)",
]);
