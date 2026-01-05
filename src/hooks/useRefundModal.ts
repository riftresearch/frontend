import { useState, useEffect } from "react";
import { useWalletClient } from "wagmi";
import { useRouter } from "next/router";
import { AdminSwapItem } from "@/utils/types";
import { validateRefundAddress, formatRefundError } from "@/utils/refundHelpers";
import { toastSuccess, toastError } from "@/utils/toast";
import { esploraClient, estimateRefundTxSize } from "@/utils/esploraClient";

interface UseRefundModalOptions {
  onSuccess?: () => void;
  redirectOnSuccess?: boolean;
}

export const useRefundModal = (options: UseRefundModalOptions = {}) => {
  const { data: walletClient } = useWalletClient();
  const router = useRouter();
  const { onSuccess, redirectOnSuccess = false } = options;

  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedFailedSwap, setSelectedFailedSwap] = useState<AdminSwapItem | null>(null);
  const [refundAddress, setRefundAddress] = useState("");
  const [isClaimingRefund, setIsClaimingRefund] = useState(false);
  const [refundStatus, setRefundStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [currentBitcoinFee, setCurrentBitcoinFee] = useState<number | null>(null);
  const [fetchingFee, setFetchingFee] = useState(false);

  // Fetch current Bitcoin fee when modal opens for Bitcoin refunds
  useEffect(() => {
    async function fetchBitcoinFee() {
      if (!refundModalOpen || !selectedFailedSwap) return;

      // Only fetch fee for Bitcoin refunds (BTC_TO_EVM direction = user deposited BTC, needs BTC refund)
      const isBitcoinRefund = selectedFailedSwap.direction === "BTC_TO_EVM";
      if (!isBitcoinRefund) return;

      setFetchingFee(true);
      try {
        // Get medium priority fee (3 blocks)
        const feeRate = await esploraClient.getRecommendedFee(1);

        // Estimate transaction size for a typical refund (1 input, 1 output, segwit)
        const txSize = estimateRefundTxSize("segwit");

        // Calculate total fee in satoshis
        const totalFee = esploraClient.calculateFee(feeRate, txSize);

        setCurrentBitcoinFee(totalFee);
        console.log("[REFUND FEE] Fetched Bitcoin fee:", {
          feeRate: `${feeRate} sat/vB`,
          txSize: `${txSize} vBytes`,
          totalFee: `${totalFee} sats`,
        });
      } catch (error) {
        console.error("[REFUND FEE] Failed to fetch Bitcoin fee:", error);
        // Default to 0 if we can't fetch the fee
        setCurrentBitcoinFee(0);
      } finally {
        setFetchingFee(false);
      }
    }

    fetchBitcoinFee();
  }, [refundModalOpen, selectedFailedSwap]);

  const openRefundModal = (swap: AdminSwapItem) => {
    setSelectedFailedSwap(swap);
    setRefundModalOpen(true);
    setRefundAddress("");
    setRefundStatus("idle");
    setCurrentBitcoinFee(null); // Reset fee when opening modal
  };

  const closeRefundModal = () => {
    setRefundModalOpen(false);
    setSelectedFailedSwap(null);
    setRefundAddress("");
    setRefundStatus("idle");
    setIsClaimingRefund(false);
  };

  const claimRefund = async () => {
    if (!selectedFailedSwap || !walletClient) {
      if (!walletClient) {
        toastError(null, {
          title: "Wallet not connected",
          description: "Please connect your wallet to claim a refund.",
        });
      }
      return;
    }

    // Check if address is empty
    if (!refundAddress || refundAddress.trim() === "") {
      toastError(null, {
        title: "Address required",
        description: "Please enter your refund address.",
      });
      return;
    }

    // Validate the refund address format
    const addressType = selectedFailedSwap.direction === "BTC_TO_EVM" ? "bitcoin" : "ethereum";
    if (!validateRefundAddress(refundAddress, addressType)) {
      toastError(null, {
        title: "Invalid address",
        description: `Please enter a valid ${addressType === "bitcoin" ? "Bitcoin" : "Ethereum"} address.`,
      });
      return;
    }

    setIsClaimingRefund(true);
    setRefundStatus("loading");

    try {
      // Determine the fee to use
      const isBitcoinRefund = selectedFailedSwap.direction === "BTC_TO_EVM";
      const feeToUse =
        isBitcoinRefund && currentBitcoinFee !== null ? currentBitcoinFee.toString() : "0";

      console.log("[CLAIM REFUND] Starting refund claim:", {
        swapId: selectedFailedSwap.id,
        refundAddress,
        refundFee: feeToUse,
        isBitcoinRefund,
      });

      // TODO: Replace with actual riftApiClient refund when endpoint is available
      // Currently stubbed - throw error to indicate refunds not yet supported
      throw new Error("Refund functionality is temporarily unavailable. Please try again later.");

      setRefundStatus("success");
      toastSuccess({
        title: "Refund claimed!",
        description: "Your refund has been successfully processed. It will arrive shortly.",
      });

      // Wait before closing modal
      setTimeout(() => {
        closeRefundModal();

        // Call success callback if provided
        if (onSuccess) {
          onSuccess();
        }

        // Redirect to home if requested
        if (redirectOnSuccess) {
          router.push("/");
        }
      }, 2000);
    } catch (error) {
      console.error("[CLAIM REFUND] Error:", error);
      setRefundStatus("error");

      const errorMessage = formatRefundError(error);
      toastError(error, {
        title: "Refund failed",
        description: errorMessage,
      });
    } finally {
      setIsClaimingRefund(false);
    }
  };

  return {
    refundModalOpen,
    selectedFailedSwap,
    refundAddress,
    setRefundAddress,
    isClaimingRefund,
    refundStatus,
    currentBitcoinFee,
    fetchingFee,
    openRefundModal,
    closeRefundModal,
    claimRefund,
  };
};
