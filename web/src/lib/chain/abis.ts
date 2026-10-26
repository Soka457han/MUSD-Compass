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

// Mezo PriceFeed exposes fetchPrice() (0x0fdb11cf); lastGoodPrice() reverts (checked 24 Oct).
export const priceFeedAbi = parseAbi(["function fetchPrice() view returns (uint256)"]);

export const poolAbi = parseAbi([
  "function getReserves() view returns (uint256 reserve0, uint256 reserve1, uint256 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function stable() view returns (bool)",
]);

export const borrowerOperationsAbi = parseAbi([
  "function minNetDebt() view returns (uint256)",
  "function borrowingRate() view returns (uint256)",
  "function MUSD_GAS_COMPENSATION() view returns (uint256)",
  // mezo-org/musd solidity/contracts/interfaces/IBorrowerOperations.sol: collateral is the BTC sent with the call.
  "function openTrove(uint256 _debtAmount, address _upperHint, address _lowerHint) payable",
]);

export const interestRateManagerAbi = parseAbi(["function interestRate() view returns (uint16)"]);

// getCompoundedMUSDDeposit: mezo-org/musd solidity/contracts/interfaces/IStabilityPool.sol (checked 26 Oct 2026).
export const stabilityPoolAbi = parseAbi([
  "function getTotalMUSDDeposits() view returns (uint256)",
  "function getCompoundedMUSDDeposit(address) view returns (uint256)",
]);

// VaultGauge for sMUSD (verified source on explorer.mezo.org, read 26 Oct): pays MEZO to staked sMUSD.
export const vaultGaugeAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function rewardRate() view returns (uint256)",
  "function periodFinish() view returns (uint256)",
]);

export const erc4626Abi = parseAbi(["function totalAssets() view returns (uint256)"]);

// TroveManager / SortedTroves (mezo-org/musd solidity/contracts, interfaces/ITroveManager.sol, ISortedTroves.sol).
export const troveManagerAbi = parseAbi([
  "function getEntireDebtAndColl(address) view returns (uint256 coll, uint256 principal, uint256 interest, uint256 pendingCollateral, uint256 pendingPrincipal, uint256 pendingInterest)",
  "function getCurrentICR(address, uint256 price) view returns (uint256)",
  "function getNominalICR(address) view returns (uint256)",
  "function getTroveStatus(address) view returns (uint8)",
  "function getTroveInterestRate(address) view returns (uint16)",
  "function getTroveOwnersCount() view returns (uint256)",
  "function getTroveFromTroveOwnersArray(uint256) view returns (address)",
  "function checkRecoveryMode(uint256 price) view returns (bool)",
]);
// Sorted by nominal ICR, descending; redemptions start at getLast() (the lowest ratio).
export const sortedTrovesAbi = parseAbi(["function getFirst() view returns (address)", "function getSize() view returns (uint256)"]);
