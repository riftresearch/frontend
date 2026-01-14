/**
 * Hook for signing and broadcasting Bitcoin transactions using Dynamic Labs SDK
 */

import { useState, useCallback } from "react";
import { useUserWallets } from "@dynamic-labs/sdk-react-core";
import { isBitcoinWallet, BitcoinWallet } from "@dynamic-labs/bitcoin";
import * as bitcoin from "bitcoinjs-lib";
import {
  prepareDepositTransaction,
  broadcastBitcoinTransaction,
  fetchUserUtxos,
  getUtxoBalance,
} from "@/utils/bitcoinTransactionHelpers";

/**
 * Get the payment address from a Bitcoin wallet
 * Xverse and some other wallets have separate payment and ordinal addresses.
 * The payment address is needed for sending BTC transactions.
 */
export function getPaymentAddress(wallet: BitcoinWallet): string {
  // Debug: Log the entire wallet object to see what's available
  console.log("[getPaymentAddress] Wallet object:", wallet);
  console.log("[getPaymentAddress] Wallet address (default):", wallet.address);
  console.log(
    "[getPaymentAddress] Wallet additionalAddresses:",
    (wallet as any).additionalAddresses
  );

  // Check additionalAddresses for a payment address
  const additionalAddresses = (wallet as any).additionalAddresses as
    | Array<{ address: string; type: string; publicKey?: string }>
    | undefined;

  if (additionalAddresses && additionalAddresses.length > 0) {
    console.log("[getPaymentAddress] Found additionalAddresses:", additionalAddresses);
    const paymentAddr = additionalAddresses.find((addr) => addr.type === "payment");
    if (paymentAddr) {
      console.log("[getPaymentAddress] Found payment address:", paymentAddr.address);
      return paymentAddr.address;
    }
    console.log("[getPaymentAddress] No payment type found in additionalAddresses");
  } else {
    console.log("[getPaymentAddress] No additionalAddresses found");
  }

  // Fallback to the default wallet address
  console.log("[getPaymentAddress] Falling back to default address:", wallet.address);
  return wallet.address;
}

/**
 * Check if an address belongs to a Bitcoin wallet (either primary or additional)
 */
export function walletHasAddress(wallet: BitcoinWallet, address: string): boolean {
  // Check primary address
  if (wallet.address === address) {
    return true;
  }

  // Check additional addresses
  const additionalAddresses = (wallet as any).additionalAddresses as
    | Array<{ address: string; type: string }>
    | undefined;

  if (additionalAddresses) {
    return additionalAddresses.some((addr) => addr.address === address);
  }

  return false;
}

export interface UseBitcoinTransactionResult {
  /**
   * Send Bitcoin to a deposit address
   * @param userAddress - User's Bitcoin address to send from
   * @param depositAddress - Vault deposit address
   * @param amountSats - Amount to send in satoshis
   * @returns Transaction ID
   */
  sendBitcoin: (userAddress: string, depositAddress: string, amountSats: number) => Promise<string>;

  /**
   * Check if the user has sufficient balance
   * @param address - Bitcoin address to check
   * @param amountSats - Amount needed in satoshis
   * @param estimatedFee - Estimated fee in satoshis (default 2000)
   * @returns Object with balance info
   */
  checkBalance: (
    address: string,
    amountSats: number,
    estimatedFee?: number
  ) => Promise<{
    hasSufficientBalance: boolean;
    availableBalance: number;
    requiredAmount: number;
  }>;

  /**
   * Get all connected Bitcoin wallets
   */
  getBitcoinWallets: () => BitcoinWallet[];

  /**
   * Check if any Bitcoin wallet is connected
   */
  isBitcoinWalletConnected: () => boolean;

  /**
   * Loading state
   */
  isLoading: boolean;

  /**
   * Error state
   */
  error: Error | null;

  /**
   * Transaction state for UI
   */
  transactionState: "idle" | "preparing" | "signing" | "broadcasting" | "success" | "error";
}

