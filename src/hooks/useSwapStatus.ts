import { useEffect, useState, useCallback, useRef } from "react";
import { useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { parseEventLogs, keccak256 } from "viem";
import { useQuery } from "@tanstack/react-query";
import esplora from "@interlay/esplora-btc-api";
import { sha256 } from "viem";
import {
  btcDutchAuctionHouseAbi,
  useReadBtcDutchAuctionHouseAuctionHashes,
} from "@/generated";
import { hashDutchAuction } from "@/utils/contractUtils";
import { CHAIN_SCOPED_CONFIGS } from "@/utils/constants";
import { OTCSwap, createDataEngineClient } from "@/utils/dataEngineClient";

interface UseSwapStatusParams {
  /** Chain id of the chain the transaction was sent on */
  chainId: number;
  /** Transaction hash to track (0x prefixed string) */
  txHash: `0x${string}`;
}

type SwapStatus =
  | "validating_tx" // Checking if transaction exists
  | "invalid_tx" // Auction transaction hash format is invalid
  | "tx_not_found" // Auction transaction doesn't exist
  | "tx_pending" // Auction transaction is pending
  | "tx_failed" // Auction transaction failed/reverted
  | "auction_created" // Auction was successfully created
  | "auction_expired" // Auction expired without being filled
  | "auction_refunded" // Auction was refunded
  | "order_created" // Order was created (auction was filled)
  | "order_refunded" // Order was refunded
  | "payment_observed_on_bitcoin" // Bitcoin payment was sent to the order (observed on bitcoin, no proof of this on the EVM side yet)
  | "payment_proof_submitted" // Bitcoin payment was sent to the order (implying challenge period is active)
  | "order_settled"; // Order was settled

interface SwapState {
  status: SwapStatus;
  error: string | null;
}

interface UseSwapStatusReturn {
  /** Unified state containing status and error */
  state: SwapState;
  /** Transaction receipt data */
  receipt: any;
  /** Function to manually validate the transaction hash */
  validateTxHash: () => void;
  /** Auction index if this is an auction transaction */
  auctionIndex: bigint | null;
  /** Auction data of the auction transaction */
  auction: any | null;
  /** OTC swap data of the order */
  otcSwap: OTCSwap | null;
}

enum DutchAuctionState {
  Created = 0,
  Filled = 1,
  Refunded = 2,
}

/**
 * Custom hook to track swap transaction status and validate transaction hash
 *
 * @param params - Configuration object with txHash
 * @returns Object containing transaction status, validation state, and helper functions
 *
 * @example
 * ```typescript
 * const {
 *   isValidTxHash,
 *   isValidating,
 *   isPending,
 *   isSuccess,
 *   isError,
 *   validateTxHash
 * } = useSwapStatus({
 *   txHash: '0x123...'
 * });
 * ```
 */
export function useSwapStatus({
  txHash,
  chainId,
}: UseSwapStatusParams): UseSwapStatusReturn {
  console.log("[useSwapStatus] Hook initialized with", { txHash, chainId });

  const chainConfig = CHAIN_SCOPED_CONFIGS[chainId];
  const publicClient = usePublicClient({ chainId });
  // Check if txHash is properly formatted
  const isProperlyFormatted =
    !!txHash && txHash.startsWith("0x") && txHash.length === 66;

  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [auctionIndex, setAuctionIndex] = useState<bigint | null>(null);
  const [order, setOrder] = useState<any | null>(null);
  const [auctionData, setAuctionData] = useState<any | null>(null);
  const [auctionStatus, setAuctionStatus] = useState<
    "created" | "filled" | "refunded" | "expired" | null
  >(null);
  const [state, setState] = useState<SwapState>({
    status: "validating_tx",
    error: null,
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create data engine client
  const dataEngineClient = chainConfig?.dataEngineUrl
    ? createDataEngineClient({ baseUrl: chainConfig.dataEngineUrl })
    : null;

  // Query order status using data engine
  const {
    data: orderData,
    isLoading: isOrderLoading,
    error: orderError,
  } = useQuery({
    queryKey: ["order-status", order?.order?.index?.toString()],
    queryFn: async () => {
      console.log("attempting to get order", order);
      console.log("order index", Number(order.order.index));
      let result;
      try {
        result = await dataEngineClient!.getOrder(Number(order.order.index));
      } catch (error) {
        console.error("error getting order", error);
        return null;
      }
      console.log("[useSwapStatus] getOrder response:", {
        orderIndex: order.order.index,
        response: result,
        timestamp: new Date().toISOString(),
      });
      return result;
    },
    enabled:
      !!dataEngineClient &&
      !!order &&
      order.order.state !== 2 /* Refunded */ &&
      order.order.state !== 1 /* Settled */,
    refetchInterval: 5000, // Refetch every 5 seconds
    staleTime: 0, // Always consider data stale to ensure fresh queries
  });

  // Query for Bitcoin payment UTXOs
  const { data: bitcoinPaymentDetected, isLoading: isBitcoinPaymentLoading } =
    useQuery({
      queryKey: [
        "bitcoin-payment-utxos",
        order?.order?.bitcoinScriptPubKey,
        order?.order?.expectedSats.toString(),
        chainConfig?.esploraUrl,
      ],
      queryFn: async () => {
        console.log("[useSwapStatus] Checking for Bitcoin payment", {
          scriptPubKey: order.order.bitcoinScriptPubKey,
          expectedSats: order.order.expectedSats,
          esploraUrl: chainConfig?.esploraUrl,
        });

        const scriptPubKey = order.order.bitcoinScriptPubKey;
        const expectedSats = order.order.expectedSats;

        // Convert hex script pub key to script hash for esplora
        // Script pub key is a hex string like "0x...", we need to remove the 0x prefix
        const scriptHex = scriptPubKey.startsWith("0x")
          ? scriptPubKey.slice(2)
          : scriptPubKey;

        // TODO: We have to validate if all this actually works.

        console.log("scriptHex", scriptHex);

        // Esplora expects the script hash as a reversed SHA256 hash of the script
        // Use viem's sha256 function which returns a hex string
        const hash = sha256(`0x${scriptHex}`);
        // Remove 0x prefix and reverse the bytes
        const hashWithoutPrefix = hash.slice(2);
        const reversedHash =
          hashWithoutPrefix.match(/.{2}/g)?.reverse().join("") || "";
        const scriptHash = reversedHash;

        const scripthashApi = new esplora.ScripthashApi({
          basePath: chainConfig!.esploraUrl,
          isJsonMime: (mime) => mime.startsWith("application/json"),
        });

        try {
          console.log("scriptHash", scriptHash);
          // Get UTXOs for the script hash
          const { data: utxos } =
            await scripthashApi.getTxsByScripthash(scriptHash);

          console.log("[useSwapStatus] UTXOs found:", {
            count: utxos.length,
            utxos,
            expectedSats,
          });

          // Check if any UTXO has the exact expected amount
          const paymentFound = utxos.some((utxo) =>
            utxo.vout?.some((vout) => vout.value === expectedSats)
          );

          console.log("[useSwapStatus] Payment detection result:", {
            paymentFound,
            expectedSats,
          });

          return paymentFound;
        } catch (error) {
          console.error(
            "[useSwapStatus] Error checking Bitcoin payment:",
            error
          );
          return false;
        }
      },
      enabled:
        !!order &&
        order.order.state === 0 /* Created */ &&
        !!chainConfig?.esploraUrl,
      refetchInterval: 10000, // Check every 10 seconds
      staleTime: 0, // Always consider data stale
    });

  // Read auction hash from contract
  const {
    data: contractAuctionHash,
    isLoading: isLoadingAuctionHash,
    error: auctionHashError,
  } = useReadBtcDutchAuctionHouseAuctionHashes({
    chainId: chainId,
    address: chainConfig?.riftExchangeAddress as `0x${string}`,
    args: auctionIndex !== null ? [auctionIndex] : undefined,
    query: {
      enabled:
        auctionIndex !== null &&
        !!chainConfig &&
        !!chainConfig.riftExchangeAddress,
      refetchInterval: 2000, // Poll every 2 seconds
    },
  });

  // Log auction hash read status
  useEffect(() => {
    if (auctionIndex !== null) {
      console.log("[useSwapStatus] Auction hash read status", {
        auctionIndex: auctionIndex.toString(),
        contractAuctionHash,
        isLoadingAuctionHash,
        auctionHashError: auctionHashError?.toString(),
        hasChainConfig: !!chainConfig,
        riftExchangeAddress: chainConfig?.riftExchangeAddress,
        enabled:
          auctionIndex !== null &&
          !!chainConfig &&
          !!chainConfig.riftExchangeAddress,
      });
    }
  }, [
    auctionIndex,
    contractAuctionHash,
    isLoadingAuctionHash,
    auctionHashError,
    chainConfig,
  ]);

  // Use wagmi hook to wait for auction transaction receipt
  const {
    data: receipt,
    isLoading: isWagmiLoading,
    isSuccess: receiptSuccess,
    isError: receiptError,
    error: receiptErrorData,
    refetch,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: isProperlyFormatted && !hasTimedOut && !!chainConfig,
      retry: 4,
      retryDelay: 1000,
    },
  });

  useEffect(() => {
    if (order) {
      console.log("[useSwapStatus] Order state", order);
    }
  }, [order]);

  // Set up timeout for loading state
  useEffect(() => {
    if (isWagmiLoading && isProperlyFormatted) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout for 5 seconds
      timeoutRef.current = setTimeout(() => {
        console.log("Transaction lookup timed out");
        setHasTimedOut(true);
      }, 5000);
    } else {
      // Clear timeout if not loading
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isWagmiLoading, isProperlyFormatted]);

  // Manual validation function
  const validateTxHash = useCallback(() => {
    if (isProperlyFormatted) {
      setHasTimedOut(false);
      refetch();
    }
  }, [isProperlyFormatted, refetch]);

  // Update status based on chain and format validation
  useEffect(() => {
    console.log("[useSwapStatus] Chain/format validation effect triggered", {
      chainConfig: !!chainConfig,
      chainId,
      isProperlyFormatted,
      currentStatus: state.status,
    });

    if (!chainConfig) {
      console.log(
        "[useSwapStatus] No chain config found for chainId:",
        chainId
      );
      setState({
        status: "invalid_tx",
        error: `Unsupported chain ID: ${chainId}`,
      });
      return;
    }

    if (!isProperlyFormatted) {
      console.log("[useSwapStatus] Invalid tx hash format:", txHash);
      setState({
        status: "invalid_tx",
        error: "Invalid transaction hash format",
      });
      return;
    }

    // Reset error if validation passes
    if (state.status === "invalid_tx") {
      console.log("[useSwapStatus] Validation passed, resetting to validating");
      setState({ status: "validating_tx", error: null });
    }
  }, [chainConfig, chainId, isProperlyFormatted, state.status]);

  // Update status based on transaction loading state
  useEffect(() => {
    if (!chainConfig || !isProperlyFormatted) return;

    console.log("[useSwapStatus] Transaction loading state effect", {
      isWagmiLoading,
      hasTimedOut,
      receiptError: !!receiptError,
      receiptErrorMessage: receiptErrorData?.message,
      hasReceipt: !!receipt,
    });

    if (isWagmiLoading && !hasTimedOut) {
      console.log("[useSwapStatus] Setting status to validating");
      setState({ status: "validating_tx", error: null });
    } else if (hasTimedOut) {
      console.log("[useSwapStatus] Transaction lookup timed out");
      setState({
        status: "tx_not_found",
        error:
          "Transaction lookup timed out. The transaction may not exist or the network may be unavailable.",
      });
    } else if (receiptError) {
      console.log("[useSwapStatus] Receipt error:", receiptErrorData);
      setState({
        status: "tx_not_found",
        error: receiptErrorData?.message || "Transaction not found",
      });
    } else if (!receipt && !isWagmiLoading) {
      console.log("[useSwapStatus] No receipt and not loading - tx not found");
      setState({ status: "tx_not_found", error: "Transaction not found" });
    }
  }, [
    chainConfig,
    isProperlyFormatted,
    isWagmiLoading,
    hasTimedOut,
    receiptError,
    receiptErrorData,
    receipt,
  ]);

  // Update status based on transaction receipt
  useEffect(() => {
    if (!receipt || !chainConfig || !isProperlyFormatted) return;

    console.log("[useSwapStatus] Transaction receipt effect", {
      receiptSuccess,
      receiptStatus: receipt.status,
      hasAuctionData: !!auctionData,
      blockNumber: receipt.blockNumber?.toString(),
    });

    if (!receiptSuccess) {
      console.log("[useSwapStatus] Transaction pending");
      setState({ status: "tx_pending", error: null });
    } else if (receipt.status === "reverted") {
      console.log("[useSwapStatus] Transaction reverted");
      setState({ status: "tx_failed", error: "Transaction was reverted" });
    }
  }, [receipt, receiptSuccess, chainConfig, isProperlyFormatted, auctionData]);

  // Update status based on auction status and order
  useEffect(() => {
    if (!auctionData || !receiptSuccess || !receipt || !!order) return;

    console.log("[useSwapStatus] Auction status effect", {
      hasOrder: !!order,
      auctionStatus,
      auctionIndex: auctionIndex?.toString(),
    });

    if (order && order.order.state === 0) {
      console.log("[useSwapStatus] Order created!", order);
      setState({ status: "order_created", error: null });
      return;
    }

    console.log(
      "[useSwapStatus] Setting status based on auction status:",
      auctionStatus
    );
    switch (auctionStatus) {
      case "created":
        setState({ status: "auction_created", error: null });
        break;
      case "expired":
        setState({
          status: "auction_expired",
          error: "Auction expired without being filled",
        });
        break;
      case "refunded":
        setState({ status: "auction_refunded", error: "Auction was refunded" });
        break;
      case "filled":
        setState({ status: "order_created", error: null });
        break;
    }
  }, [auctionData, order, auctionStatus, receiptSuccess, receipt]);

  useEffect(() => {
    if (receipt && receipt.status === "success") {
      let logs;
      try {
        logs = parseEventLogs({
          abi: btcDutchAuctionHouseAbi,
          eventName: "AuctionUpdated",
          logs: receipt?.logs || [],
          strict: false,
        });
      } catch (error) {
        // TODO: do we need to do anything here?
        return;
      }

      if (!logs || logs.length === 0) {
        // Not an auction transaction - could be a regular transaction
        return;
      }

      if (logs.length !== 1) {
        // Invalid auction transaction
        return;
      }

      console.log("auction logs", logs[0]);

      const firstLog = logs[0];
      if (!firstLog?.args?.auction) {
        // Auction event is busted?
        return;
      }

      const extractedAuctionIndex = firstLog.args.auction.index;
      const auctionData = firstLog.args.auction;
      setAuctionIndex(extractedAuctionIndex);
      setAuctionData(auctionData);
      // TODO(claude-ignore): We need to build a way to allow the user to manually refund their auction

      /* We have to use some clever block searching to get the state of the auction.
       We have the block number when the auction was created, and we also have the deadline when the auction becomes unfillable.
       We also know that the auction hash stored at that auction index will only change if the auction gets Filled or Refunded. We also know exactly HOW 
       the auction hash will change (by the state field changing to Filled or Refunded) - this means we can precompute what the auction hashes could be.
       ```enum DutchAuctionState {
            Created,
            Filled,
            Refunded
        }```
        So with all of this in mind, once we have an auction index, auction creation block number and the auction deadline, additionally we have the full 
        initial auction struct so we can compute the initial auction hash.

        We then lookup the auction hash from the contract @ the auction index.
        If both hashes match, we first lookup the current block's time. If the time has passed the deadline, we can immediately set an error string saying the auction is over and no one filled it.
        If both hashes match, but the block time is before the deadline, we can subscribe to new blocks and when a new block comes in we can re-run the above logic.
        If hashes differ, then that means it's either been filled or refunded.
        Before we begin the block search, remember we have the precomputed auction hashes for each possible state. So we can immediately determine if the auction has been filled or refunded.
        Thus, if the auction hash in the contract is equal to the theoretical auction hash with the refunded state - we can immediately set an error string saying the auction was refunded. 

        Finally at this point, we know the auction has definitely been filled.
        So we begin the search for where the order was created as a result of the auction being filled.

        To determine this, remember that we have the start block number (and implicitly start timestamp) and a deadline.
        Using the start timestamp and a known average block time, we can infer what block number might be associated with the deadline.
        We round up to the nearest block number for this calculation.
        Now we have a start block number and an end block number. We can use these to create a getLogs request for all `AuctionUpdated` events during the time period.
        Then we sift through the events to find the one that matches our auction index.
        Once we find this AuctionUpdated event, we know for a fact that the log exactly index - 1 behind it will be an OrderCreated event.
        Once we find this OrderCreated event, we now have an order,
        and thus we store that order in our hook state.


      */
    }
  }, [receipt]);

  // Track auction status based on auction hash
  useEffect(() => {
    const trackAuctionStatus = async () => {
      if (
        !auctionData ||
        !contractAuctionHash ||
        !publicClient ||
        !receipt ||
        auctionIndex === null
      ) {
        console.log(
          "[useSwapStatus] Skipping auction tracking - missing dependencies",
          {
            hasAuctionData: !!auctionData,
            hasContractAuctionHash: !!contractAuctionHash,
            hasPublicClient: !!publicClient,
            hasReceipt: !!receipt,
            auctionIndex,
          }
        );
        return;
      }

      console.log("[useSwapStatus] Starting auction tracking", {
        auctionIndex: auctionIndex.toString(),
        contractAuctionHash,
      });

      try {
        // Compute theoretical auction hashes for each state
        const createdHash = await hashDutchAuction({
          ...auctionData,
          state: DutchAuctionState.Created,
        });

        const filledHash = await hashDutchAuction({
          ...auctionData,
          state: DutchAuctionState.Filled,
        });

        const refundedHash = await hashDutchAuction({
          ...auctionData,
          state: DutchAuctionState.Refunded,
        });

        console.log("[useSwapStatus] Computed auction hashes", {
          createdHash,
          filledHash,
          refundedHash,
          contractAuctionHash,
        });

        // Check current auction state
        if (contractAuctionHash === createdHash) {
          console.log("[useSwapStatus] Auction is in Created state");
          // Auction is still in Created state
          const currentBlock = await publicClient.getBlock({
            blockTag: "latest",
          });
          const currentTimestamp = Number(currentBlock.timestamp);

          console.log("[useSwapStatus] Checking auction deadline", {
            currentTimestamp,
            deadline: Number(auctionData.dutchAuctionParams.deadline),
            isExpired:
              currentTimestamp >
              Number(auctionData.dutchAuctionParams.deadline),
          });

          if (
            currentTimestamp > Number(auctionData.dutchAuctionParams.deadline)
          ) {
            console.log("[useSwapStatus] Auction has expired");
            setAuctionStatus("expired");
          } else {
            console.log("[useSwapStatus] Auction is still active");
            setAuctionStatus("created");
          }
        } else if (contractAuctionHash === refundedHash) {
          console.log("[useSwapStatus] Auction was refunded");
          setAuctionStatus("refunded");
        } else if (contractAuctionHash === filledHash) {
          console.log(
            "[useSwapStatus] Auction was filled, searching for order"
          );
          setAuctionStatus("filled");

          // Search for the OrderCreated event
          const creationBlock = receipt!.blockNumber;
          console.log("auctionData", auctionData);
          const deadlineTimestamp = Number(
            auctionData.dutchAuctionParams.deadline
          );

          console.log("[useSwapStatus] Fetching creation block timestamp", {
            creationBlock: creationBlock.toString(),
            deadline: auctionData.dutchAuctionParams.deadline,
            deadlineTimestamp,
          });

          const creationBlockData = await publicClient.getBlock({
            blockNumber: creationBlock,
          });
          const creationTimestamp = Number(creationBlockData.timestamp);

          console.log("[useSwapStatus] Calculating deadline block", {
            creationTimestamp,
            deadlineTimestamp,
            difference: deadlineTimestamp - creationTimestamp,
          });

          // Validate timestamps
          if (isNaN(deadlineTimestamp) || isNaN(creationTimestamp)) {
            console.error("[useSwapStatus] Invalid timestamps", {
              deadlineTimestamp,
              creationTimestamp,
              auctionDeadline: auctionData.dutchAuctionParams.deadline,
            });
            return;
          }

          // Estimate deadline block (assuming ~12 second blocks on mainnet)
          const secondsUntilDeadline = deadlineTimestamp - creationTimestamp;
          const blocksUntilDeadline = Math.max(
            1,
            Math.ceil(secondsUntilDeadline / 12)
          );
          const estimatedDeadlineBlock =
            creationBlock + BigInt(blocksUntilDeadline) + 1n;

          // Get logs for AuctionUpdated events
          const logs = await publicClient.getLogs({
            address: chainConfig.riftExchangeAddress as `0x${string}`,
            fromBlock: creationBlock,
            toBlock: estimatedDeadlineBlock,
          });

          // Find our auction update
          const auctionUpdateLog = logs.find((log) => {
            try {
              const decoded = parseEventLogs({
                abi: btcDutchAuctionHouseAbi,
                eventName: "AuctionUpdated",
                logs: [log],
              })[0];
              return (
                decoded.args.auction.index === auctionIndex &&
                decoded.args.auction.state !== 0 // 0 is created, so we don't want to include that only fills/refunds
              );
            } catch {
              return false;
            }
          });

          if (auctionUpdateLog) {
            // Get the full transaction receipt to find OrderCreated event
            const txReceipt = await publicClient.getTransactionReceipt({
              hash: auctionUpdateLog.transactionHash,
            });

            // Parse all logs in the transaction
            const auctionUpdateIndex = txReceipt.logs.findIndex(
              (log) => log.logIndex === auctionUpdateLog.logIndex
            );

            // OrderCreated should be right before AuctionUpdated
            if (auctionUpdateIndex > 0) {
              const orderCreatedLog = txReceipt.logs[auctionUpdateIndex - 1];

              try {
                console.log("orderCreatedLog", orderCreatedLog);
                const orderCreatedEvent = parseEventLogs({
                  abi: btcDutchAuctionHouseAbi,
                  eventName: "OrderCreated",
                  logs: [orderCreatedLog],
                })[0];
                console.log("orderCreatedEvent", orderCreatedEvent);

                setOrder(orderCreatedEvent.args);
              } catch (e) {
                console.error("Failed to parse OrderCreated event:", e);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error tracking auction status:", error);
      }
    };

    trackAuctionStatus();
  }, [auctionData, contractAuctionHash, publicClient, auctionIndex, receipt]);

  // Handle order data updates from data engine
  useEffect(() => {
    if (!orderData || !order) return;

    console.log("[useSwapStatus] Order data updated from data engine", {
      orderData,
      currentOrderState: order.order?.state,
      newOrderState: orderData.order.order.state,
    });

    console.log("orderData.order.order.state", orderData.order.order.state);
    if (orderData.payments.length > 0 && orderData.order.order.state === 0) {
      // only set this state if the order is created and a payment was sent
      setState({ status: "payment_proof_submitted", error: null });
    }

    // Update order state if it has changed
    if (orderData.order.order.state !== order.order?.state) {
      console.log("[useSwapStatus] Order state changed", {
        from: order.order?.state,
        to: orderData.order.order.state,
      });

      // Update the order with fresh data
      setOrder({
        order: orderData.order.order,
      });

      console.log("orderData.order.order.state", orderData.order.order.state);

      // Update swap status based on new order state (using numeric values)
      // OrderState: 0 = Created, 1 = Settled, 2 = Refunded
      if (orderData.order.order.state === 1) {
        setState({ status: "order_settled", error: null });
      } else if (orderData.order.order.state === 2) {
        setState({ status: "order_refunded", error: "Order was refunded" });
      }
    }
  }, [orderData, order]);

  // Handle Bitcoin payment detection
  useEffect(() => {
    if (
      bitcoinPaymentDetected &&
      order &&
      order.order.state === 0 &&
      state.status !== "payment_proof_submitted" &&
      state.status !== "payment_observed_on_bitcoin"
    ) {
      console.log("[useSwapStatus] Bitcoin payment detected on chain");
      setState({ status: "payment_observed_on_bitcoin", error: null });
    }
  }, [bitcoinPaymentDetected, order, state.status]);

  return {
    state,
    receipt,
    validateTxHash,
    auctionIndex,
    auction: auctionData || null,
    // This doesnt get populated until the order is created
    otcSwap: orderData || null,
  };
}
