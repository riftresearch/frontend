import { create } from 'zustand';
import { useEffect } from 'react';
import { CurrencyModalTitle, ReserveLiquidityParams, TokenMeta, UniswapTokenList, UserSwap } from './types';
import { ethers, BigNumber } from 'ethers';
import { USDT_Icon, ETH_Icon, ETH_Logo, Coinbase_BTC_Icon } from './components/other/SVGs';
import {
    ERC20ABI,
    CHAIN_SCOPED_CONFIGS,
    ChainScopedConfig,
    CoinbaseBTCAsset,
    REQUIRED_BLOCK_CONFIRMATIONS,
    BITCOIN_DECIMALS,
} from './utils/constants';
import { ValidAsset } from './types';
import riftExchangeABI from './abis/RiftExchange.json';
import { base, baseGoerli, baseSepolia } from 'viem/chains';
import { DeploymentType } from './types';
import combinedTokenData from '@/json/tokenData.json';
import { getEffectiveChainID } from './utils/dappHelper';

/**
 * Deduplicates tokens in a token list to ensure only unique tokens per chain by address
 */
function deduplicateTokens(tokenList: UniswapTokenList): UniswapTokenList {
    const addressChainMap = new Map<string, TokenMeta>();

    tokenList.tokens.forEach((token) => {
        const key = `${token.chainId}-${token.address.toLowerCase()}`;
        if (!addressChainMap.has(key)) {
            addressChainMap.set(key, token);
        }
    });

    // Sort tokens alphabetically by symbol after deduplication
    const sortedTokens = Array.from(addressChainMap.values()).sort((a, b) =>
        a.symbol.toUpperCase().localeCompare(b.symbol.toUpperCase()),
    );

    return {
        ...tokenList,
        tokens: sortedTokens,
    };
}

/**
 * Merges a Uniswap token list into an existing record of valid assets.
 *
 * @param tokenList - The Uniswap token list object.
 * @param defaultAssetTemplate - A template ValidAsset (e.g. your CoinbaseBTC asset) that contains all required properties.
 * @param existingAssets - (Optional) Existing valid assets record to merge into.
 * @returns A new record of ValidAsset objects keyed by token symbol.
 */
export function mergeTokenListIntoValidAssets(
    tokenList: UniswapTokenList,
    defaultAssetTemplate: ValidAsset,
    existingAssets: Record<string, ValidAsset> = {},
): Record<string, ValidAsset> {
    const convertIpfsUri = (uri: string | undefined, gateway: string = 'https://ipfs.io/ipfs/') => {
        if (!uri) return null;
        if (uri.startsWith('ipfs://')) {
            // Remove the "ipfs://" prefix.
            let cid = uri.slice('ipfs://'.length);
            // If the CID starts with "ipfs/", remove that segment.
            if (cid.startsWith('ipfs/')) {
                cid = cid.slice('ipfs/'.length);
            }
            return gateway + cid;
        }
        return uri;
    };

    // Start with the provided existing assets
    const mergedAssets: Record<string, ValidAsset> = { ...existingAssets };

    tokenList.tokens.forEach((token) => {
        // Use a unique key based on chain ID and address
        const key = `${token.chainId}-${token.address.toLowerCase()}`;

        // The new asset is built by taking the template and overriding
        // properties with those from the token.
        mergedAssets[key] = {
            ...defaultAssetTemplate,
            ...token,
            // Override with token-specific data:
            display_name: token.symbol,
            tokenAddress: token.address,
            // If available, use the token's logo URI; otherwise, fall back to the template icon.
            icon_svg: convertIpfsUri(token.logoURI) || defaultAssetTemplate.icon_svg,
            fromTokenList: true,
        };
    });

    return mergedAssets;
}

/**
 * Helper function to find an asset by name in the validAssets Record
 */
function findAssetByName(assets: Record<string, ValidAsset>, name: string, chainId: number): ValidAsset | undefined {
    return Object.values(assets).find((asset) => asset.name === name && (asset.chainId === chainId || !asset.chainId));
}

