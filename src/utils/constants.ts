import { BigNumberish, ethers } from 'ethers';
import { ValidAsset, DeploymentType } from '../types';
import { useStore } from '../store';
import { ETH_Icon, ETH_Logo, USDT_Icon } from '../components/other/SVGs';

export const IS_FRONTEND_PAUSED = process.env.NEXT_PUBLIC_IS_FRONTEND_PAUSED === 'true';

export const BITCOIN_DECIMALS = 8;
export const SATS_PER_BTC = 100000000; // 10^8

export type Bundler3Config = {
    bundler3Address: string;
    generalAdapter1Address: string;
    paraswapAdapterAddress: string;
    riftcbBTCAdapterAddress: string;
};

export type CoinbaseBTCAsset = {
    name: string;
    displayName: string;
    symbol: string;
    decimals: number;
    bgColor: string;
    borderColor: string;
    borderColorLight: string;
    darkBgColor: string;
    lightTextColor: string;
    exchangeRateInTokenPerBTC: number;
    logoURI: string;
};

export type ChainScopedConfig = {
    chainId: number;
    etherscanUrl: string;
    rpcUrl: string;
    esploraUrl: string;
    dataEngineUrl: string;
    cbbtcTokenAddress: string;
    riftExchangeAddress: string;
    bundler3: Bundler3Config;
    // Standard CoinbaseBTC asset for this chain
    coinbaseBTCAsset: CoinbaseBTCAsset;
};

// Standard CoinbaseBTC asset definition (same across all chains)
const STANDARD_COINBASE_BTC_ASSET: CoinbaseBTCAsset = {
    name: 'CoinbaseBTC',
    displayName: 'cbBTC',
    symbol: 'cbBTC',
    decimals: BITCOIN_DECIMALS,
    bgColor: '#2E59BB',
    borderColor: '#1C61FD',
    borderColorLight: '#3B70E8',
    darkBgColor: 'rgba(9, 36, 97, 0.3)',
    lightTextColor: '#365B9F',
    exchangeRateInTokenPerBTC: 1.001,
    logoURI: 'https://assets.coingecko.com/coins/images/40143/standard/cbbtc.webp',
};

export const CHAIN_SCOPED_CONFIGS: Record<number, ChainScopedConfig> = {
    // TODO: Define all fields for base + mainnet
    // Mainnet
    1: {
        chainId: 1,
        etherscanUrl: 'https://etherscan.io/',
        rpcUrl: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY', // TODO: Replace with actual RPC
        esploraUrl: 'https://blockstream.info/api',
        dataEngineUrl: 'https://api.mainnet.rift.finance', // TODO: Replace with actual URL
        cbbtcTokenAddress: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
        riftExchangeAddress: '0x1234567890123456789012345678901234567890', // TODO: Replace with actual address
        bundler3: {
            bundler3Address: '0x0000000000000000000000000000000000000000',
            generalAdapter1Address: '0x0000000000000000000000000000000000000000',
            paraswapAdapterAddress: '0x0000000000000000000000000000000000000000',
            riftcbBTCAdapterAddress: '0x0000000000000000000000000000000000000000',
        },
        coinbaseBTCAsset: STANDARD_COINBASE_BTC_ASSET,
    },
    // Base Mainnet
    8453: {
        chainId: 8453,
        etherscanUrl: 'https://basescan.org/',
        rpcUrl: 'https://mainnet.base.org', // Base Mainnet RPC
        esploraUrl: 'https://blockstream.info/api',
        dataEngineUrl: 'https://api.base.rift.finance', // TODO: Replace with actual URL
        cbbtcTokenAddress: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
        riftExchangeAddress: '0x1234567890123456789012345678901234567890', // TODO: Replace with actual address
        bundler3: {
            bundler3Address: '0x6BFd8137e702540E7A42B74178A4a49Ba43920C4',
            generalAdapter1Address: '0xb98c948CFA24072e58935BC004a8A7b376AE746A',
            paraswapAdapterAddress: '0x6abE8ABd0275E5564ed1336F0243A52C32562F71',
            riftcbBTCAdapterAddress: '0x0000000000000000000000000000000000000000', // TODO: Replace with actual address
        },
        coinbaseBTCAsset: STANDARD_COINBASE_BTC_ASSET,
    },
    // Devnet

    // cargo run --release --bin devnet -- --fund-address 0x82bdA835Ab91D3F38Cb291030A5B0e6Dff086d44 --fund-address 0xb0D3EE0B9d205aa52b7e59adC61df39f80963413
    1337: {
        chainId: 1337,
        etherscanUrl: 'https://etherscan.io/',
        rpcUrl: 'http://0.0.0.0:50101',
        esploraUrl: 'http://0.0.0.0:50103',
        dataEngineUrl: 'http://0.0.0.0:50100',
        cbbtcTokenAddress: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
        riftExchangeAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        bundler3: {
            bundler3Address: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
            generalAdapter1Address: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
            paraswapAdapterAddress: '0x0000000000000000000000000000000000000000',
            riftcbBTCAdapterAddress: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
        },
        coinbaseBTCAsset: STANDARD_COINBASE_BTC_ASSET,
    },
};

