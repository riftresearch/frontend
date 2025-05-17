import { base, mainnet } from 'viem/chains';
import {
    MAINNET_BASE_CHAIN_ID,
    MAINNET_BASE_RPC_URL,
    MAINNET_BASE_ETHERSCAN_URL,
    MAINNET_BASE_RIFT_EXCHANGE_ADDRESS,
    MAINNET_BASE_CBBTC_TOKEN_ADDRESS,
    MAINNET_DATA_ENGINE_URL,
    MAINNET_ETH_RPC_URL,
    DEVNET_BASE_CHAIN_ID,
    DEVNET_BASE_RPC_URL,
    DEVNET_BASE_ETHERSCAN_URL,
    DEVNET_BASE_RIFT_EXCHANGE_ADDRESS,
    DEVNET_BASE_CBBTC_TOKEN_ADDRESS,
    DEVNET_DATA_ENGINE_URL,
    DEVNET_BASE_WS_URL,
} from '../utils/constants';

export interface ChainInfo {
    id: number;
    name: string;
    rpcUrls: string[];
    explorer: string;
    riftExchangeAddress: string;
    cbBTCAddress: string;
    dataEngineUrl?: string;
    chain: any;
}

export const CHAINS: Record<number, ChainInfo> = {
    [MAINNET_BASE_CHAIN_ID]: {
        id: MAINNET_BASE_CHAIN_ID,
        name: 'Base',
        rpcUrls: [MAINNET_BASE_RPC_URL],
        explorer: MAINNET_BASE_ETHERSCAN_URL,
        riftExchangeAddress: MAINNET_BASE_RIFT_EXCHANGE_ADDRESS,
        cbBTCAddress: MAINNET_BASE_CBBTC_TOKEN_ADDRESS,
        dataEngineUrl: MAINNET_DATA_ENGINE_URL,
        chain: base,
    },
    [DEVNET_BASE_CHAIN_ID]: {
        id: DEVNET_BASE_CHAIN_ID,
        name: 'Devnet',
        rpcUrls: [DEVNET_BASE_RPC_URL],
        explorer: DEVNET_BASE_ETHERSCAN_URL,
        riftExchangeAddress: DEVNET_BASE_RIFT_EXCHANGE_ADDRESS,
        cbBTCAddress: DEVNET_BASE_CBBTC_TOKEN_ADDRESS,
        dataEngineUrl: DEVNET_DATA_ENGINE_URL,
        chain: { ...base, id: DEVNET_BASE_CHAIN_ID, name: 'Devnet', network: 'devnet', rpcUrls: { default: { http: [DEVNET_BASE_RPC_URL], webSocket: DEVNET_BASE_WS_URL ? [DEVNET_BASE_WS_URL] : [] } } },
    },
    1: {
        id: 1,
        name: 'Ethereum',
        rpcUrls: MAINNET_ETH_RPC_URL,
        explorer: 'https://etherscan.io/',
        riftExchangeAddress: '',
        cbBTCAddress: '',
        chain: mainnet,
    },
};