/**
 * Helper function to find an asset key by name in the validAssets Record
 */
function findAssetKeyByName(assets: Record<string, ValidAsset>, name: string, chainId: number): string | undefined {
    return Object.keys(assets).find(
        (key) => assets[key].name === name && (assets[key].chainId === chainId || !assets[key].chainId),
    );
}

type Store = {
    // setup & asset data
    userEthAddress: string;
    setUserEthAddress: (address: string) => void;
    ethersRpcProvider: ethers.providers.Provider | null;
    setEthersRpcProvider: (provider: ethers.providers.Provider) => void;
    validAssets: Record<string, ValidAsset>;
    setValidAssets: (assets: Record<string, ValidAsset>) => void;
    updateValidValidAsset: (assetKey: string, updates: Partial<ValidAsset>) => void;
    mergeValidAssets: (assets: Record<string, ValidAsset>) => void;
    updatePriceUSD: (assetKey: string, newPrice: number) => void;
    updatePriceUSDByAddress: (address: string, newPrice: number) => void;
    updateTotalAvailableLiquidity: (assetKey: string, newLiquidity: BigNumber) => void;
    updateConnectedUserBalanceRaw: (assetKey: string, newBalance: BigNumber) => void;
    updateConnectedUserBalanceFormatted: (assetKey: string, newBalance: string) => void;

    // Chain-based selection (replacing selectedInputAsset)
    selectedChainId: number;
    selectedChain: ChainScopedConfig & {
        // Runtime data
        proverFee: BigNumber;
        releaserFee: BigNumber;
        priceUSD: number | null;
        totalAvailableLiquidity: BigNumber;
        connectedUserBalanceRaw: BigNumber;
        connectedUserBalanceFormatted: string;
    };
    setSelectedChainId: (chainId: number) => void;

    isPayingFeesInBTC: boolean;
    setIsPayingFeesInBTC: (isPayingFeesInBTC: boolean) => void;

    // Helper functions to find assets
    findAssetByAddress: (address: string, chainId?: number) => ValidAsset | undefined;
    findAssetByName: (name: string, chainId?: number) => ValidAsset | undefined;
    findAssetBySymbol: (symbol: string, chainId?: number) => ValidAsset | undefined;
    getAssetKey: (asset: ValidAsset) => string;

    // contract data (deposit vaults, swap reservations)
    setUserSwapsFromAddress: (swaps: UserSwap[]) => void;
    userSwapsFromAddress: UserSwap[];
    userSwapsLoadingState: 'loading' | 'error' | 'received';
    setUserSwapsLoadingState: (state: 'loading' | 'error' | 'received') => void;

    // activity page
    selectedSwapToManage: UserSwap | null;
    setSelectedSwapToManage: (swap: UserSwap | null) => void;
    showManageDepositVaultsScreen: boolean;
    setShowManageDepositVaultsScreen: (show: boolean) => void;

    // swap flow
    swapFlowState:
        | '0-not-started'
        | '1-reserve-liquidity'
        | '2-send-bitcoin'
        | '3-receive-evm-token'
        | '4-completed'
        | '5-expired';
    setSwapFlowState: (
        state:
            | '0-not-started'
            | '1-reserve-liquidity'
            | '2-send-bitcoin'
            | '3-receive-evm-token'
            | '4-completed'
            | '5-expired',
    ) => void;
    depositFlowState: '0-not-started' | '1-finding-liquidity' | '2-awaiting-payment' | '3-payment-recieved';
    setDepositFlowState: (
        state: '0-not-started' | '1-finding-liquidity' | '2-awaiting-payment' | '3-payment-recieved',
    ) => void;
    btcInputSwapAmount: string;
    setBtcInputSwapAmount: (amount: string) => void;
    coinbaseBtcDepositAmount: string;
    setCoinbaseBtcDepositAmount: (amount: string) => void;
    btcOutputAmount: string;
    setBtcOutputAmount: (amount: string) => void;
    coinbaseBtcOutputAmount: string;
    setCoinbaseBtcOutputAmount: (amount: string) => void;
    payoutBTCAddress: string;
    setPayoutBTCAddress: (address: string) => void;
    lowestFeeReservationParams: ReserveLiquidityParams | null;
    setLowestFeeReservationParams: (reservation: ReserveLiquidityParams | null) => void;
    showManageReservationScreen: boolean;
    setShowManageReservationScreen: (show: boolean) => void;
    depositMode: boolean;
    setDepositMode: (mode: boolean) => void;
    withdrawAmount: string;
    setWithdrawAmount: (amount: string) => void;
    protocolFeeAmountMicroUsdt: string;
    setProtocolFeeAmountMicroUsdt: (amount: string) => void;
    swapReservationNotFound: boolean;
    setSwapReservationNotFound: (notFound: boolean) => void;
    currentReservationState: string;
    setCurrentReservationState: (state: string) => void;
    areNewDepositsPaused: boolean;
    setAreNewDepositsPaused: (paused: boolean) => void;
    isGasFeeTooHigh: boolean;
    setIsGasFeeTooHigh: (isGasFeeTooHigh: boolean) => void;
    confirmationBlocksNeeded: number;
    setConfirmationBlocksNeeded: (blocks: number) => void;
    currentTotalBlockConfirmations: number;
    setCurrentTotalBlockConfirmations: (confirmations: number) => void;
    proxyWalletSwapStatus: number;
    setProxyWalletSwapStatus: (status: number) => void;

    // modals
    currencyModalTitle: CurrencyModalTitle;
    setCurrencyModalTitle: (x: CurrencyModalTitle) => void;
    ethPayoutAddress: string;
    setEthPayoutAddress: (address: string) => void;
    bitcoinSwapTransactionHash: string;
    setBitcoinSwapTransactionHash: (hash: string) => void;

    // global
    isOnline: boolean;
    setIsOnline: (b: boolean) => void;

    // Rift Developer Mode
    riftDeveloperMode: boolean;
    setRiftDeveloperMode: (mode: boolean) => void;

    // Uniswap
    uniswapInputAssetPriceUSD: number;
    setUniswapInputAssetPriceUSD: (price: number) => void;
    selectedUniswapInputAsset: TokenMeta;
    setSelectedUniswapInputAsset: (asset: TokenMeta) => void;
    selectedChainID: number;
    setSelectChainID: (chainID: number) => void;
    uniswapTokens: TokenMeta[];
    setUniswapTokens: (tokens: TokenMeta[]) => void;
};

