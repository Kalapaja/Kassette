export interface TokenConfig {
  chainId: number;
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  logoUrl: string;
  priceUsd?: number;
}

// Native token placeholder address (used for ETH, MATIC, BNB, etc.)
export const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as `0x${string}`;

// CoinGecko logo URLs keyed by symbol
const LOGOS: Record<string, string> = {
  ETH: "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png",
  WETH: "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png",
  USDC: "https://coin-images.coingecko.com/coins/images/6319/large/USDC.png",
  USDT: "https://coin-images.coingecko.com/coins/images/325/large/Tether.png",
  fUSDT: "https://coin-images.coingecko.com/coins/images/325/large/Tether.png",
  DAI: "https://coin-images.coingecko.com/coins/images/9956/large/Badge_Dai.png",
  WBTC: "https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png",
  MATIC: "https://coin-images.coingecko.com/coins/images/4713/large/polygon.png",
  WMATIC: "https://coin-images.coingecko.com/coins/images/4713/large/polygon.png",
  LINK: "https://coin-images.coingecko.com/coins/images/877/large/Chainlink_Logo_500.png",
  UNI: "https://coin-images.coingecko.com/coins/images/12504/large/uniswap-logo.png",
  AAVE: "https://coin-images.coingecko.com/coins/images/12645/large/aave-token-round.png",
  MKR: "https://coin-images.coingecko.com/coins/images/1364/large/Mark_Maker.png",
  stETH: "https://coin-images.coingecko.com/coins/images/13442/large/steth_logo.png",
  cbETH: "https://coin-images.coingecko.com/coins/images/27008/large/cbeth.png",
  CRV: "https://coin-images.coingecko.com/coins/images/12124/large/Curve.png",
  LDO: "https://coin-images.coingecko.com/coins/images/13573/large/Lido_DAO.png",
  FRAX: "https://coin-images.coingecko.com/coins/images/13422/large/LFRAX.png",
  BUSD: "https://coin-images.coingecko.com/coins/images/9576/large/BUSDLOGO.jpg",
  "1INCH": "https://coin-images.coingecko.com/coins/images/13469/large/1inch-logo.jpeg",
  SNX: "https://coin-images.coingecko.com/coins/images/3406/large/SNX.png",
  PEPE: "https://coin-images.coingecko.com/coins/images/29850/large/pepe-token.jpeg",
  BNB: "https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
  WBNB: "https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
  BTCB: "https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png",
  CAKE: "https://coin-images.coingecko.com/coins/images/12632/large/pancakeswap-cake-logo_%281%29.png",
  ADA: "https://coin-images.coingecko.com/coins/images/975/large/cardano.png",
  XRP: "https://coin-images.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png",
  LTC: "https://coin-images.coingecko.com/coins/images/2/large/litecoin.png",
  DOT: "https://coin-images.coingecko.com/coins/images/12171/large/polkadot.jpg",
  AVAX: "https://coin-images.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png",
  WAVAX: "https://coin-images.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png",
  ARB: "https://coin-images.coingecko.com/coins/images/16547/large/arb.jpg",
  GMX: "https://coin-images.coingecko.com/coins/images/18323/large/arbit.png",
  MAGIC: "https://coin-images.coingecko.com/coins/images/18623/large/magic.png",
  MAI: "https://coin-images.coingecko.com/coins/images/15264/large/mimatic-red.png",
  miMATIC: "https://coin-images.coingecko.com/coins/images/15264/large/mimatic-red.png",
  wstETH: "https://coin-images.coingecko.com/coins/images/18834/large/wstETH.png",
  rETH: "https://coin-images.coingecko.com/coins/images/20764/large/reth.png",
  "BTC.b": "https://coin-images.coingecko.com/coins/images/26115/large/btcb.png",
  sAVAX: "https://coin-images.coingecko.com/coins/images/23657/large/savax_blue.png",
  JOE: "https://coin-images.coingecko.com/coins/images/17569/large/LFJ_JOE_Logo.png",
  EUROC: "https://coin-images.coingecko.com/coins/images/26045/large/euro-coin.png",
  OP: "https://coin-images.coingecko.com/coins/images/25244/large/Optimism.png",
  KWENTA: "https://coin-images.coingecko.com/coins/images/27409/large/kwenta.png",
  BOB: "https://coin-images.coingecko.com/coins/images/29929/large/bob.png",
  FTM: "https://coin-images.coingecko.com/coins/images/4001/large/Fantom_round.png",
  WFTM: "https://coin-images.coingecko.com/coins/images/4001/large/Fantom_round.png",
  TOMB: "https://coin-images.coingecko.com/coins/images/16133/large/tomb_icon_noBG.png",
  SPIRIT: "https://coin-images.coingecko.com/coins/images/15118/large/spirit_swap.png",
  BOO: "https://coin-images.coingecko.com/coins/images/15223/large/logo_200x200.png",
  SPELL: "https://coin-images.coingecko.com/coins/images/15861/large/abracadabra-3.png",
  YFI: "https://coin-images.coingecko.com/coins/images/11849/large/yearn.jpg",
  xDAI: "https://coin-images.coingecko.com/coins/images/9956/large/Badge_Dai.png",
  WXDAI: "https://coin-images.coingecko.com/coins/images/9956/large/Badge_Dai.png",
  GNO: "https://coin-images.coingecko.com/coins/images/662/large/logo_square_simple_300px.png",
  SAFE: "https://coin-images.coingecko.com/coins/images/27032/large/Artboard_1_copy_8circle-1.png",
  COW: "https://coin-images.coingecko.com/coins/images/24384/large/CoW-token_logo.png",
  GRT: "https://coin-images.coingecko.com/coins/images/13397/large/Graph_Token.png",
  AGVE: "https://coin-images.coingecko.com/coins/images/14146/large/agve.png",
  COMP: "https://coin-images.coingecko.com/coins/images/10775/large/COMP.png",
  BAL: "https://coin-images.coingecko.com/coins/images/11683/large/Balancer.png",
  EURS: "https://coin-images.coingecko.com/coins/images/5164/large/EURS_300x300.png",
  QI: "https://coin-images.coingecko.com/coins/images/16362/large/GergDDN3_400x400.jpg",
  TUSD: "https://coin-images.coingecko.com/coins/images/3449/large/tusd.png",
  DPI: "https://coin-images.coingecko.com/coins/images/12465/large/defi_pulse_index_set.png",
  USDbC: "https://coin-images.coingecko.com/coins/images/31164/large/baseusdc.jpg",
  cbBTC: "https://coin-images.coingecko.com/coins/images/40143/large/cbbtc.webp",
  AERO: "https://coin-images.coingecko.com/coins/images/31745/large/token.png",
  EXTRA: "https://coin-images.coingecko.com/coins/images/30973/large/Ex_logo-white-blue_ring_288x.png",
  PRIME: "https://coin-images.coingecko.com/coins/images/29053/large/prime-logo-small-border_%282%29.png",
  tBTC: "https://coin-images.coingecko.com/coins/images/11224/large/0x18084fba666a33d37592fa2633fd49a74dd93a88.png",
  weETH: "https://coin-images.coingecko.com/coins/images/33033/large/weETH.png",
  eUSD: "https://coin-images.coingecko.com/coins/images/28445/large/eUSD.png",
  BRETT: "https://coin-images.coingecko.com/coins/images/35529/large/1000050750.png",
  WELL: "https://coin-images.coingecko.com/coins/images/23914/large/moonwell-logo-200px.png",
  ezETH: "https://coin-images.coingecko.com/coins/images/34753/large/Ezeth_logo_circle.png",
  nETH: "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png",
  iZi: "https://coin-images.coingecko.com/coins/images/21791/large/izumi-logo-symbol.png",
  RAM: "https://coin-images.coingecko.com/coins/images/29420/large/newram.png",
  APE: "https://coin-images.coingecko.com/coins/images/24383/large/APECOIN.png",
  S: "https://coin-images.coingecko.com/coins/images/38108/large/200x200_Sonic_Logo.png",
  wS: "https://coin-images.coingecko.com/coins/images/52857/large/wrapped_sonic.png",
  stS: "https://coin-images.coingecko.com/coins/images/52937/large/token-beets-staked-sonic.png",
  scUSD: "https://coin-images.coingecko.com/coins/images/53456/large/scusd_%281%29.png",
  BEETS: "https://coin-images.coingecko.com/coins/images/53249/large/beets.png",
  EQUAL: "https://coin-images.coingecko.com/coins/images/25661/large/equalizer.png",
  BRUSH: "https://coin-images.coingecko.com/coins/images/18579/large/ps_logo_200x200.png",
  SHADOW: "https://coin-images.coingecko.com/coins/images/53747/large/tokenbg.png",
  SILO: "https://coin-images.coingecko.com/coins/images/21454/large/SILO_%281%29.png",
  SWPX: "https://coin-images.coingecko.com/coins/images/53530/large/IMG_6986.jpeg",
  SWPx: "https://coin-images.coingecko.com/coins/images/53530/large/IMG_6986.jpeg",
  MIGGLES: "https://coin-images.coingecko.com/coins/images/38274/large/miggles.png",
};

