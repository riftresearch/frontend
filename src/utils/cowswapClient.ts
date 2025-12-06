/**
 * TypeScript client for CowSwap Protocol
 * Provides typed access to quote and order creation for ERC20 -> cbBTC swaps
 * Supports multiple chains (Ethereum mainnet and Base) with chain-specific SDK instances
 */

import { SupportedChainId, PriceQuality } from "@cowprotocol/cow-sdk";
import { TradingSdk, type QuoteResults, type SwapAdvancedSettings } from "@cowprotocol/sdk-trading";
import { OrderKind } from "@cowprotocol/cow-sdk";
import type { TradeParameters } from "@cowprotocol/sdk-trading";
import { ViemAdapter } from "@cowprotocol/sdk-viem-adapter";
import type { WalletClient, PublicClient, Address } from "viem";
import { maxUint256 } from "viem";

// Constants
const CBBTC_ADDRESS = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";
const NATIVE_ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const DEFAULT_SLIPPAGE_BPS = 5; // 0.05% = 5 basis points
const DEFAULT_VALID_FOR_SECONDS = 300; // 5 minutes

/** Chains supported by this client */
export type CowSwapSupportedChain = SupportedChainId.MAINNET | SupportedChainId.BASE;

/**
 * CowSwap quote request parameters
 */
export interface CowSwapQuoteRequest {
  /** Token to sell (address or "ETH" for native) */
  sellToken: string;
  /** Amount to buy in base units (exactly one of buyAmount or sellAmount must be set) */
  buyAmount?: string;
  /** Amount to sell in base units (exactly one of buyAmount or sellAmount must be set) */
  sellAmount?: string;
  /** Token decimals for the sell token */
  decimals: number;
  /** Slippage tolerance in basis points (100 bps = 1%) */
  slippageBps?: number;
  /** How long the order should be valid in seconds */
  validFor?: number;
  /** User's wallet address */
  userAddress: string;
  /** Price quality preference (defaults to OPTIMAL) */
  priceQuality?: PriceQuality;
  /** Optional receiver address for the order */
  receiver?: string;
  /** Chain to execute on (defaults to mainnet) */
  chainId?: CowSwapSupportedChain;
}

/**
 * CowSwap client configuration
 * Single wallet client shared across chains, separate public clients per chain
 */
export interface CowSwapClientConfig {
  /** Wallet client for signing - shared across all chains */
  walletClient?: WalletClient;
  /** Public client for Ethereum mainnet */
  mainnetPublicClient: PublicClient;
  /** Public client for Base */
  basePublicClient: PublicClient;
}

/**
 * Error class for CowSwap operations
 */
export class CowSwapError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "CowSwapError";
  }
}

/**
 * CowSwap Client for interacting with CowSwap Protocol
 * Maintains separate SDK instances for each supported chain
 */
export class CowSwapClient {
  private readonly mainnetSdk: TradingSdk;
  private readonly baseSdk: TradingSdk;

  constructor(config: CowSwapClientConfig) {
    // Initialize mainnet SDK
    const mainnetAdapter = new ViemAdapter({
      provider: config.mainnetPublicClient,
      walletClient: config.walletClient,
    });
    this.mainnetSdk = new TradingSdk(
      { appCode: "app.rift.trade", chainId: SupportedChainId.MAINNET },
      {},
      mainnetAdapter
    );

    // Initialize Base SDK
    const baseAdapter = new ViemAdapter({
      provider: config.basePublicClient,
      walletClient: config.walletClient,
    });
    this.baseSdk = new TradingSdk(
      { appCode: "app.rift.trade", chainId: SupportedChainId.BASE },
      {},
      baseAdapter
    );
  }

  /**
   * Get the SDK instance for a specific chain
   */
  getSdk(chainId: CowSwapSupportedChain = SupportedChainId.MAINNET): TradingSdk {
    return chainId === SupportedChainId.BASE ? this.baseSdk : this.mainnetSdk;
  }

  /**
   * Expose the mainnet TradingSdk instance (for backwards compatibility)
   */
  get sdk(): TradingSdk {
    return this.mainnetSdk;
  }

