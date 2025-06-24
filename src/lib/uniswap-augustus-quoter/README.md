# Uniswap Augustus Quoter

A functional TypeScript library for getting Uniswap quotes and generating Augustus (ParaSwap) calldata, designed for use with forked chains.

## Usage

```typescript
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { getQuoteAndCalldata, AUGUSTUS_V5_MAINNET } from './uniswap-augustus-quoter';

// Create a viem client pointing to your fork
const client = createPublicClient({
  chain: mainnet,
  transport: http('http://127.0.0.1:8545'), // Your fork RPC
});

// Get quote and Augustus calldata
const result = await getQuoteAndCalldata(
  client,
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  1000000000000000000n, // 1 WETH
  '0xYourBeneficiaryAddress',
  {
    slippagePercent: 300, // 3%
    intermediateTokens: ['0x6B175474E89094C44Da98b954EedeAC495271d0F'], // DAI
  }
);

if (result) {
  console.log('Best route:', result.quote.adapter);
  console.log('Expected output:', result.minAmountOut);
  console.log('Augustus calldata:', result.calldata);
  
  // Send to Augustus contract
  // await wallet.sendTransaction({
  //   to: AUGUSTUS_V5_MAINNET,
  //   data: result.calldata,
  //   value: 0n
  // });
}
```

## Available Functions

### Main Functions

```typescript
// Get quote and calldata in one call
getQuoteAndCalldata(client, tokenIn, tokenOut, amountIn, beneficiary, options?)

// Just get the best quote
getBestQuote(client, tokenIn, tokenOut, amountIn, options?)

// Generate calldata from an existing quote
generateCalldata(quote, fromToken, toToken, fromAmount, beneficiary, slippagePercent?)

// Generate simple swapOnUniswap calldata
generateSwapOnUniswapCalldata(amountIn, amountOutMin, path)
```

### Lower-level Quote Functions

```typescript
// Quote specific paths
quoteV2(client, amountIn, path)
quoteV3Single(client, tokenIn, tokenOut, fee, amountIn)
quoteV3Multi(client, path, amountIn)

// Find best paths
findBestPath(client, tokenIn, tokenOut, amountIn, v3FeeTiers?)
findBestPathWithIntermediate(client, tokenIn, tokenOut, amountIn, intermediateTokens, v3FeeTiers?)
```

### Encoder Functions

```typescript
// Encode different Augustus functions
encodeSwapOnUniswap(amountIn, amountOutMin, path)
encodeMultiSwap(swapData)
encodeSimpleSwap(simpleSwapData)

// Build paths and calldata
buildPathFromQuote(quote, fromAmount, beneficiary, slippagePercent?)
buildCalldataFromQuote(quote, fromToken, toToken, fromAmount, beneficiary, slippagePercent?)
```

## Features

- Functional API - no classes
- On-chain path finding using Uniswap V2 and V3 quoters
- Automatic selection of best route (V2 vs V3, different fee tiers)
- Support for multi-hop paths with intermediate tokens
- Augustus calldata generation for:
  - `swapOnUniswap` (simple V2 swaps)
  - `multiSwap` (complex routes)
- Configurable slippage protection
- Pure TypeScript with viem (no external APIs needed)