export type TokenStyle = {
  name: string;
  symbol: string;
  display_name?: string;
  icon_svg?: any;
  bg_color?: string;
  border_color?: string;
  border_color_light?: string;
  dark_bg_color?: string;
  light_text_color?: string;
  logoURI?: string;
};

export type ValidAsset = {
  tokenAddress: string;
  decimals: number;
  style: TokenStyle;
};

export type ChainScopedConfig = {
  name: string;
  type: "Mainnet" | "Testnet";
  chainId: number;
  etherscanUrl: string;
  rpcUrl: string;
  esploraUrl: string;
  dataEngineUrl: string;
  underlyingSwappingAsset: ValidAsset;
  riftExchangeAddress: string;
  bundler3: {
    bundler3Address: string;
    generalAdapter1Address: string;
    paraswapAdapterAddress: string;
    riftcbBTCAdapterAddress: string;
  };
};

export type RouteButton = "Swap" | "Manage" | "About";

export const ROUTES: { [k in RouteButton]: string } = {
  Swap: "/",
  Manage: "/manage",
  About: "/about",
};