// Helper function to create selected chain from config
const createSelectedChain = (chainId: number) => {
    const config = CHAIN_SCOPED_CONFIGS[chainId];
    if (!config) {
        throw new Error(`Chain ID ${chainId} not found in CHAIN_SCOPED_CONFIGS`);
    }

    return {
        ...config,
        // Runtime data with default values
        proverFee: BigNumber.from(0),
        releaserFee: BigNumber.from(0),
        priceUSD: null,
        totalAvailableLiquidity: BigNumber.from(0),
        connectedUserBalanceRaw: BigNumber.from(0),
        connectedUserBalanceFormatted: '0',
    };
};

export const useStore = create<Store>((set, get) => {
    // Default to Base Mainnet
    const defaultChainId = 8453;
    const initialSelectedChain = createSelectedChain(defaultChainId);

    // Create assets based on the selected chain using the coinbaseBTCAsset from config
    const createAssetFromChain = (chainConfig: ChainScopedConfig) => {
        const coinbaseBtcAddress = chainConfig.cbbtcTokenAddress.toLowerCase();
        const asset = chainConfig.coinbaseBTCAsset;

        return {
            name: asset.name,
            display_name: asset.displayName,
            tokenAddress: coinbaseBtcAddress,
            dataEngineUrl: chainConfig.dataEngineUrl,
            decimals: asset.decimals,
            riftExchangeContractAddress: chainConfig.riftExchangeAddress,
            riftExchangeAbi: riftExchangeABI.abi,
            contractChainID: chainConfig.chainId,
            chainDetails: base, // ONLY USE FOR MAINNET SWITCHING NETWORKS WITH METAMASK
            contractRpcURL: chainConfig.rpcUrl,
            etherScanBaseUrl: chainConfig.etherscanUrl,
            proverFee: BigNumber.from(0),
            releaserFee: BigNumber.from(0),
            icon_svg: Coinbase_BTC_Icon,
            bg_color: asset.bgColor,
            border_color: asset.borderColor,
            border_color_light: asset.borderColorLight,
            dark_bg_color: asset.darkBgColor,
            light_text_color: asset.lightTextColor,
            exchangeRateInTokenPerBTC: asset.exchangeRateInTokenPerBTC,
            priceUSD: null,
            totalAvailableLiquidity: BigNumber.from(0),
            connectedUserBalanceRaw: BigNumber.from(0),
            connectedUserBalanceFormatted: '0',
            symbol: asset.symbol,
            address: coinbaseBtcAddress,
            chainId: chainConfig.chainId,
            logoURI: asset.logoURI,
        };
    };

    const initialCoinbaseBtc = createAssetFromChain(initialSelectedChain);

    // Create default Uniswap asset from the chain config
    const defaultUniswapAsset: TokenMeta = {
        chainId: initialSelectedChain.chainId,
        name: 'Coinbase Wrapped BTC',
        address: initialSelectedChain.cbbtcTokenAddress.toLowerCase(),
        symbol: initialSelectedChain.coinbaseBTCAsset.symbol,
        decimals: initialSelectedChain.coinbaseBTCAsset.decimals,
        logoURI: initialSelectedChain.coinbaseBTCAsset.logoURI,
    };

    // Off-chain BTC is still a special case
    const btc = {
        name: 'BTC',
        display_name: 'BTC',
        decimals: 8,
        icon_svg: null,
        bg_color: '#c26920',
        border_color: '#FFA04C',
        border_color_light: '#FFA04F',
        dark_bg_color: '#372412',
        light_text_color: '#7d572e',
        priceUSD: 88000, // TEST
        chainId: 0, // Non-EVM chain
        address: 'bitcoin', // Placeholder for off-chain BTC
    };

    // Use the new key format
    const initialValidAssets: Record<string, ValidAsset> = {
        [`${defaultChainId}-${initialSelectedChain.cbbtcTokenAddress.toLowerCase()}`]: initialCoinbaseBtc,
        '0-bitcoin': btc,
    };

    const updatedValidAssets = mergeTokenListIntoValidAssets(
        deduplicateTokens(combinedTokenData),
        initialCoinbaseBtc,
        initialValidAssets,
    );

    return {
        // Chain-based setup instead of asset-based
        selectedChainId: defaultChainId,
        selectedChain: initialSelectedChain,
        setSelectedChainId: (chainId) => {
            const newChain = createSelectedChain(chainId);
            const newAsset = createAssetFromChain(newChain);

            set((state) => {
                // Update the valid assets with the new chain's asset
                const newValidAssets = { ...state.validAssets };
                const newAssetKey = `${chainId}-${newChain.cbbtcTokenAddress.toLowerCase()}`;
                newValidAssets[newAssetKey] = newAsset;

                return {
                    selectedChainId: chainId,
                    selectedChain: newChain,
                    validAssets: newValidAssets,
                    selectedUniswapInputAsset: {
                        chainId: newChain.chainId,
                        name: 'Coinbase Wrapped BTC',
                        address: newChain.cbbtcTokenAddress.toLowerCase(),
                        symbol: newChain.coinbaseBTCAsset.symbol,
                        decimals: newChain.coinbaseBTCAsset.decimals,
                        logoURI: newChain.coinbaseBTCAsset.logoURI,
                    },
                };
            });
        },

        userEthAddress: '',
        setUserEthAddress: (userEthAddress) => set({ userEthAddress }),
        ethersRpcProvider: null,
        setEthersRpcProvider: (provider) => set({ ethersRpcProvider: provider }),
        validAssets: updatedValidAssets,
        setValidAssets: (assets) => set({ validAssets: assets }),

        updateValidValidAsset: (assetKey, updates) =>
            set((state) => {
                const assets = { ...state.validAssets };

                // Try to find the correct key if assetKey is a name
                let actualKey = assetKey;

                if (!assetKey.includes('-')) {
                    // Special handling for BTC and CoinbaseBTC
                    if (assetKey === 'BTC') {
                        actualKey = '0-bitcoin';
                    } else if (assetKey === 'CoinbaseBTC') {
                        actualKey = findAssetKeyByName(assets, 'CoinbaseBTC', state.selectedChainId) || assetKey;
                    } else {
                        // Try to find by name
                        actualKey = findAssetKeyByName(assets, assetKey, state.selectedChainId) || assetKey;
                    }
                }

                // Update the asset if we have the key
                if (assets[actualKey]) {
                    assets[actualKey] = { ...assets[actualKey], ...updates };
                }

                return { validAssets: assets };
            }),

        mergeValidAssets: (newAssets) =>
            set((state) => {
                const mergedAssets = { ...state.validAssets };

                Object.entries(newAssets).forEach(([key, asset]) => {
                    const validAsset = asset as ValidAsset;

                    // Try to create a proper key if needed
                    let properKey = key;

                    if (!key.includes('-') && validAsset.address && validAsset.chainId) {
                        properKey = `${validAsset.chainId}-${validAsset.address.toLowerCase()}`;
                    } else if (key === 'BTC') {
                        properKey = '0-bitcoin';
                    } else if (key === 'CoinbaseBTC') {
                        const existingKey = findAssetKeyByName(state.validAssets, 'CoinbaseBTC', state.selectedChainId);
                        if (existingKey) {
                            properKey = existingKey;
                        }
                    }

                    // Add or update the asset
                    mergedAssets[properKey] = validAsset;
                });

                return { validAssets: mergedAssets };
            }),

        updatePriceUSD: (assetKey, newPrice) => {
            return set((state) => {
                const assets = { ...state.validAssets };

                // Try to find the correct key if assetKey is a name
                let actualKey = assetKey;

                if (!assetKey.includes('-')) {
                    // Special handling for BTC and CoinbaseBTC
                    if (assetKey === 'BTC') {
                        actualKey = '0-bitcoin';
                    } else if (assetKey === 'CoinbaseBTC') {
                        actualKey = findAssetKeyByName(assets, 'CoinbaseBTC', state.selectedChainId) || assetKey;
                    } else {
                        // Try to find by name
                        actualKey = findAssetKeyByName(assets, assetKey, state.selectedChainId) || assetKey;
                    }
                }

                // Update the asset if we have the key
                if (assets[actualKey]) {
                    assets[actualKey] = { ...assets[actualKey], priceUSD: newPrice };
                }

                return { validAssets: assets };
            });
        },

        updatePriceUSDByAddress: (address, newPrice) =>
            set((state) => {
                const assets = { ...state.validAssets };

                // Find keys for the given address across all chains
                const matchingKeys = Object.keys(assets).filter((key) => {
                    const asset = assets[key];
                    return asset.address && asset.address.toLowerCase() === address.toLowerCase();
                });

                // Update all matching assets
                matchingKeys.forEach((key) => {
                    assets[key] = { ...assets[key], priceUSD: newPrice };
                });

                return { validAssets: assets };
            }),

        updateTotalAvailableLiquidity: (assetKey, newLiquidity) =>
            set((state) => {
                const assets = { ...state.validAssets };

                // Try to find the correct key if assetKey is a name
                let actualKey = assetKey;

                if (!assetKey.includes('-')) {
                    // Special handling for BTC and CoinbaseBTC
                    if (assetKey === 'BTC') {
                        actualKey = '0-bitcoin';
                    } else if (assetKey === 'CoinbaseBTC') {
                        actualKey = findAssetKeyByName(assets, 'CoinbaseBTC', state.selectedChainId) || assetKey;
                    } else {
                        // Try to find by name
                        actualKey = findAssetKeyByName(assets, assetKey, state.selectedChainId) || assetKey;
                    }
                }

                // Update the asset if we have the key
                if (assets[actualKey]) {
                    assets[actualKey] = { ...assets[actualKey], totalAvailableLiquidity: newLiquidity };
                }

                return { validAssets: assets };
            }),

        updateConnectedUserBalanceRaw: (assetKey, newBalance) =>
            set((state) => {
                const assets = { ...state.validAssets };

                // Try to find the correct key if assetKey is a name
                let actualKey = assetKey;

                if (!assetKey.includes('-')) {
                    // Special handling for BTC and CoinbaseBTC
                    if (assetKey === 'BTC') {
                        actualKey = '0-bitcoin';
                    } else if (assetKey === 'CoinbaseBTC') {
                        actualKey = findAssetKeyByName(assets, 'CoinbaseBTC', state.selectedChainId) || assetKey;
                    } else {
                        // Try to find by name
                        actualKey = findAssetKeyByName(assets, assetKey, state.selectedChainId) || assetKey;
                    }
                }

                // Update the asset if we have the key
                if (assets[actualKey]) {
                    assets[actualKey] = { ...assets[actualKey], connectedUserBalanceRaw: newBalance };
                }

                return { validAssets: assets };
            }),

        updateConnectedUserBalanceFormatted: (assetKey, newBalance) =>
            set((state) => {
                const assets = { ...state.validAssets };

                // Try to find the correct key if assetKey is a name
                let actualKey = assetKey;

                if (!assetKey.includes('-')) {
                    // Special handling for BTC and CoinbaseBTC
                    if (assetKey === 'BTC') {
                        actualKey = '0-bitcoin';
                    } else if (assetKey === 'CoinbaseBTC') {
                        actualKey = findAssetKeyByName(assets, 'CoinbaseBTC', state.selectedChainId) || assetKey;
                    } else {
                        // Try to find by name
                        actualKey = findAssetKeyByName(assets, assetKey, state.selectedChainId) || assetKey;
                    }
                }

                // Update the asset if we have the key
                if (assets[actualKey]) {
                    assets[actualKey] = { ...assets[actualKey], connectedUserBalanceFormatted: newBalance };
                }

                return { validAssets: assets };
            }),

        isPayingFeesInBTC: false,
        setIsPayingFeesInBTC: (isPayingFeesInBTC) => set({ isPayingFeesInBTC }),

        // Helper functions to find assets
        findAssetByAddress: (address, chainId) => {
            const assets = get().validAssets;
            const currentChainId = chainId || get().selectedChainId;

            return Object.values(assets).find(
                (asset) =>
                    asset.address &&
                    asset.address.toLowerCase() === address.toLowerCase() &&
                    asset.chainId === currentChainId,
            );
        },

        findAssetByName: (name, chainId) => {
            const assets = get().validAssets;
            const currentChainId = chainId || get().selectedChainId;

            return findAssetByName(assets, name, currentChainId);
        },

        findAssetBySymbol: (symbol, chainId) => {
            const assets = get().validAssets;
            const currentChainId = chainId || get().selectedChainId;

            return Object.values(assets).find(
                (asset) => asset.symbol === symbol && (asset.chainId === currentChainId || !asset.chainId),
            );
        },

        getAssetKey: (asset) => {
            if (asset.address === 'bitcoin') {
                return '0-bitcoin';
            }
            return `${asset.chainId}-${asset.address.toLowerCase()}`;
        },

        // contract data (deposit vaults, swap reservations)
        setUserSwapsFromAddress: (swaps) => set({ userSwapsFromAddress: swaps }),
        userSwapsFromAddress: [],
        userSwapsLoadingState: 'loading',
        setUserSwapsLoadingState: (state) => set({ userSwapsLoadingState: state }),
        selectedSwapToManage: null,
        setSelectedSwapToManage: (swap) => set({ selectedSwapToManage: swap }),
        showManageDepositVaultsScreen: false,
        setShowManageDepositVaultsScreen: (show) => set({ showManageDepositVaultsScreen: show }),
        swapFlowState: '0-not-started',
        setSwapFlowState: (state) => set({ swapFlowState: state }),
        depositFlowState: '0-not-started',
        setDepositFlowState: (state) => set({ depositFlowState: state }),
        btcInputSwapAmount: '',
        setBtcInputSwapAmount: (amount) => set({ btcInputSwapAmount: amount }),
        coinbaseBtcDepositAmount: '',
        setCoinbaseBtcDepositAmount: (amount) => set({ coinbaseBtcDepositAmount: amount }),
        btcOutputAmount: '',
        setBtcOutputAmount: (amount) => set({ btcOutputAmount: amount }),
        coinbaseBtcOutputAmount: '',
        setCoinbaseBtcOutputAmount: (amount) => set({ coinbaseBtcOutputAmount: amount }),
        payoutBTCAddress: '',
        setPayoutBTCAddress: (address) => set({ payoutBTCAddress: address }),
        lowestFeeReservationParams: null,
        setLowestFeeReservationParams: (reservation) => set({ lowestFeeReservationParams: reservation }),
        showManageReservationScreen: false,
        setShowManageReservationScreen: (show) => set({ showManageReservationScreen: show }),
        depositMode: false,
        setDepositMode: (mode) => set({ depositMode: mode }),
        withdrawAmount: '',
        setWithdrawAmount: (amount) => set({ withdrawAmount: amount }),
        protocolFeeAmountMicroUsdt: '',
        setProtocolFeeAmountMicroUsdt: (amount) => set({ protocolFeeAmountMicroUsdt: amount }),
        swapReservationNotFound: false,
        setSwapReservationNotFound: (notFound) => set({ swapReservationNotFound: notFound }),
        currentReservationState: '',
        setCurrentReservationState: (state) => set({ currentReservationState: state }),
        areNewDepositsPaused: false,
        setAreNewDepositsPaused: (paused) => set({ areNewDepositsPaused: paused }),
        isGasFeeTooHigh: false,
        setIsGasFeeTooHigh: (isGasFeeTooHigh) => set({ isGasFeeTooHigh: isGasFeeTooHigh }),
        confirmationBlocksNeeded: REQUIRED_BLOCK_CONFIRMATIONS,
        setConfirmationBlocksNeeded: (blocks) => set({ confirmationBlocksNeeded: blocks }),
        currentTotalBlockConfirmations: 0,
        setCurrentTotalBlockConfirmations: (confirmations) => set({ currentTotalBlockConfirmations: confirmations }),
        proxyWalletSwapStatus: 0,
        setProxyWalletSwapStatus: (status) => set({ proxyWalletSwapStatus: status }),
        currencyModalTitle: 'close',
        setCurrencyModalTitle: (x) => set({ currencyModalTitle: x }),
        ethPayoutAddress: '',
        setEthPayoutAddress: (address) => set({ ethPayoutAddress: address }),
        bitcoinSwapTransactionHash: '',
        setBitcoinSwapTransactionHash: (hash) => set({ bitcoinSwapTransactionHash: hash }),
        isOnline: true,
        setIsOnline: (b) => set({ isOnline: b }),
        riftDeveloperMode: false,
        setRiftDeveloperMode: (mode) => set({ riftDeveloperMode: mode }),
        uniswapInputAssetPriceUSD: 0,
        setUniswapInputAssetPriceUSD: (price) => set({ uniswapInputAssetPriceUSD: price }),
        selectedUniswapInputAsset: defaultUniswapAsset,
        setSelectedUniswapInputAsset: (asset) => set({ selectedUniswapInputAsset: asset }),
        selectedChainID: defaultChainId,
        setSelectChainID: (chainID) => set({ selectedChainID: chainID }),
        uniswapTokens: [],
        setUniswapTokens: (tokens) => set({ uniswapTokens: tokens }),
    };
});
