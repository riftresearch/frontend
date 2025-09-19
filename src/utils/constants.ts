import { Config, TokenStyle } from "./types";
import { createRfqClient, Currency } from "./rfqClient";
import { createOTCClient } from "./otcClient";

export const IS_FRONTEND_PAUSED =
  process.env.NEXT_PUBLIC_IS_FRONTEND_PAUSED === "true";

export const LIGHT_CLIENT_BLOCK_HEIGHT_DIFF_THRESHOLD = 1000;

export const BITCOIN_DECIMALS = 8;

export const bitcoinStyle: TokenStyle = {
  name: "Bitcoin",
  display_name: "BTC",
  symbol: "BTC",
  icon_svg: null,
  bg_color: "#9B602F",
  border_color: "#FFA04C",
  border_color_light: "#FFA04F",
  dark_bg_color: "#291B0D",
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

export const GLOBAL_CONFIG: Config = {
  etherscanUrl: "https://etherscan.io",
  mainnetRpcUrl: "https://eth0.riftnodes.com",
  esploraUrl: "https://blockstream.info/api",
  rfqServerUrl: "https://rfq-server-production.up.railway.app",
  otcServerUrl:
    "https://1b33795a2f06f8b0fe5a148cc69eb33cb2a3e7c0-4422.dstack-pha-prod7.phala.network",
  underlyingSwappingAssets: [
    {
      currency: {
        chain: "bitcoin",
        decimals: 8,
        token: {
          type: "Native",
        },
      },
      style: bitcoinStyle,
    },
    {
      currency: {
        chain: "ethereum",
        decimals: 8,
        token: {
          type: "Address",
          // NOTE: Addresses right now need to be checksummed
          data: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
        },
      },
      style: cbBTCStyle,
    },
  ],
};

export const rfqClient = createRfqClient({
  baseUrl: GLOBAL_CONFIG.rfqServerUrl,
  timeout: 10000,
});

export const otcClient = createOTCClient({
  baseUrl: GLOBAL_CONFIG.otcServerUrl,
  timeout: 10000,
});
