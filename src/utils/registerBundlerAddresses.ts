import { registerCustomAddresses, addresses as morphoAddresses } from "@morpho-org/blue-sdk";
import { CHAIN_SCOPED_CONFIGS } from "@/utils/constants";

/**
 * Registers custom bundler addresses and validates existing ones
 * Should be called once during app initialization
 */
export function registerBundlerAddresses() {
  // Register custom bundler addresses only for custom chains (not mainnet/base)
  const customChainIds = [1337]; // Add other custom chain IDs here

  // Defensive check: ensure our mainnet/base addresses align with Morpho's addresses
  Object.entries(CHAIN_SCOPED_CONFIGS).forEach(([chainId, config]) => {
    const chainIdNum = Number(chainId);
    
    // Skip custom chains - they won't be in Morpho's registry
    if (customChainIds.includes(chainIdNum)) return;
    
    const morphoChainAddresses = morphoAddresses[chainIdNum];
    if (!morphoChainAddresses?.bundler3) {
      console.warn(`Chain ${chainId} not found in Morpho addresses registry`);
      return;
    }
    
    // Check if our addresses match Morpho's addresses
    const { bundler3, generalAdapter1 } = morphoChainAddresses.bundler3;
    
    if (config.bundler3.bundler3Address !== bundler3) {
      console.error(
        `Bundler3 address mismatch for chain ${chainId}:\n` +
        `  Our config: ${config.bundler3.bundler3Address}\n` +
        `  Morpho SDK: ${bundler3}`
      );
    }
    
    if (config.bundler3.generalAdapter1Address !== generalAdapter1) {
      console.error(
        `GeneralAdapter1 address mismatch for chain ${chainId}:\n` +
        `  Our config: ${config.bundler3.generalAdapter1Address}\n` +
        `  Morpho SDK: ${generalAdapter1}`
      );
    }
  });

  // Register custom addresses for custom chains only
  registerCustomAddresses({
    addresses: Object.fromEntries(
      Object.entries(CHAIN_SCOPED_CONFIGS)
        .filter(([chainId]) => customChainIds.includes(Number(chainId)))
        .map(([chainId, config]) => [
          chainId,
          {
            bundler3: {
              bundler3: config.bundler3.bundler3Address,
              generalAdapter1: config.bundler3.generalAdapter1Address,
              paraswapAdapter: config.bundler3.paraswapAdapterAddress,
              riftcbBTCAdapterAddress: config.bundler3.riftcbBTCAdapterAddress,
            },
            morpho: config.riftExchangeAddress, // Map RiftExchange to morpho for consistency
          },
        ])
    ),
  });
}