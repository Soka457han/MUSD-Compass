// Contract addresses (design §14; official deployment files in mezo-org/musd, checked 24 Oct 2026).
export const MAINNET = {
  musd: "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186",
  smusd: "0xb4D498029af77680cD1eF828b967f010d06C51CC",
  smusdGauge: "0x677817bf3e44b90e8f95222f75e2950b7904a401",
  stabilityPool: "0x73245Eff485aB3AAc1158B3c4d8f4b23797B0e32",
  troveManager: "0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193",
  priceFeed: "0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88",
  sortedTroves: "0x8C5DB4C62BF29c1C4564390d10c20a47E0b2749f",
  borrowerOperations: "0x44b1bac67dDA612a41a58AAf779143B181dEe031",
  interestRateManager: "0x4a453700d157717fe02fb62e7700ed7845048285",
  btc: "0x7b7C000000000000000000000000000000000000",
  merklVeMezo: "0x089A6af90041c3ac734cbdeFa84832Aa7fBF67C8",
  pools: {
    musdBtc: "0x52e604c44417233b6CcEDDDc0d640A405Caacefb",
    musdMusdc: "0xEd812AEc0Fecc8fD882Ac3eccC43f3aA80A6c356",
    musdMusdt: "0x10906a9E9215939561597b4C8e4b98F93c02031A",
  },
} as const;

export const TESTNET = {
  musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
  smusd: "0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16",
  stabilityPool: "0x1CCA7E410eE41739792eA0A24e00349Dd247680e",
  troveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  priceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
  sortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
  borrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
} as const;

export const ETHEREUM = {
  musd: "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186",
  curveMusd2pool: "0xB5571E76693ba60110B5811DD650FFefce1C955f",
  morphoAlphaMusdCore: "0xda4D1A3187Eba9Ecaa137867bD4541f78D51638e",
} as const;

/** Public sample addresses for "Try a sample" (design §5.5). */
export const SAMPLES = {
  devWallet: "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C",
  rewards: "0xeaC6A75e19beB1283352d24c0311De865a867DAB",
} as const;
