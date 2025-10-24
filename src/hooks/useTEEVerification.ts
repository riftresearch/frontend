import { useTDXAttestation } from "./useTDXAttestation";
import { useTEEChainSyncVerification } from "./useTEEChainSyncVerification";

/**
 * Combined TEE verification result
 */
interface TEEVerificationResult {
  /** Overall TEE verification status - true only if both attestation and chain sync pass */
  isVerified: boolean;
  /** Individual verification results */
  attestation: {
    isValid: boolean;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
  };
  chainSync: {
    isValid: boolean;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    verificationError?: string;
    ethereumBlockHeight?: bigint;
    bitcoinBlockHeight?: number;
  };
  /** Combined loading state - true if either verification is loading */
  isLoading: boolean;
  /** Combined error state - true if either verification has an error */
  hasError: boolean;
  /** Function to refetch both verifications */
  refetch: () => Promise<void>;
}

/**
 * Combined hook for comprehensive TEE verification
 *
 * Verifies both:
 * 1. TDX attestation (proves the code is running in a genuine TEE)
 * 2. Chain sync status (ensures TEE has up-to-date blockchain data)
 *
 * @returns Combined verification results and loading states
 */
export function useTEEVerification(): TEEVerificationResult {
  const tdxAttestation = useTDXAttestation();
  const chainSync = useTEEChainSyncVerification();

  // TEE is only fully verified if both attestation and chain sync pass
  const isVerified = Boolean(tdxAttestation.isValidTEE && chainSync.isTEESynced);

  // Combined loading state
  const isLoading = tdxAttestation.isLoading || chainSync.isLoading;

  // Combined error state
  const hasError = tdxAttestation.isError || chainSync.isError;

  // Combined refetch function
  const refetch = async () => {
    await Promise.all([tdxAttestation.refetch(), chainSync.refetch()]);
  };

  return {
    isVerified,
    attestation: {
      isValid: Boolean(tdxAttestation.isValidTEE),
      isLoading: tdxAttestation.isLoading,
      isError: tdxAttestation.isError,
      error: tdxAttestation.error,
    },
    chainSync: {
      isValid: chainSync.isTEESynced,
      isLoading: chainSync.isLoading,
      isError: chainSync.isError,
      error: chainSync.error,
      verificationError: chainSync.verificationError,
      ethereumBlockHeight: chainSync.ethereumBlockHeight,
      bitcoinBlockHeight: chainSync.bitcoinBlockHeight,
    },
    isLoading,
    hasError,
    refetch,
  };
}
