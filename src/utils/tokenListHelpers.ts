import { UniswapTokenList, ValidAsset } from '../types';

/**
 * Deduplicates tokens in a token list to ensure only unique tokens per chain by address
 */
export function deduplicateTokens(tokenList: UniswapTokenList): UniswapTokenList {
    const addressChainMap = new Map<string, any>();

    tokenList.tokens.forEach((token) => {
        const key = `${token.chainId}-${token.address.toLowerCase()}`;
        if (!addressChainMap.has(key)) {
            addressChainMap.set(key, token);
        }
    });

    // Sort tokens alphabetically by symbol after deduplication
    const sortedTokens = Array.from(addressChainMap.values()).sort((a, b) =>
        a.symbol.toUpperCase().localeCompare(b.symbol.toUpperCase()),
    );

    return {
        ...tokenList,
        tokens: sortedTokens,
    };
}

/**
 * Merges a Uniswap token list into an existing record of valid assets.
 *
 * @param tokenList - The Uniswap token list object.
 * @param defaultAssetTemplate - A template ValidAsset (e.g. your BTC asset) that contains all required properties.
 * @param existingAssets - (Optional) Existing valid assets record to merge into.
 * @returns A new record of ValidAsset objects keyed by token symbol.
 */
export function mergeTokenListIntoValidAssets(
    tokenList: UniswapTokenList,
    defaultAssetTemplate: ValidAsset,
    existingAssets: Record<string, ValidAsset> = {},
): Record<string, ValidAsset> {
    const convertIpfsUri = (uri: string | undefined, gateway: string = 'https://ipfs.io/ipfs/') => {
        if (!uri) return null;
        if (uri.startsWith('ipfs://')) {
            // Remove the "ipfs://" prefix.
            let cid = uri.slice('ipfs://'.length);
            // If the CID starts with "ipfs/", remove that segment.
            if (cid.startsWith('ipfs/')) {
                cid = cid.slice('ipfs/'.length);
            }
            return gateway + cid;
        }
        return uri;
    };

    // Start with the provided existing assets
    const mergedAssets: Record<string, ValidAsset> = { ...existingAssets };

    tokenList.tokens.forEach((token) => {
        // Use a unique key based on chain ID and address
        const key = `${token.chainId}-${token.address.toLowerCase()}`;

        // The new asset is built by taking the template and overriding
        // properties with those from the token.
        mergedAssets[key] = {
            ...defaultAssetTemplate,
            ...token,
            // Override with token-specific data:
            display_name: token.symbol,
            tokenAddress: token.address,
            // If available, use the token's logo URI; otherwise, fall back to the template icon.
            icon_svg: convertIpfsUri(token.logoURI) || defaultAssetTemplate.icon_svg,
            fromTokenList: true,
        };
    });

    return mergedAssets;
}
