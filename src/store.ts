// store.ts
/* eslint-disable @typescript-eslint/no-shadow */
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { ethers, BigNumber } from 'ethers';
import {
    CurrencyModalTitle,
    ChainScopedConfig,
    ReserveLiquidityParams,
    TokenMeta,
    UniswapTokenList,
    UserSwap,
    ValidAsset,
} from './types';
import {
    ERC20ABI,
    CHAIN_SCOPED_CONFIGS,
    bitcoin,
    cbBTCDisplayInfo,
    REQUIRED_BLOCK_CONFIRMATIONS,
    BITCOIN_DECIMALS,
} from './utils/constants';
import riftExchangeABI from './abis/RiftExchange.json';
import combinedTokenData from '@/json/tokenData.json';
import { deduplicateTokens, mergeTokenListIntoValidAssets } from './utils/tokenListHelpers';

/* ─────────────────────────── helpers ─────────────────────────── */

function findAssetByName(assets: Record<string, ValidAsset>, name: string, chainId: number): ValidAsset | undefined {
    return Object.values(assets).find(
        (asset) =>
            asset.tokenStyling.name === name && (asset.tokenStyling.chainId === chainId || !asset.tokenStyling.chainId),
    );
}

function findAssetKeyByName(assets: Record<string, ValidAsset>, name: string, chainId: number): string | undefined {
    return Object.keys(assets).find(
        (key) =>
            assets[key].tokenStyling.name === name &&
            (assets[key].tokenStyling.chainId === chainId || !assets[key].tokenStyling.chainId),
    );
}

/* ─────────────────────────── initial assets ─────────────────────────── */

const initialValidAssets: Record<string, ValidAsset> = {
    '0-bitcoin': {
        tokenAddress: 'bitcoin',
        decimals: BITCOIN_DECIMALS,
        tokenStyling: bitcoin,
    },
    coinbaseBTC: {
        tokenAddress: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
        decimals: 8,
        tokenStyling: cbBTCDisplayInfo,
    },
};

const updatedValidAssets = mergeTokenListIntoValidAssets(
    deduplicateTokens(combinedTokenData),
    {
        tokenAddress: 'bitcoin',
        decimals: BITCOIN_DECIMALS,
        tokenStyling: bitcoin,
    },
    initialValidAssets,
);

/* ─────────────────────────── Store type ─────────────────────────── */

