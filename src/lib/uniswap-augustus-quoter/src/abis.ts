// Uniswap V4 Quoter ABI
export const V4_QUOTER_ABI = [
  {
    inputs: [
      {
        components: [
          {
            components: [
              { internalType: "address", name: "currency0", type: "address" },
              { internalType: "address", name: "currency1", type: "address" },
              { internalType: "uint24", name: "fee", type: "uint24" },
              { internalType: "int24", name: "tickSpacing", type: "int24" },
              { internalType: "address", name: "hooks", type: "address" }
            ],
            internalType: "struct PoolKey",
            name: "poolKey",
            type: "tuple"
          },
          { internalType: "bool", name: "zeroForOne", type: "bool" },
          { internalType: "uint256", name: "exactAmount", type: "uint256" },
          { internalType: "bytes", name: "hookData", type: "bytes" }
        ],
        internalType: "struct QuoteExactSingleParams",
        name: "params",
        type: "tuple"
      }
    ],
    name: "quoteExactInputSingle",
    outputs: [
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      { internalType: "uint256", name: "gasEstimate", type: "uint256" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        components: [
          {
            components: [
              { internalType: "address", name: "currency0", type: "address" },
              { internalType: "address", name: "currency1", type: "address" },
              { internalType: "uint24", name: "fee", type: "uint24" },
              { internalType: "int24", name: "tickSpacing", type: "int24" },
              { internalType: "address", name: "hooks", type: "address" }
            ],
            internalType: "struct PoolKey",
            name: "poolKey",
            type: "tuple"
          },
          { internalType: "bool", name: "zeroForOne", type: "bool" },
          { internalType: "uint256", name: "exactAmount", type: "uint256" },
          { internalType: "bytes", name: "hookData", type: "bytes" }
        ],
        internalType: "struct QuoteExactSingleParams",
        name: "params",
        type: "tuple"
      }
    ],
    name: "quoteExactOutputSingle",
    outputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "gasEstimate", type: "uint256" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "currencyIn", type: "address" },
          {
            components: [
              { internalType: "address", name: "intermediateCurrency", type: "address" },
              { internalType: "uint24", name: "fee", type: "uint24" },
              { internalType: "int24", name: "tickSpacing", type: "int24" },
              { internalType: "address", name: "hooks", type: "address" }
            ],
            internalType: "struct PathKey[]",
            name: "path",
            type: "tuple[]"
          },
          { internalType: "uint256", name: "exactAmount", type: "uint256" }
        ],
        internalType: "struct QuoteExactParams",
        name: "params",
        type: "tuple"
      }
    ],
    name: "quoteExactInput",
    outputs: [
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      { internalType: "uint256", name: "gasEstimate", type: "uint256" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "currencyIn", type: "address" },
          {
            components: [
              { internalType: "address", name: "intermediateCurrency", type: "address" },
              { internalType: "uint24", name: "fee", type: "uint24" },
              { internalType: "int24", name: "tickSpacing", type: "int24" },
              { internalType: "address", name: "hooks", type: "address" }
            ],
            internalType: "struct PathKey[]",
            name: "path",
            type: "tuple[]"
          },
          { internalType: "uint256", name: "exactAmount", type: "uint256" }
        ],
        internalType: "struct QuoteExactParams",
        name: "params",
        type: "tuple"
      }
    ],
    name: "quoteExactOutput",
    outputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "gasEstimate", type: "uint256" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;

// Pool Manager ABI (minimal for pool existence checks)
export const POOL_MANAGER_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "currency0", type: "address" },
          { internalType: "address", name: "currency1", type: "address" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          { internalType: "int24", name: "tickSpacing", type: "int24" },
          { internalType: "address", name: "hooks", type: "address" }
        ],
        internalType: "struct PoolKey",
        name: "key",
        type: "tuple"
      }
    ],
    name: "getPoolId",
    outputs: [
      { internalType: "bytes32", name: "", type: "bytes32" }
    ],
    stateMutability: "pure",
    type: "function"
  }
] as const;

// ERC20 ABI (minimal for token operations)
export const ERC20_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  }
] as const;