/**
 * Resolve logo URL for a token symbol.
 * Falls back to base symbol (strips .e / .b suffixes) then to empty string.
 */
function logo(symbol: string): string {
  if (symbol in LOGOS) return LOGOS[symbol];
  const base = symbol.replace(/\.[a-z]+$/i, "");
  if (base in LOGOS) return LOGOS[base];
  return "";
}

// --- Ethereum (1) ---
const ETHEREUM_TOKENS: TokenConfig[] = [
  { chainId: 1, address: NATIVE_TOKEN_ADDRESS, symbol: "ETH", decimals: 18, logoUrl: logo("ETH") },
  { chainId: 1, address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6, logoUrl: logo("USDC") },
  { chainId: 1, address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6, logoUrl: logo("USDT") },
  { chainId: 1, address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", decimals: 18, logoUrl: logo("DAI") },
  { chainId: 1, address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18, logoUrl: logo("WETH") },
  { chainId: 1, address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", decimals: 8, logoUrl: logo("WBTC") },
  { chainId: 1, address: "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0", symbol: "MATIC", decimals: 18, logoUrl: logo("MATIC") },
  { chainId: 1, address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", symbol: "LINK", decimals: 18, logoUrl: logo("LINK") },
  { chainId: 1, address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", symbol: "UNI", decimals: 18, logoUrl: logo("UNI") },
  { chainId: 1, address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", symbol: "AAVE", decimals: 18, logoUrl: logo("AAVE") },
  { chainId: 1, address: "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2", symbol: "MKR", decimals: 18, logoUrl: logo("MKR") },
  { chainId: 1, address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", symbol: "stETH", decimals: 18, logoUrl: logo("stETH") },
  { chainId: 1, address: "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704", symbol: "cbETH", decimals: 18, logoUrl: logo("cbETH") },
  { chainId: 1, address: "0xD533a949740bb3306d119CC777fa900bA034cd52", symbol: "CRV", decimals: 18, logoUrl: logo("CRV") },
  { chainId: 1, address: "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32", symbol: "LDO", decimals: 18, logoUrl: logo("LDO") },
  { chainId: 1, address: "0x853d955aCEf822Db058eb8505911ED77F175b99e", symbol: "FRAX", decimals: 18, logoUrl: logo("FRAX") },
  { chainId: 1, address: "0x4Fabb145d64652a948d72533023f6E7A623C7C53", symbol: "BUSD", decimals: 18, logoUrl: logo("BUSD") },
  { chainId: 1, address: "0x111111111117dC0aa78b770fA6A738034120C302", symbol: "1INCH", decimals: 18, logoUrl: logo("1INCH") },
  { chainId: 1, address: "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F", symbol: "SNX", decimals: 18, logoUrl: logo("SNX") },
  { chainId: 1, address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933", symbol: "PEPE", decimals: 18, logoUrl: logo("PEPE") },
];

// --- Polygon (137) ---
const POLYGON_TOKENS: TokenConfig[] = [
  { chainId: 137, address: NATIVE_TOKEN_ADDRESS, symbol: "MATIC", decimals: 18, logoUrl: logo("MATIC") },
  { chainId: 137, address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC", decimals: 6, logoUrl: logo("USDC") },
  { chainId: 137, address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", symbol: "USDC.e", decimals: 6, logoUrl: logo("USDC.e") },
  { chainId: 137, address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT", decimals: 6, logoUrl: logo("USDT") },
  { chainId: 137, address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", symbol: "DAI", decimals: 18, logoUrl: logo("DAI") },
  { chainId: 137, address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", symbol: "WETH", decimals: 18, logoUrl: logo("WETH") },
  { chainId: 137, address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", symbol: "WMATIC", decimals: 18, logoUrl: logo("WMATIC") },
  { chainId: 137, address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", symbol: "WBTC", decimals: 8, logoUrl: logo("WBTC") },
  { chainId: 137, address: "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39", symbol: "LINK", decimals: 18, logoUrl: logo("LINK") },
  { chainId: 137, address: "0xb33EaAd8d922B1083446DC23f610c2567fB5180f", symbol: "UNI", decimals: 18, logoUrl: logo("UNI") },
  { chainId: 137, address: "0xD6DF932A45C0f255f85145f286eA0b292B21C90B", symbol: "AAVE", decimals: 18, logoUrl: logo("AAVE") },
  { chainId: 137, address: "0x172370d5Cd63279eFa6d502DAB29171933a610AF", symbol: "CRV", decimals: 18, logoUrl: logo("CRV") },
  { chainId: 137, address: "0x2e1AD108fF1D8C782fcBbB89AAd783aC49586756", symbol: "TUSD", decimals: 18, logoUrl: logo("TUSD") },
  { chainId: 137, address: "0xa3Fa99A148fA48D14Ed51d610c367C61876997F1", symbol: "miMATIC", decimals: 18, logoUrl: logo("miMATIC") },
  { chainId: 137, address: "0x45c32fA6DF82ead1e2EF74d17b76547EDdFaFF89", symbol: "FRAX", decimals: 18, logoUrl: logo("FRAX") },
  { chainId: 137, address: "0xE111178A87A3BFf0c8d18DECBa5798827539Ae99", symbol: "EURS", decimals: 2, logoUrl: logo("EURS") },
  { chainId: 137, address: "0x580A84C73811E1839F75d86d75d88cCa0c241fF4", symbol: "QI", decimals: 18, logoUrl: logo("QI") },
  { chainId: 137, address: "0x9a71012B13CA4d3D0Cdc72A177DF3ef03b0E76A3", symbol: "BAL", decimals: 18, logoUrl: logo("BAL") },
  { chainId: 137, address: "0x85955046DF4668e1DD369D2DE9f3AEB98DD2A369", symbol: "DPI", decimals: 18, logoUrl: logo("DPI") },
  { chainId: 137, address: "0xC3C7d422809852031b44ab29EEC9F1EfF2A58756", symbol: "LDO", decimals: 18, logoUrl: logo("LDO") },
];

// --- BSC (56) ---
const BSC_TOKENS: TokenConfig[] = [
  { chainId: 56, address: NATIVE_TOKEN_ADDRESS, symbol: "BNB", decimals: 18, logoUrl: logo("BNB") },
  { chainId: 56, address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", decimals: 18, logoUrl: logo("USDC") },
  { chainId: 56, address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT", decimals: 18, logoUrl: logo("USDT") },
  { chainId: 56, address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", symbol: "DAI", decimals: 18, logoUrl: logo("DAI") },
  { chainId: 56, address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB", decimals: 18, logoUrl: logo("WBNB") },
  { chainId: 56, address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", symbol: "ETH", decimals: 18, logoUrl: logo("ETH") },
  { chainId: 56, address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", symbol: "BTCB", decimals: 18, logoUrl: logo("BTCB") },
  { chainId: 56, address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", symbol: "BUSD", decimals: 18, logoUrl: logo("BUSD") },
  { chainId: 56, address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", symbol: "CAKE", decimals: 18, logoUrl: logo("CAKE") },
  { chainId: 56, address: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD", symbol: "LINK", decimals: 18, logoUrl: logo("LINK") },
  { chainId: 56, address: "0xBf5140A22578168FD562DCcF235E5D43A02ce9B1", symbol: "UNI", decimals: 18, logoUrl: logo("UNI") },
  { chainId: 56, address: "0xfb6115445Bff7b52FeB98650C87f44907E58f802", symbol: "AAVE", decimals: 18, logoUrl: logo("AAVE") },
  { chainId: 56, address: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47", symbol: "ADA", decimals: 18, logoUrl: logo("ADA") },
  { chainId: 56, address: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE", symbol: "XRP", decimals: 18, logoUrl: logo("XRP") },
  { chainId: 56, address: "0x4338665CBB7B2485A8855A139b75D5e34AB0DB94", symbol: "LTC", decimals: 18, logoUrl: logo("LTC") },
  { chainId: 56, address: "0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402", symbol: "DOT", decimals: 18, logoUrl: logo("DOT") },
  { chainId: 56, address: "0xCC42724C6683B7E57334c4E856f4c9965ED682bD", symbol: "MATIC", decimals: 18, logoUrl: logo("MATIC") },
  { chainId: 56, address: "0x14016E85a25aeb13065688cAFB43044C2ef86784", symbol: "TUSD", decimals: 18, logoUrl: logo("TUSD") },
  { chainId: 56, address: "0x90C97F71E18723b0Cf0dfa30ee176Ab653E89F40", symbol: "FRAX", decimals: 18, logoUrl: logo("FRAX") },
  { chainId: 56, address: "0x1CE0c2827e2eF14D5C4f29a091d735A204794041", symbol: "AVAX", decimals: 18, logoUrl: logo("AVAX") },
];

// --- Arbitrum (42161) ---
const ARBITRUM_TOKENS: TokenConfig[] = [
  { chainId: 42161, address: NATIVE_TOKEN_ADDRESS, symbol: "ETH", decimals: 18, logoUrl: logo("ETH") },
  { chainId: 42161, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6, logoUrl: logo("USDC") },
  { chainId: 42161, address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", symbol: "USDC.e", decimals: 6, logoUrl: logo("USDC.e") },
  { chainId: 42161, address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", decimals: 6, logoUrl: logo("USDT") },
  { chainId: 42161, address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI", decimals: 18, logoUrl: logo("DAI") },
  { chainId: 42161, address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH", decimals: 18, logoUrl: logo("WETH") },
  { chainId: 42161, address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", symbol: "WBTC", decimals: 8, logoUrl: logo("WBTC") },
  { chainId: 42161, address: "0x912CE59144191C1204E64559FE8253a0e49E6548", symbol: "ARB", decimals: 18, logoUrl: logo("ARB") },
  { chainId: 42161, address: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", symbol: "LINK", decimals: 18, logoUrl: logo("LINK") },
  { chainId: 42161, address: "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0", symbol: "UNI", decimals: 18, logoUrl: logo("UNI") },
  { chainId: 42161, address: "0xba5DdD1f9d7F570dc94a51479a000E3BCE967196", symbol: "AAVE", decimals: 18, logoUrl: logo("AAVE") },
  { chainId: 42161, address: "0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978", symbol: "CRV", decimals: 18, logoUrl: logo("CRV") },
  { chainId: 42161, address: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a", symbol: "GMX", decimals: 18, logoUrl: logo("GMX") },
  { chainId: 42161, address: "0x539bdE0d7Dbd336b79148AA742883198BBF60342", symbol: "MAGIC", decimals: 18, logoUrl: logo("MAGIC") },
  { chainId: 42161, address: "0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F", symbol: "FRAX", decimals: 18, logoUrl: logo("FRAX") },
  { chainId: 42161, address: "0x3F56e0c36d275367b8C502090EDF38289b3dEa0d", symbol: "MAI", decimals: 18, logoUrl: logo("MAI") },
  { chainId: 42161, address: "0x5979D7b546E38E9aB8f53019DCda36A58f5dCf40", symbol: "wstETH", decimals: 18, logoUrl: logo("wstETH") },
  { chainId: 42161, address: "0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8", symbol: "rETH", decimals: 18, logoUrl: logo("rETH") },
  { chainId: 42161, address: "0x13Ad51ed4F1B7e9Dc168d8a00cB3f4dDD85EfA60", symbol: "LDO", decimals: 18, logoUrl: logo("LDO") },
  { chainId: 42161, address: "0x2297aEbD383787A160DD0d9F71508148769342E3", symbol: "BTC.b", decimals: 8, logoUrl: logo("BTC.b") },
];

// --- Optimism (10) ---
const OPTIMISM_TOKENS: TokenConfig[] = [
  { chainId: 10, address: NATIVE_TOKEN_ADDRESS, symbol: "ETH", decimals: 18, logoUrl: logo("ETH") },
  { chainId: 10, address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", decimals: 6, logoUrl: logo("USDC") },
  { chainId: 10, address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607", symbol: "USDC.e", decimals: 6, logoUrl: logo("USDC.e") },
  { chainId: 10, address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", symbol: "USDT", decimals: 6, logoUrl: logo("USDT") },
  { chainId: 10, address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI", decimals: 18, logoUrl: logo("DAI") },
  { chainId: 10, address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18, logoUrl: logo("WETH") },
  { chainId: 10, address: "0x68f180fcCe6836688e9084f035309E29Bf0A2095", symbol: "WBTC", decimals: 8, logoUrl: logo("WBTC") },
  { chainId: 10, address: "0x4200000000000000000000000000000000000042", symbol: "OP", decimals: 18, logoUrl: logo("OP") },
  { chainId: 10, address: "0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6", symbol: "LINK", decimals: 18, logoUrl: logo("LINK") },
  { chainId: 10, address: "0x6fd9d7AD17242c41f7131d257212c54A0e816691", symbol: "UNI", decimals: 18, logoUrl: logo("UNI") },
  { chainId: 10, address: "0x76FB31fb4af56892A25e32cFC43De717950c9278", symbol: "AAVE", decimals: 18, logoUrl: logo("AAVE") },
  { chainId: 10, address: "0x0994206dfE8De6Ec6920FF4D779B0d950605Fb53", symbol: "CRV", decimals: 18, logoUrl: logo("CRV") },
  { chainId: 10, address: "0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4", symbol: "SNX", decimals: 18, logoUrl: logo("SNX") },
  { chainId: 10, address: "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb", symbol: "wstETH", decimals: 18, logoUrl: logo("wstETH") },
  { chainId: 10, address: "0x9Bcef72be871e61ED4fBbc7630889beE758eb81D", symbol: "rETH", decimals: 18, logoUrl: logo("rETH") },
  { chainId: 10, address: "0x2E3D870790dC77A83DD1d18184Acc7439A53f475", symbol: "FRAX", decimals: 18, logoUrl: logo("FRAX") },
  { chainId: 10, address: "0xFdb794692724153d1488CcdBE0C56c252596735F", symbol: "LDO", decimals: 18, logoUrl: logo("LDO") },
  { chainId: 10, address: "0xdFA46478F9e5EA86d57387849598dbFB2e964b02", symbol: "MAI", decimals: 18, logoUrl: logo("MAI") },
  { chainId: 10, address: "0xB0B195aEFA3650A6908f15CdaC7D92F8a5791B0B", symbol: "BOB", decimals: 18, logoUrl: logo("BOB") },
  { chainId: 10, address: "0x920Cf626a271321C151D027030D5d08aF699456b", symbol: "KWENTA", decimals: 18, logoUrl: logo("KWENTA") },
];

// --- Base (8453) ---
const BASE_TOKENS: TokenConfig[] = [
  { chainId: 8453, address: NATIVE_TOKEN_ADDRESS, symbol: "ETH", decimals: 18, logoUrl: logo("ETH") },
  { chainId: 8453, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6, logoUrl: logo("USDC") },
  { chainId: 8453, address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", symbol: "USDbC", decimals: 6, logoUrl: logo("USDbC") },
  { chainId: 8453, address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol: "DAI", decimals: 18, logoUrl: logo("DAI") },
  { chainId: 8453, address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18, logoUrl: logo("WETH") },
  { chainId: 8453, address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", symbol: "cbETH", decimals: 18, logoUrl: logo("cbETH") },
  { chainId: 8453, address: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452", symbol: "wstETH", decimals: 18, logoUrl: logo("wstETH") },
  { chainId: 8453, address: "0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c", symbol: "rETH", decimals: 18, logoUrl: logo("rETH") },
  { chainId: 8453, address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", symbol: "AERO", decimals: 18, logoUrl: logo("AERO") },
  { chainId: 8453, address: "0x3bB4445D30AC020a84c1b5A8A2C6248ebC9779D0", symbol: "EXTRA", decimals: 18, logoUrl: logo("EXTRA") },
  { chainId: 8453, address: "0xfA980cEd6895AC314E7dE34Ef1bFAE90a5AdD29b", symbol: "PRIME", decimals: 18, logoUrl: logo("PRIME") },
  { chainId: 8453, address: "0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b", symbol: "tBTC", decimals: 18, logoUrl: logo("tBTC") },
  { chainId: 8453, address: "0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A", symbol: "weETH", decimals: 18, logoUrl: logo("weETH") },
  { chainId: 8453, address: "0xCfA3Ef56d303AE4fAabA0592388F19d7C3399FB4", symbol: "eUSD", decimals: 18, logoUrl: logo("eUSD") },
  { chainId: 8453, address: "0xDBFeFD2e8460a6Ee4955A68582F85708BAEA60A3", symbol: "BRETT", decimals: 18, logoUrl: logo("BRETT") },
  { chainId: 8453, address: "0x532f27101965dd16442E59d40670FaF5eBB142E4", symbol: "WELL", decimals: 18, logoUrl: logo("WELL") },
  { chainId: 8453, address: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c", symbol: "COMP", decimals: 18, logoUrl: logo("COMP") },
  { chainId: 8453, address: "0xA88594D404727625A9437C3f886C7643872296AE", symbol: "WELL", decimals: 18, logoUrl: logo("WELL") },
  { chainId: 8453, address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", symbol: "cbBTC", decimals: 8, logoUrl: logo("cbBTC") },
  { chainId: 8453, address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", symbol: "USDT", decimals: 6, logoUrl: logo("USDT") },
];

// --- Linea (59144) ---
const LINEA_TOKENS: TokenConfig[] = [
  { chainId: 59144, address: NATIVE_TOKEN_ADDRESS, symbol: "ETH", decimals: 18, logoUrl: logo("ETH") },
  { chainId: 59144, address: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", symbol: "USDC", decimals: 6, logoUrl: logo("USDC") },
  { chainId: 59144, address: "0xA219439258ca9da29E9Cc4cE5596924745e12B93", symbol: "USDT", decimals: 6, logoUrl: logo("USDT") },
  { chainId: 59144, address: "0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5", symbol: "DAI", decimals: 18, logoUrl: logo("DAI") },
  { chainId: 59144, address: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f", symbol: "WETH", decimals: 18, logoUrl: logo("WETH") },
  { chainId: 59144, address: "0x3aAB2285ddcDdaD8edf438C1bAB47e1a9D05a9b4", symbol: "WBTC", decimals: 8, logoUrl: logo("WBTC") },
  { chainId: 59144, address: "0xB5beDd42000b71FddE22D3eE8a79Bd49A568fC8F", symbol: "wstETH", decimals: 18, logoUrl: logo("wstETH") },
  { chainId: 59144, address: "0x2416092f143378750bb29b79eD961ab195CcEea5", symbol: "ezETH", decimals: 18, logoUrl: logo("ezETH") },
  { chainId: 59144, address: "0x1Bf74C010E6320bab11e2e5A532b5AC15e0b8aA6", symbol: "weETH", decimals: 18, logoUrl: logo("weETH") },
  { chainId: 59144, address: "0x5471ea8f739dd37E9B81Be9c5c77754D8AA953E4", symbol: "BUSD", decimals: 18, logoUrl: logo("BUSD") },
  { chainId: 59144, address: "0x265B25e22bcd7f10a5bD6E6410F10537Cc7567e8", symbol: "MATIC", decimals: 18, logoUrl: logo("MATIC") },
  { chainId: 59144, address: "0x636B22bC471c955A8DB60f28D4795066a8201fa3", symbol: "UNI", decimals: 18, logoUrl: logo("UNI") },
  { chainId: 59144, address: "0x5B16228B94b68C7cE33AF2ACc5663eBdE4dCFA2d", symbol: "LINK", decimals: 18, logoUrl: logo("LINK") },
  { chainId: 59144, address: "0x333D8b480BDB25eA7Be4Dd87EEB359988CE1b30D", symbol: "APE", decimals: 18, logoUrl: logo("APE") },
  { chainId: 59144, address: "0x7d43AABC515C356145049227CeE54B608342c0ad", symbol: "BUSD", decimals: 18, logoUrl: logo("BUSD") },
  { chainId: 59144, address: "0xf669C3C03D9FdaEc7691D707626a44b5D8f3B46E", symbol: "PEPE", decimals: 18, logoUrl: logo("PEPE") },
  { chainId: 59144, address: "0x0D1E753a25eBda689453309112904807625bEFBe", symbol: "CAKE", decimals: 18, logoUrl: logo("CAKE") },
  { chainId: 59144, address: "0x93F4d0ab6a3c94a6cBaB002577e1e89b5EB2f4D0", symbol: "nETH", decimals: 18, logoUrl: logo("nETH") },
  { chainId: 59144, address: "0x0a3BB08b3a15A19b4De82F8AcFc862606FB69A2D", symbol: "iZi", decimals: 18, logoUrl: logo("iZi") },
  { chainId: 59144, address: "0xAAA6c1E32C55A7Bfa8066A6FAE9b42650F262418", symbol: "RAM", decimals: 18, logoUrl: logo("RAM") },
];

// --- Unichain (130) ---
const UNICHAIN_TOKENS: TokenConfig[] = [
  { chainId: 130, address: NATIVE_TOKEN_ADDRESS, symbol: "ETH", decimals: 18, logoUrl: logo("ETH") },
  { chainId: 130, address: "0x078D782b760474a361dDA0AF3839290b0EF57AD6", symbol: "USDC", decimals: 6, logoUrl: logo("USDC") },
  { chainId: 130, address: "0x588CE4F028D8e7B53B687865d6A67b3A54C75518", symbol: "USDT", decimals: 6, logoUrl: logo("USDT") },
  { chainId: 130, address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18, logoUrl: logo("WETH") },
  { chainId: 130, address: "0xC7aB00EEB247b058CAeF719d1B4BBDd25d8455bC9", symbol: "DAI", decimals: 18, logoUrl: logo("DAI") },
  { chainId: 130, address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", symbol: "UNI", decimals: 18, logoUrl: logo("UNI") },
  { chainId: 130, address: "0xB3552F48e9C1B2b98637c9fB6Df62a3E0E9cD85A", symbol: "WBTC", decimals: 8, logoUrl: logo("WBTC") },
  { chainId: 130, address: "0x2bA64E11739E0E423aC9C0D22223dd0E18BeB390", symbol: "LINK", decimals: 18, logoUrl: logo("LINK") },
  { chainId: 130, address: "0x8f187Aa05619a017077f5308904739877dBf50E4", symbol: "AAVE", decimals: 18, logoUrl: logo("AAVE") },
  { chainId: 130, address: "0x5E45c82E44DB874Bd3921d12034B0EFBD23bCe69", symbol: "wstETH", decimals: 18, logoUrl: logo("wstETH") },
  { chainId: 130, address: "0x729b7eC0Be1dEcE69f7298AF2E0CA4B0127e4dE2", symbol: "cbETH", decimals: 18, logoUrl: logo("cbETH") },
  { chainId: 130, address: "0xA10c8BDD60C1Cd3Fe9e85e47AAF1b0Fe28f5F8Ab", symbol: "rETH", decimals: 18, logoUrl: logo("rETH") },
  { chainId: 130, address: "0xEed3F1F62e854f570DCF6EE1eE4b7dbce77fDc42", symbol: "FRAX", decimals: 18, logoUrl: logo("FRAX") },
  { chainId: 130, address: "0x4C2B9d2Cd9d058efa29C3328d3A3D40d94E12dC3", symbol: "CRV", decimals: 18, logoUrl: logo("CRV") },
  { chainId: 130, address: "0xa817fA6C788287dB06DD7Af87f7fAC9E4eDfBC7d", symbol: "SNX", decimals: 18, logoUrl: logo("SNX") },
  { chainId: 130, address: "0x7A0c53DBC0aD243583DEB3C7dd4A09f3989B7BE9", symbol: "LDO", decimals: 18, logoUrl: logo("LDO") },
  { chainId: 130, address: "0x5eC2a0e99dA1aFc0c0cCB0B6eA26361b2be9BE90", symbol: "MKR", decimals: 18, logoUrl: logo("MKR") },
  { chainId: 130, address: "0x9B5B0e7e67dc3345e5a30E6B85d08D17FEC1fD2e", symbol: "COMP", decimals: 18, logoUrl: logo("COMP") },
  { chainId: 130, address: "0x6D1f5e1c0b48c9Fc6B99C2e74c932E81B3eEa4f4", symbol: "GRT", decimals: 18, logoUrl: logo("GRT") },
  { chainId: 130, address: "0x3B8DC3e14dBC1Bf3a29De7c7fCb5bb13F2b0DC06", symbol: "BAL", decimals: 18, logoUrl: logo("BAL") },
];

// --- All tokens combined ---
export const SUPPORTED_TOKENS: TokenConfig[] = [
  ...ETHEREUM_TOKENS,
  ...POLYGON_TOKENS,
  ...BSC_TOKENS,
  ...ARBITRUM_TOKENS,
  ...OPTIMISM_TOKENS,
  ...BASE_TOKENS,
  ...LINEA_TOKENS,
  ...UNICHAIN_TOKENS,
];

// Lookup helpers
export function getTokensForChain(chainId: number): TokenConfig[] {
  return SUPPORTED_TOKENS.filter((t) => t.chainId === chainId);
}

export function getTokenKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

export function findToken(chainId: number, address: string): TokenConfig | undefined {
  const lowerAddress = address.toLowerCase();
  return SUPPORTED_TOKENS.find(
    (t) => t.chainId === chainId && t.address.toLowerCase() === lowerAddress,
  );
}