export type Store = {
    /* --------------- setup & asset data --------------- */
    selectedInputAsset: ValidAsset;
    setSelectedInputAsset: (asset: ValidAsset) => void;
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
    updateConnectedUserBalanceRaw: (assetKey: string, newBalance: BigNumber) => void;

    /* --------------- chain-based selection ------------- */
    selectedChain: ChainScopedConfig;
    setSelectedChainId: (chainId: number) => void;

    /* --------------- asset find helpers ---------------- */
    findAssetByAddress: (address: string, chainId?: number) => ValidAsset | undefined;
    findAssetByName: (name: string, chainId?: number) => ValidAsset | undefined;
    findAssetBySymbol: (symbol: string, chainId?: number) => ValidAsset | undefined;
    getAssetKey: (asset: ValidAsset) => string;

    /* --------------- contract data --------------------- */
    setUserSwapsFromAddress: (swaps: UserSwap[]) => void;
    userSwapsFromAddress: UserSwap[];
    userSwapsLoadingState: 'loading' | 'error' | 'received';
    setUserSwapsLoadingState: (s: 'loading' | 'error' | 'received') => void;

    /* --------------- activity page --------------------- */
    selectedSwapToManage: UserSwap | null;
    setSelectedSwapToManage: (swap: UserSwap | null) => void;
    showManageDepositVaultsScreen: boolean;
    setShowManageDepositVaultsScreen: (b: boolean) => void;

    /* --------------- swap flow ------------------------- */
    swapFlowState:
        | '0-not-started'
        | '1-reserve-liquidity'
        | '2-send-bitcoin'
        | '3-receive-evm-token'
        | '4-completed'
        | '5-expired';
    setSwapFlowState: (s: Store['swapFlowState']) => void;
    depositFlowState: '0-not-started' | '1-finding-liquidity' | '2-awaiting-payment' | '3-payment-recieved';
    setDepositFlowState: (s: Store['depositFlowState']) => void;
    btcInputSwapAmount: string;
    setBtcInputSwapAmount: (v: string) => void;
    coinbaseBtcDepositAmount: string;
    setCoinbaseBtcDepositAmount: (v: string) => void;
    btcOutputAmount: string;
    setBtcOutputAmount: (v: string) => void;
    coinbaseBtcOutputAmount: string;
    setCoinbaseBtcOutputAmount: (v: string) => void;
    payoutBTCAddress: string;
    setPayoutBTCAddress: (v: string) => void;
    lowestFeeReservationParams: ReserveLiquidityParams | null;
    setLowestFeeReservationParams: (x: ReserveLiquidityParams | null) => void;
    showManageReservationScreen: boolean;
    setShowManageReservationScreen: (b: boolean) => void;
    depositMode: boolean;
    setDepositMode: (b: boolean) => void;
    withdrawAmount: string;
    setWithdrawAmount: (v: string) => void;
    protocolFeeAmountMicroUsdt: string;
    setProtocolFeeAmountMicroUsdt: (v: string) => void;
    swapReservationNotFound: boolean;
    setSwapReservationNotFound: (b: boolean) => void;
    currentReservationState: string;
    setCurrentReservationState: (v: string) => void;
    areNewDepositsPaused: boolean;
    setAreNewDepositsPaused: (b: boolean) => void;
    isGasFeeTooHigh: boolean;
    setIsGasFeeTooHigh: (b: boolean) => void;
    confirmationBlocksNeeded: number;
    setConfirmationBlocksNeeded: (n: number) => void;
    currentTotalBlockConfirmations: number;
    setCurrentTotalBlockConfirmations: (n: number) => void;
    proxyWalletSwapStatus: number;
    setProxyWalletSwapStatus: (n: number) => void;

    /* --------------- modals ---------------------------- */
    currencyModalTitle: CurrencyModalTitle;
    setCurrencyModalTitle: (t: CurrencyModalTitle) => void;
    ethPayoutAddress: string;
    setEthPayoutAddress: (v: string) => void;
    bitcoinSwapTransactionHash: string;
    setBitcoinSwapTransactionHash: (v: string) => void;

    /* --------------- global ---------------------------- */
    isOnline: boolean;
    setIsOnline: (b: boolean) => void;

    /* --------------- Rift Dev Mode --------------------- */
    riftDeveloperMode: boolean;
    setRiftDeveloperMode: (b: boolean) => void;

    /* --------------- Uniswap --------------------------- */
    uniswapInputAssetPriceUSD: number;
    setUniswapInputAssetPriceUSD: (n: number) => void;
    selectedUniswapInputAsset: TokenMeta;
    setSelectedUniswapInputAsset: (t: TokenMeta) => void;
    selectedChainID: number;
    setSelectChainID: (id: number) => void;
    uniswapTokens: TokenMeta[];
    setUniswapTokens: (arr: TokenMeta[]) => void;
};

/* ─────────────────────────── factory ─────────────────────────── */

