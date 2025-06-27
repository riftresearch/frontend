import { ChainScopedConfig, TokenStyle, ValidAsset } from "./types";
import { useStore } from "./store";

export const IS_FRONTEND_PAUSED =
  process.env.NEXT_PUBLIC_IS_FRONTEND_PAUSED === "true";

export const LIGHT_CLIENT_BLOCK_HEIGHT_DIFF_THRESHOLD = 1000;

export const BITCOIN_DECIMALS = 8;

export const bitcoinStyle: TokenStyle = {
  name: "Bitcoin",
  display_name: "BTC",
  symbol: "BTC",
  icon_svg: null,
  bg_color: "#c26920",
  border_color: "#FFA04C",
  border_color_light: "#FFA04F",
  dark_bg_color: "#372412",
  light_text_color: "#7d572e",
};

export const cbBTCStyle: TokenStyle = {
  name: "Coinbase Bitcoin",
  display_name: "cbBTC",
  symbol: "cbBTC",
  bg_color: "#2E59BB",
  border_color: "#1C61FD",
  border_color_light: "#3B70E8",
  dark_bg_color: "rgba(9, 36, 97, 0.3)",
  light_text_color: "#365B9F",
  logoURI:
    "https://assets.coingecko.com/coins/images/40143/standard/cbbtc.webp",
};
export const opaqueBackgroundColor = {
  bg: "rgba(15, 15, 15, 0.55)",
  backdropFilter: "blur(10px)",
};

// TODO: Define all fields for base + mainnet
// bc1
// bc1qssdcp5kvwh6nghzg9tuk99xsflwkdv4hgvq58q
export const CHAIN_SCOPED_CONFIGS: Record<number, ChainScopedConfig> = {
  // Mainnet
  1: {
    name: "Ethereum",
    type: "Mainnet",
    chainId: 1,
    etherscanUrl: "https://etherscan.io/",
    rpcUrl: "https://mainnet.infura.io/v3/YOUR_INFURA_KEY", // TODO: Replace with actual RPC
    esploraUrl: "https://blockstream.info/api",
    bitcoinNetwork: "mainnet",
    dataEngineUrl: "https://api.mainnet.rift.finance", // TODO: Replace with actual URL'
    underlyingSwappingAsset: {
      tokenAddress: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
      decimals: 8,
      style: cbBTCStyle,
    },
    riftExchangeAddress: "0x1234567890123456789012345678901234567890", // TODO: Replace with actual address
    bundler3: {
      bundler3Address: "0x6566194141eefa99Af43Bb5Aa71460Ca2Dc90245",
      generalAdapter1Address: "0x4A6c312ec70E8747a587EE860a0353cd42Be0aE0",
      paraswapAdapterAddress: "0x03b5259Bd204BfD4A616E5B79b0B786d90c6C38f",
      riftcbBTCAdapterAddress: "0x0000000000000000000000000000000000000000", // Your custom adapter (not deployed on mainnet yet)
    },
    marketMakers: [],
  },
  // Base Mainnet
  8453: {
    name: "Base",
    type: "Mainnet",
    chainId: 8453,
    etherscanUrl: "https://basescan.org/",
    rpcUrl: "https://mainnet.base.org", // Base Mainnet RPC
    esploraUrl: "https://blockstream.info/api",
    bitcoinNetwork: "mainnet",
    dataEngineUrl: "https://api.base.rift.finance", // TODO: Replace with actual URL
    underlyingSwappingAsset: {
      tokenAddress: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
      decimals: 8,
      style: cbBTCStyle,
    },
    riftExchangeAddress: "0x1234567890123456789012345678901234567890", // TODO: Replace with actual address
    bundler3: {
      bundler3Address: "0x6BFd8137e702540E7A42B74178A4a49Ba43920C4",
      generalAdapter1Address: "0xb98c948CFA24072e58935BC004a8A7b376AE746A",
      paraswapAdapterAddress: "0x6abE8ABd0275E5564ed1336F0243A52C32562F71",
      riftcbBTCAdapterAddress: "0x0000000000000000000000000000000000000000", // TODO: Replace with actual address
    },
    marketMakers: [],
  },
  // Devnet (fork of base)
  // RUST_LOG=info cargo run --release --bin devnet -- --fund-address 0x82bdA835Ab91D3F38Cb291030A5B0e6Dff086d44 --fund-address 0x8206bC387D672267E3e3e64253d93b0ED7B27FaD --fork-url https://base0.riftnodes.com --fork-block-number 31956985
  1337: {
    name: "Devnet",
    type: "Testnet",
    chainId: 1337,
    etherscanUrl: "https://etherscan.io/",
    rpcUrl: "http://0.0.0.0:50101",
    esploraUrl: "http://0.0.0.0:50103",
    bitcoinNetwork: "mainnet",
    dataEngineUrl: "http://0.0.0.0:50100",
    underlyingSwappingAsset: {
      tokenAddress: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
      decimals: 8,
      style: cbBTCStyle,
    },
    riftExchangeAddress: "0x5Ae1f4bB68f8EAC39CFDbdFdA2b7344Ccbd80fAf",
    bundler3: {
      bundler3Address: "0x6BFd8137e702540E7A42B74178A4a49Ba43920C4",
      generalAdapter1Address: "0xb98c948CFA24072e58935BC004a8A7b376AE746A",
      paraswapAdapterAddress: "0x6abE8ABd0275E5564ed1336F0243A52C32562F71",
      riftcbBTCAdapterAddress: "0xb97C59331F89a852Ae21aee215Da28820c533649",
    },
    marketMakers: [
      {
        bitcoinAddress: "bcrt1q6emp5yxls9zrac9wmucn2xffvhp5n7qhx7xxa3",
      },
    ],
  },
};
