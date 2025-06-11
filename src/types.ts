import type { BigNumber, BigNumberish, BytesLike, ethers } from 'ethers';
import type { Address } from 'viem';

export type Bundler3Config = {
    bundler3Address: string;
    generalAdapter1Address: string;
    paraswapAdapterAddress: string;
    riftcbBTCAdapterAddress: string;
};

export type ChainScopedConfig = {
    name: string;
    type: 'Mainnet' | 'Testnet' | 'Devnet';
    chainId: number;
    etherscanUrl: string;
    rpcUrl: string;
    esploraUrl: string;
    dataEngineUrl: string;
    underlyingSwappingAsset: ValidAsset;
    riftExchangeAddress: string;
    bundler3: Bundler3Config;
};

export type TokenStyling = {
    name: string;
    display_name?: string;
    icon_svg?: any;
    bg_color?: string;
    border_color?: string;
    border_color_light?: string;
    dark_bg_color?: string;
    light_text_color?: string;
} & Partial<TokenMeta>;

export type ValidAsset = {
    tokenAddress: string;
    decimals: number;
    exchangeRateInTokenPerBTC?: number | null;
    priceUSD?: number | null;
    connectedUserBalanceRaw?: BigNumber;
    totalAvailableLiquidity?: BigNumber;
    chainDetails?: any;
    tokenStyling: TokenStyling;
};

export type CurrencyModalTitle = 'send' | 'recieve' | 'deposit' | 'close';

export type RouteButton = 'Swap' | 'Manage' | 'About';

export const ROUTES: { [k in RouteButton]: string } = {
    Swap: '/',
    Manage: '/manage',
    About: '/about',
};

export type ReservationByPaymasterRequest = {
    sender: string;
    vault_indexes_to_reserve: Array<string>;
    amounts_to_reserve: Array<string>;
    eth_payout_address: string;
    total_sats_input_inlcuding_proxy_fee: string;
    expired_swap_reservation_indexes: Array<string>;
};

export type ReservationByPaymasterResponse = {
    status: boolean;
    tx_hash: string | null;
};

export enum DeploymentType {
    MAINNET = 'MAINNET',
    TESTNET = 'TESTNET',
    DEVNET = 'DEVNET',
}

export type BlockLeaf = {
    blockHash: string;
    height: number;
    cumulativeChainwork: BigNumber;
};

// types/UniswapTokenList.ts

type ChainIDString = string;

/**
 * Defines a Uniswap-compatible token list, e.g. from https://tokens.uniswap.org
 */
export interface UniswapTokenList {
    name: string;
    timestamp: string;
    version: {
        major: number;
        minor: number;
        patch: number;
    };
    tags: Record<string, unknown>;
    logoURI: string;
    keywords: string[];
    tokens: TokenMeta[];
}

/**
 * Individual token entry in the Uniswap token list
 */
export interface TokenMeta {
    chainId: number;
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI?: string;
    extensions?: {
        bridgeInfo?: Record<
            ChainIDString,
            {
                tokenAddress: string;
            }
        >;
    };
}

export interface NestedDepositData {
    vaultIndex: string;
    depositTimestamp: number;
    depositAmount: string;
    depositFee: string;
    expectedSats: number;
    btcPayoutScriptPubKey: string;
    specifiedPayoutAddress: string;
    ownerAddress: string;
    salt?: string;
    confirmationBlocks: number;
    attestedBitcoinBlockHeight: number;
}

export interface UserSwap {
    vaultIndex: string;
    depositTimestamp: number;
    depositAmount: string;
    depositFee: string;
    expectedSats: number;
    btcPayoutScriptPubKey: string;
    specifiedPayoutAddress: string;
    ownerAddress: string;
    salt: string;
    confirmationBlocks: number;
    attestedBitcoinBlockHeight: number;
    deposit_block_number: number;
    deposit_block_hash: string;
    deposit_txid: string;
    swap_proofs: any[]; // Based on ChainAwareProposedSwap from dataEngineClient
}

export interface ReserveLiquidityParams {
    vaultIndexes: number[];
    amountsToReserve: BigNumber[];
    // Add other fields as needed based on usage
}

export interface ContractDataContextType {
    loading: boolean;
    error: any;
    userSwapsFromAddress: UserSwap[];
    refreshConnectedUserBalance: () => Promise<void>;
    refreshUserSwapsFromAddress: () => Promise<void>;
}

export type BlockLeafStruct = {
    blockHash: BytesLike;
    height: BigNumberish;
    cumulativeChainwork: BigNumberish;
};

export type DepositLiquidityParamsStruct = {
    depositOwnerAddress: string;
    specifiedPayoutAddress: string;
    depositAmount: BigNumberish;
    expectedSats: BigNumberish;
    btcPayoutScriptPubKey: BytesLike;
    depositSalt: BytesLike;
    confirmationBlocks: BigNumberish;
    safeBlockLeaf: BlockLeafStruct;
    safeBlockSiblings: BytesLike[];
    safeBlockPeaks: BytesLike[];
};