export const MIN_SWAP_AMOUNT_SATS = 3000; // 1000 sats = ~$0.96 currently
export const MAX_SWAP_AMOUNT_SATS = 100_000_000_000; // 1,000 cbBTC
export const SAMEES_DEMO_CB_BTC_ADDRESS = '0xA976a1F4Ee6DC8011e777133C6719087C10b6259';

export const REQUIRED_BLOCK_CONFIRMATIONS = 2;
export const PROTOCOL_FEE = ethers.BigNumber.from(1); // 0.1%
export const PROTOCOL_FEE_DENOMINATOR = ethers.BigNumber.from(1000); // 100% / 0.1% = 1000
export const CONTRACT_RESERVATION_EXPIRATION_WINDOW_IN_SECONDS = 4 * 60 * 60; // 4 hours
export const FRONTEND_RESERVATION_EXPIRATION_WINDOW_IN_SECONDS = 1 * 60 * 60; // 1 hour

export const opaqueBackgroundColor = { bg: 'rgba(15, 15, 15, 0.55)', backdropFilter: 'blur(10px)' };
export const bitcoin_bg_color = '#c26920';
export const bitcoin_border_color = '#FFA04C';
export const bitcoin_dark_bg_color = '#372412';
export const bitcoin_light_text_color = '#7d572e';

export const ERC20ABI = [
    {
        type: 'event',
        name: 'Approval',
        inputs: [
            {
                indexed: true,
                name: 'owner',
                type: 'address',
            },
            {
                indexed: true,
                name: 'spender',
                type: 'address',
            },
            {
                indexed: false,
                name: 'value',
                type: 'uint256',
            },
        ],
    },
    {
        type: 'event',
        name: 'Transfer',
        inputs: [
            {
                indexed: true,
                name: 'from',
                type: 'address',
            },
            {
                indexed: true,
                name: 'to',
                type: 'address',
            },
            {
                indexed: false,
                name: 'value',
                type: 'uint256',
            },
        ],
    },
    {
        type: 'function',
        name: 'allowance',
        stateMutability: 'view',
        inputs: [
            {
                name: 'owner',
                type: 'address',
            },
            {
                name: 'spender',
                type: 'address',
            },
        ],
        outputs: [
            {
                type: 'uint256',
            },
        ],
    },
    {
        type: 'function',
        name: 'approve',
        stateMutability: 'nonpayable',
        inputs: [
            {
                name: 'spender',
                type: 'address',
            },
            {
                name: 'amount',
                type: 'uint256',
            },
        ],
        outputs: [
            {
                type: 'bool',
            },
        ],
    },
    {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [
            {
                name: 'account',
                type: 'address',
            },
        ],
        outputs: [
            {
                type: 'uint256',
            },
        ],
    },
    {
        type: 'function',
        name: 'decimals',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            {
                type: 'uint8',
            },
        ],
    },
    {
        type: 'function',
        name: 'name',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            {
                type: 'string',
            },
        ],
    },
    {
        type: 'function',
        name: 'symbol',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            {
                type: 'string',
            },
        ],
    },
    {
        type: 'function',
        name: 'totalSupply',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            {
                type: 'uint256',
            },
        ],
    },
    {
        type: 'function',
        name: 'transfer',
        stateMutability: 'nonpayable',
        inputs: [
            {
                name: 'recipient',
                type: 'address',
            },
            {
                name: 'amount',
                type: 'uint256',
            },
        ],
        outputs: [
            {
                type: 'bool',
            },
        ],
    },
    {
        type: 'function',
        name: 'transferFrom',
        stateMutability: 'nonpayable',
        inputs: [
            {
                name: 'sender',
                type: 'address',
            },
            {
                name: 'recipient',
                type: 'address',
            },
            {
                name: 'amount',
                type: 'uint256',
            },
        ],
        outputs: [
            {
                type: 'bool',
            },
        ],
    },
];
