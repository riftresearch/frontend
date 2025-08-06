import { useEffect } from "react";
import { useChainId } from "wagmi";
import { useStore } from "../utils/store";

/**
 * Syncs the current wagmi chainId to the global store's connectedChainId.
 * Ensures the store always reflects the latest connected chain.
 */
export function useSyncChainIdToStore() {
  const chainId = useChainId();
  const setEvmConnectWalletChainId = useStore(
    (state) => state.setEvmConnectWalletChainId
  );

  useEffect(() => {
    if (chainId) {
      setEvmConnectWalletChainId(chainId);
    }
  }, [chainId, setEvmConnectWalletChainId]);
}