  /**
   * Get a quote for selling a token for cbBTC
   * Returns the full QuoteResults object from the SDK
   */
  async getQuote(request: CowSwapQuoteRequest): Promise<QuoteResults> {
    try {
      // Validate that exactly one of buyAmount or sellAmount is provided
      const hasBuyAmount = request.buyAmount !== undefined;
      const hasSellAmount = request.sellAmount !== undefined;

      if (hasBuyAmount === hasSellAmount) {
        throw new CowSwapError(
          "Exactly one of buyAmount or sellAmount must be provided",
          "INVALID_REQUEST"
        );
      }

      const sellToken =
        request.sellToken === "0x0000000000000000000000000000000000000000"
          ? NATIVE_ETH_ADDRESS
          : request.sellToken;
      const validFor = request.validFor ?? DEFAULT_VALID_FOR_SECONDS;
      const slippageBps = request.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
      const chainId = request.chainId ?? SupportedChainId.MAINNET;

      // Determine order kind
      const isBuyOrder = hasBuyAmount;

      // Build TradeParameters for TradingSdk
      const tradeParameters: TradeParameters = {
        kind: isBuyOrder ? OrderKind.BUY : OrderKind.SELL,
        sellToken,
        sellTokenDecimals: request.decimals,
        buyToken: CBBTC_ADDRESS,
        buyTokenDecimals: 8, // cbBTC has 8 decimals
        amount: isBuyOrder ? request.buyAmount! : request.sellAmount!,
        slippageBps,
        validFor,
        receiver: request.receiver,
      };

      // Configure advanced settings for fast price quality quote
      const advancedSettings: SwapAdvancedSettings = {
        quoteRequest: {
          priceQuality: request.priceQuality ?? PriceQuality.OPTIMAL,
        },
      };

      // Get quote from chain-specific SDK
      const sdk = this.getSdk(chainId);
      const { quoteResults } = await sdk.getQuote(tradeParameters, advancedSettings);
      return quoteResults;
    } catch (error) {
      if (error instanceof CowSwapError) {
        throw error;
      }
      throw new CowSwapError(
        `Failed to get CowSwap quote: ${error instanceof Error ? error.message : "Unknown error"}`,
        "QUOTE_ERROR",
        error
      );
    }
  }

  /**
   * Submit a swap order using TradingSdk
   */
  async submitOrder(request: CowSwapQuoteRequest): Promise<string> {
    try {
      // Validate that buyAmount is provided (only BUY orders supported)
      if (!request.buyAmount) {
        throw new CowSwapError(
          "buyAmount must be provided for order submission",
          "INVALID_REQUEST"
        );
      }

      const sellToken =
        request.sellToken === "0x0000000000000000000000000000000000000000"
          ? NATIVE_ETH_ADDRESS
          : request.sellToken;
      const validFor = request.validFor ?? DEFAULT_VALID_FOR_SECONDS;
      const slippageBps = request.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
      const chainId = request.chainId ?? SupportedChainId.MAINNET;

      // Build TradeParameters for exact output (BUY) order
      const tradeParameters: TradeParameters = {
        kind: OrderKind.BUY,
        sellToken,
        sellTokenDecimals: request.decimals,
        buyToken: CBBTC_ADDRESS,
        buyTokenDecimals: 8, // cbBTC has 8 decimals
        amount: request.buyAmount,
        slippageBps,
        validFor,
        receiver: request.receiver,
      };

      // Submit order using chain-specific SDK
      const sdk = this.getSdk(chainId);
      const { orderId } = await sdk.postSwapOrder(tradeParameters);

      return orderId;
    } catch (error) {
      throw new CowSwapError(
        `Failed to submit order: ${error instanceof Error ? error.message : "Unknown error"}`,
        "SUBMIT_ORDER_ERROR",
        error
      );
    }
  }

  /**
   * Get the current CowProtocol allowance for a token
   * @param tokenAddress - Address of the token to check allowance for
   * @param owner - Address of the token owner
   * @param chainId - Chain to check on (defaults to mainnet)
   * @returns Current allowance as bigint (0n if undefined)
   */
  async getCowProtocolAllowance(params: {
    tokenAddress: Address;
    owner: Address;
    chainId?: CowSwapSupportedChain;
  }): Promise<bigint> {
    try {
      const sdk = this.getSdk(params.chainId ?? SupportedChainId.MAINNET);
      const allowance = await sdk.getCowProtocolAllowance({
        tokenAddress: params.tokenAddress,
        owner: params.owner,
      });
      // Return 0n if allowance is undefined (e.g., token not yet approved)
      if (allowance === undefined) {
        return 0n;
      }
      return allowance;
    } catch (error) {
      throw new CowSwapError(
        `Failed to get allowance: ${error instanceof Error ? error.message : "Unknown error"}`,
        "ALLOWANCE_ERROR",
        error
      );
    }
  }

  /**
   * Approve CowProtocol to spend tokens
   * @param tokenAddress - Address of the token to approve
   * @param amount - Amount to approve (defaults to max uint256 for unlimited approval)
   * @param chainId - Chain to approve on (defaults to mainnet)
   * @returns Transaction hash
   */
  async approveCowProtocol(params: {
    tokenAddress: Address;
    amount?: bigint;
    chainId?: CowSwapSupportedChain;
  }): Promise<`0x${string}`> {
    try {
      const sdk = this.getSdk(params.chainId ?? SupportedChainId.MAINNET);

      const txHash = await sdk.approveCowProtocol({
        tokenAddress: params.tokenAddress,
        amount: params.amount ?? maxUint256,
      });
      return txHash as `0x${string}`;
    } catch (error) {
      throw new CowSwapError(
        `Failed to approve: ${error instanceof Error ? error.message : "Unknown error"}`,
        "APPROVAL_ERROR",
        error
      );
    }
  }
}

/**
 * Helper to check if an order is expired
 */
export const isOrderExpired = (expiresAt: Date): boolean => {
  return new Date() > expiresAt;
};

/**
 * Helper to get time until expiration in milliseconds
 */
export const getTimeToExpiration = (expiresAt: Date): number => {
  return Math.max(0, expiresAt.getTime() - Date.now());
};
