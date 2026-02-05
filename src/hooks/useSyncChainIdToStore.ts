import { useEffect } from "react";
import { useChainId } from "wagmi";
import { useStore } from "../utils/store";

/**
 * Monitors chain changes and resets the switching flag.
 * Note: Chain ID is now derived from the input token, not stored globally.
 */
export function useSyncChainIdToStore() {
  const chainId = useChainId();
  const setSwitchingToInputTokenChain = useStore((state) => state.setSwitchingToInputTokenChain);

  useEffect(() => {
    if (chainId) {
      setSwitchingToInputTokenChain(false);
    }
  }, [chainId, setSwitchingToInputTokenChain]);
}