export function useBitcoinTransaction(): UseBitcoinTransactionResult {
  const userWallets = useUserWallets();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [transactionState, setTransactionState] = useState<
    "idle" | "preparing" | "signing" | "broadcasting" | "success" | "error"
  >("idle");

  /**
   * Get all Bitcoin wallets from connected wallets
   */
  const getBitcoinWallets = useCallback((): BitcoinWallet[] => {
    return userWallets.filter((wallet) => isBitcoinWallet(wallet)) as BitcoinWallet[];
  }, [userWallets]);

  /**
   * Find a Bitcoin wallet by address (checks both primary and additional addresses)
   */
  const findBitcoinWalletByAddress = useCallback(
    (address: string): BitcoinWallet | null => {
      const btcWallets = getBitcoinWallets();
      return btcWallets.find((wallet) => walletHasAddress(wallet, address)) || null;
    },
    [getBitcoinWallets]
  );

  /**
   * Check if any Bitcoin wallet is connected
   */
  const isBitcoinWalletConnected = useCallback((): boolean => {
    return getBitcoinWallets().length > 0;
  }, [getBitcoinWallets]);

  /**
   * Check if user has sufficient balance
   */
  const checkBalance = useCallback(
    async (
      address: string,
      amountSats: number,
      estimatedFee: number = 2000
    ): Promise<{
      hasSufficientBalance: boolean;
      availableBalance: number;
      requiredAmount: number;
    }> => {
      if (!address) {
        return {
          hasSufficientBalance: false,
          availableBalance: 0,
          requiredAmount: amountSats + estimatedFee,
        };
      }

      try {
        const utxos = await fetchUserUtxos(address);
        const availableBalance = getUtxoBalance(utxos);
        const requiredAmount = amountSats + estimatedFee;

        return {
          hasSufficientBalance: availableBalance >= requiredAmount,
          availableBalance,
          requiredAmount,
        };
      } catch (err) {
        console.error("Failed to check balance:", err);
        return {
          hasSufficientBalance: false,
          availableBalance: 0,
          requiredAmount: amountSats + estimatedFee,
        };
      }
    },
    []
  );

  /**
   * Send Bitcoin to a deposit address
   */
  const sendBitcoin = useCallback(
    async (userAddress: string, depositAddress: string, amountSats: number): Promise<string> => {
      setIsLoading(true);
      setError(null);
      setTransactionState("preparing");

      try {
        // Validate user address
        if (!userAddress) {
          throw new Error("No Bitcoin address provided");
        }

        // Find the Bitcoin wallet that matches the user address
        const btcWallet = findBitcoinWalletByAddress(userAddress);
        if (!btcWallet) {
          throw new Error(
            `No Bitcoin wallet found for address ${userAddress}. Please ensure your Bitcoin wallet is connected.`
          );
        }

        // Get the payment address from the wallet (important for Xverse which has separate ordinal/payment addresses)
        const paymentAddress = getPaymentAddress(btcWallet);

        console.log("[BTC TX] Preparing deposit transaction...");
        console.log("[BTC TX] Requested address:", userAddress);
        console.log("[BTC TX] Payment address:", paymentAddress);
        console.log("[BTC TX] Deposit address:", depositAddress);
        console.log("[BTC TX] Amount (sats):", amountSats);

        // Step 1: Prepare the PSBT using the payment address
        const psbtResult = await prepareDepositTransaction(
          paymentAddress, // Use payment address for UTXO fetching and change
          depositAddress,
          amountSats,
          "medium" // Use medium fee priority
        );

        console.log("[BTC TX] PSBT prepared:", {
          fee: psbtResult.fee,
          inputTotal: psbtResult.inputTotal,
          changeAmount: psbtResult.changeAmount,
          feeRate: psbtResult.feeRate,
        });

        // Step 2: Sign the PSBT using Dynamic Labs SDK
        setTransactionState("signing");
        console.log("[BTC TX] Requesting wallet signature...");

        // Build the signing request
        // We need to sign all inputs in the PSBT
        const psbt = bitcoin.Psbt.fromBase64(psbtResult.psbtBase64);
        const signingIndexes = psbt.data.inputs.map((_, index) => index);

        const signPsbtRequest = {
          allowedSighash: [1], // SIGHASH_ALL
          unsignedPsbtBase64: psbtResult.psbtBase64,
          signature: [
            {
              address: paymentAddress, // Use payment address for signing
              signingIndexes,
            },
          ],
        };

        const signedPsbtResponse = await btcWallet.signPsbt(signPsbtRequest);

        if (!signedPsbtResponse?.signedPsbt) {
          throw new Error("Failed to sign PSBT - no signed PSBT returned");
        }

        console.log("[BTC TX] PSBT signed successfully");

        // Step 3: Finalize and extract raw transaction
        const signedPsbt = bitcoin.Psbt.fromBase64(signedPsbtResponse.signedPsbt);
        signedPsbt.finalizeAllInputs();
        const rawTxHex = signedPsbt.extractTransaction().toHex();

        console.log("[BTC TX] Raw transaction hex extracted");

        // Step 4: Broadcast the transaction
        setTransactionState("broadcasting");
        console.log("[BTC TX] Broadcasting transaction...");

        const txid = await broadcastBitcoinTransaction(rawTxHex);

        console.log("[BTC TX] Transaction broadcast successful!");
        console.log("[BTC TX] Transaction ID:", txid);

        setTransactionState("success");
        setIsLoading(false);
        return txid;
      } catch (err) {
        console.error("[BTC TX] Transaction failed:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setTransactionState("error");
        setIsLoading(false);
        throw err;
      }
    },
    [findBitcoinWalletByAddress]
  );

  return {
    sendBitcoin,
    checkBalance,
    getBitcoinWallets,
    isBitcoinWalletConnected,
    isLoading,
    error,
    transactionState,
  };
}
