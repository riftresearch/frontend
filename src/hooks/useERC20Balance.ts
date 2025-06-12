import { useReadContract } from "wagmi";
import { type Address, formatUnits } from "viem";
import { ERC20 } from "@/utils/contractArtifacts";

interface UseERC20BalanceParams {
  /** The user's wallet address */
  userAddress?: Address;
  /** The ERC20 token contract address */
  tokenAddress?: Address;
  /** Whether the query should be enabled (defaults to true when both addresses are provided) */
  enabled?: boolean;
}

interface UseERC20BalanceReturn {
  /** Raw balance in wei/smallest unit */
  balance: bigint | undefined;
  /** Formatted balance as string (with decimals) */
  formattedBalance: string | undefined;
  /** Whether the query is currently loading */
  isLoading: boolean;
  /** Whether the query is pending (initial load) */
  isPending: boolean;
  /** Error object if the query failed */
  error: Error | null;
  /** Function to manually refetch the balance */
  refetch: () => void;
}

/**
 * Custom hook to read ERC20 token balance for a given user and token address
 *
 * @param params - Configuration object with userAddress, tokenAddress, and optional enabled flag
 * @returns Object containing balance data, loading states, error, and refetch function
 *
 * @example
 * ```typescript
 * const { balance, formattedBalance, isLoading, error } = useERC20Balance({
 *   userAddress: '0x123...',
 *   tokenAddress: '0xA0b86a33E6416c06F4c09d7E7D69d5E6A5F3D6a3',
 * })
 * ```
 */
export function useERC20Balance({
  userAddress,
  tokenAddress,
  enabled = true,
}: UseERC20BalanceParams): UseERC20BalanceReturn {
  // Fetch the token's decimal places
  const { data: decimals, isLoading: decimalsLoading } = useReadContract({
    address: tokenAddress,
    abi: ERC20.abi,
    functionName: "decimals",
    query: {
      enabled: enabled && !!tokenAddress,
    },
  });

  // Fetch the user's balance
  const {
    data: balance,
    isLoading: balanceLoading,
    isPending,
    error,
    refetch,
  } = useReadContract({
    address: tokenAddress,
    abi: ERC20.abi,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: enabled && !!userAddress && !!tokenAddress,
    },
  });

  // Combine loading states
  const isLoading = balanceLoading || decimalsLoading;

  // Format balance using the token's actual decimal places
  const formattedBalance =
    balance && decimals !== undefined
      ? formatUnits(balance as bigint, decimals as number)
      : undefined;

  return {
    balance: balance as bigint | undefined,
    formattedBalance,
    isLoading,
    isPending,
    error,
    refetch,
  };
}