const createStore: StateCreator<Store> = (set, get) =>
    ({
        /* ── initial data ── */
        selectedInputAsset: initialValidAssets.coinbaseBTC,
        userEthAddress: '',
        ethersRpcProvider: null,
        validAssets: updatedValidAssets,
        selectedChain: CHAIN_SCOPED_CONFIGS[8453],

        userSwapsFromAddress: [],
        userSwapsLoadingState: 'loading',

        selectedSwapToManage: null,
        showManageDepositVaultsScreen: false,

        swapFlowState: '0-not-started',
        depositFlowState: '0-not-started',
        btcInputSwapAmount: '',
        coinbaseBtcDepositAmount: '',
        btcOutputAmount: '',
        coinbaseBtcOutputAmount: '',
        payoutBTCAddress: '',
        lowestFeeReservationParams: null,
        showManageReservationScreen: false,
        depositMode: true,
        withdrawAmount: '',
        protocolFeeAmountMicroUsdt: '',
        swapReservationNotFound: false,
        currentReservationState: '',
        areNewDepositsPaused: false,
        isGasFeeTooHigh: false,
        confirmationBlocksNeeded: REQUIRED_BLOCK_CONFIRMATIONS,
        currentTotalBlockConfirmations: 0,
        proxyWalletSwapStatus: 0,

        currencyModalTitle: 'close',
        ethPayoutAddress: '',
        bitcoinSwapTransactionHash: '',

        isOnline: true,
        riftDeveloperMode: false,

        uniswapInputAssetPriceUSD: 0,
        selectedUniswapInputAsset: {
            chainId: 8453,
            name: 'Coinbase Wrapped BTC',
            address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
            symbol: 'cbBTC',
            decimals: 8,
            logoURI: 'https://assets.coingecko.com/coins/images/2528/large/coinbase-wrapped-bitcoin.png?1693153486',
        },
        selectedChainID: 8453,
        uniswapTokens: [],

        /* ── setters & actions ── */
        setSelectedInputAsset: (asset) => set({ selectedInputAsset: asset }),
        setUserEthAddress: (address) => set({ userEthAddress: address }),
        setEthersRpcProvider: (provider) => set({ ethersRpcProvider: provider }),
        setValidAssets: (assets) => set({ validAssets: assets }),

        updateValidValidAsset: (assetKey, updates) =>
            set((state) => {
                const assets = { ...state.validAssets };
                let key = assetKey;

                if (!key.includes('-')) {
                    if (key === 'BTC') key = '0-bitcoin';
                    else if (key === 'CoinbaseBTC')
                        key = findAssetKeyByName(assets, 'CoinbaseBTC', state.selectedChain.chainId) || key;
                    else key = findAssetKeyByName(assets, key, state.selectedChain.chainId) || key;
                }
                if (assets[key]) assets[key] = { ...assets[key], ...updates };
                return { validAssets: assets };
            }),

        mergeValidAssets: (newAssets) =>
            set((state) => {
                const merged = { ...state.validAssets };
                Object.entries(newAssets).forEach(([key, asset]) => {
                    const v = asset as ValidAsset;
                    let k = key;

                    if (!k.includes('-') && v.tokenAddress && v.tokenStyling.chainId)
                        k = `${v.tokenStyling.chainId}-${v.tokenAddress.toLowerCase()}`;
                    else if (k === 'BTC') k = '0-bitcoin';
                    else if (k === 'CoinbaseBTC') {
                        const existing = findAssetKeyByName(
                            state.validAssets,
                            'CoinbaseBTC',
                            state.selectedChain.chainId,
                        );
                        if (existing) k = existing;
                    }
                    merged[k] = v;
                });
                return { validAssets: merged };
            }),

        updatePriceUSD: (assetKey, newPrice) =>
            set((state) => {
                const assets = { ...state.validAssets };
                let key = assetKey;
                if (!key.includes('-')) {
                    if (key === 'BTC') key = '0-bitcoin';
                    else if (key === 'CoinbaseBTC')
                        key = findAssetKeyByName(assets, 'CoinbaseBTC', state.selectedChain.chainId) || key;
                    else key = findAssetKeyByName(assets, key, state.selectedChain.chainId) || key;
                }
                if (assets[key]) assets[key] = { ...assets[key], priceUSD: newPrice };
                return { validAssets: assets };
            }),

        updatePriceUSDByAddress: (address, newPrice) =>
            set((state) => {
                const assets = { ...state.validAssets };
                Object.keys(assets).forEach((k) => {
                    if (assets[k].tokenAddress?.toLowerCase() === address.toLowerCase())
                        assets[k] = { ...assets[k], priceUSD: newPrice };
                });
                return { validAssets: assets };
            }),

        updateConnectedUserBalanceRaw: (assetKey, newBalance) =>
            set((state) => {
                const assets = { ...state.validAssets };
                let key = assetKey;
                if (!key.includes('-')) {
                    if (key === 'BTC') key = '0-bitcoin';
                    else if (key === 'CoinbaseBTC')
                        key = findAssetKeyByName(assets, 'CoinbaseBTC', state.selectedChain.chainId) || key;
                    else key = findAssetKeyByName(assets, key, state.selectedChain.chainId) || key;
                }
                if (assets[key]) assets[key] = { ...assets[key], connectedUserBalanceRaw: newBalance };
                return { validAssets: assets };
            }),

        setSelectedChainId: (chainId) =>
            set((state) => {
                const newChain = CHAIN_SCOPED_CONFIGS[chainId];
                return {
                    selectedChainId: chainId,
                    selectedChain: newChain,
                    selectedUniswapInputAsset: {
                        chainId: newChain.chainId,
                        name: 'Coinbase Wrapped BTC',
                        address: newChain.underlyingSwappingAsset.tokenAddress.toLowerCase(),
                        symbol: cbBTCDisplayInfo.symbol,
                        decimals: cbBTCDisplayInfo.decimals,
                        logoURI: cbBTCDisplayInfo.logoURI,
                    },
                };
            }),

        findAssetByAddress: (address, chainId) => {
            const assets = get().validAssets;
            const cid = chainId ?? get().selectedChain.chainId;
            return Object.values(assets).find(
                (a) => a.tokenAddress?.toLowerCase() === address.toLowerCase() && a.tokenStyling.chainId === cid,
            );
        },
        findAssetByName: (name, chainId) =>
            findAssetByName(get().validAssets, name, chainId ?? get().selectedChain.chainId),
        findAssetBySymbol: (symbol, chainId) => {
            const cid = chainId ?? get().selectedChain.chainId;
            return Object.values(get().validAssets).find(
                (a) => a.tokenStyling.symbol === symbol && (a.tokenStyling.chainId === cid || !a.tokenStyling.chainId),
            );
        },
        getAssetKey: (asset) =>
            asset.tokenAddress === 'bitcoin'
                ? '0-bitcoin'
                : `${asset.tokenStyling.chainId}-${asset.tokenAddress.toLowerCase()}`,

        setUserSwapsFromAddress: (swaps) => set({ userSwapsFromAddress: swaps }),
        setUserSwapsLoadingState: (s) => set({ userSwapsLoadingState: s }),

        setSelectedSwapToManage: (swap) => set({ selectedSwapToManage: swap }),
        setShowManageDepositVaultsScreen: (b) => set({ showManageDepositVaultsScreen: b }),

        setSwapFlowState: (s) => set({ swapFlowState: s }),
        setDepositFlowState: (s) => set({ depositFlowState: s }),

        setBtcInputSwapAmount: (v) => set({ btcInputSwapAmount: v }),
        setCoinbaseBtcDepositAmount: (v) => set({ coinbaseBtcDepositAmount: v }),
        setBtcOutputAmount: (v) => set({ btcOutputAmount: v }),
        setCoinbaseBtcOutputAmount: (v) => set({ coinbaseBtcOutputAmount: v }),
        setPayoutBTCAddress: (v) => set({ payoutBTCAddress: v }),
        setLowestFeeReservationParams: (x) => set({ lowestFeeReservationParams: x }),
        setShowManageReservationScreen: (b) => set({ showManageReservationScreen: b }),
        setDepositMode: (b) => set({ depositMode: b }),
        setWithdrawAmount: (v) => set({ withdrawAmount: v }),
        setProtocolFeeAmountMicroUsdt: (v) => set({ protocolFeeAmountMicroUsdt: v }),
        setSwapReservationNotFound: (b) => set({ swapReservationNotFound: b }),
        setCurrentReservationState: (v) => set({ currentReservationState: v }),
        setAreNewDepositsPaused: (b) => set({ areNewDepositsPaused: b }),
        setIsGasFeeTooHigh: (b) => set({ isGasFeeTooHigh: b }),
        setConfirmationBlocksNeeded: (n) => set({ confirmationBlocksNeeded: n }),
        setCurrentTotalBlockConfirmations: (n) => set({ currentTotalBlockConfirmations: n }),
        setProxyWalletSwapStatus: (n) => set({ proxyWalletSwapStatus: n }),

        setCurrencyModalTitle: (t) => set({ currencyModalTitle: t }),
        setEthPayoutAddress: (v) => set({ ethPayoutAddress: v }),
        setBitcoinSwapTransactionHash: (v) => set({ bitcoinSwapTransactionHash: v }),

        setIsOnline: (b) => set({ isOnline: b }),
        setRiftDeveloperMode: (b) => set({ riftDeveloperMode: b }),

        setUniswapInputAssetPriceUSD: (n) => set({ uniswapInputAssetPriceUSD: n }),
        setSelectedUniswapInputAsset: (t) => set({ selectedUniswapInputAsset: t }),
        setSelectChainID: (id) => set({ selectedChainID: id }),
        setUniswapTokens: (arr) => set({ uniswapTokens: arr }),
    }) satisfies Store;

/* ─────────────────────────── export hook ─────────────────────────── */

export const useStore = create<Store>()(createStore);
