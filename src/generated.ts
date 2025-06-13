import {
  createUseReadContract,
  createUseWriteContract,
  createUseSimulateContract,
  createUseWatchContractEvent,
} from 'wagmi/codegen'

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// BTCDutchAuctionHouse
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const btcDutchAuctionHouseAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_mmrRoot', internalType: 'bytes32', type: 'bytes32' },
      { name: '_syntheticBitcoin', internalType: 'address', type: 'address' },
      {
        name: '_circuitVerificationKey',
        internalType: 'bytes32',
        type: 'bytes32',
      },
      { name: '_verifier', internalType: 'address', type: 'address' },
      { name: '_feeRouter', internalType: 'address', type: 'address' },
      { name: '_takerFeeBips', internalType: 'uint16', type: 'uint16' },
      {
        name: '_tipBlockLeaf',
        internalType: 'struct BlockLeaf',
        type: 'tuple',
        components: [
          { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
          { name: 'height', internalType: 'uint32', type: 'uint32' },
          {
            name: 'cumulativeChainwork',
            internalType: 'uint256',
            type: 'uint256',
          },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'accumulatedFees',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '_feeRouter', internalType: 'address', type: 'address' }],
    name: 'adminSetFeeRouter',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '_takerFeeBips', internalType: 'uint16', type: 'uint16' }],
    name: 'adminSetTakerFeeBips',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'auctionHashes',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'cancelOwnershipHandover',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    name: 'checkpoints',
    outputs: [
      { name: 'height', internalType: 'uint32', type: 'uint32' },
      { name: 'cumulativeChainwork', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'circuitVerificationKey',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'auction',
        internalType: 'struct DutchAuction',
        type: 'tuple',
        components: [
          { name: 'index', internalType: 'uint256', type: 'uint256' },
          {
            name: 'baseCreateOrderParams',
            internalType: 'struct BaseCreateOrderParams',
            type: 'tuple',
            components: [
              { name: 'owner', internalType: 'address', type: 'address' },
              {
                name: 'bitcoinScriptPubKey',
                internalType: 'bytes',
                type: 'bytes',
              },
              { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
              {
                name: 'confirmationBlocks',
                internalType: 'uint8',
                type: 'uint8',
              },
              {
                name: 'safeBlockLeaf',
                internalType: 'struct BlockLeaf',
                type: 'tuple',
                components: [
                  {
                    name: 'blockHash',
                    internalType: 'bytes32',
                    type: 'bytes32',
                  },
                  { name: 'height', internalType: 'uint32', type: 'uint32' },
                  {
                    name: 'cumulativeChainwork',
                    internalType: 'uint256',
                    type: 'uint256',
                  },
                ],
              },
            ],
          },
          {
            name: 'dutchAuctionParams',
            internalType: 'struct DutchAuctionParams',
            type: 'tuple',
            components: [
              { name: 'startBtcOut', internalType: 'uint256', type: 'uint256' },
              { name: 'endBtcOut', internalType: 'uint256', type: 'uint256' },
              { name: 'decayBlocks', internalType: 'uint256', type: 'uint256' },
              { name: 'deadline', internalType: 'uint256', type: 'uint256' },
              {
                name: 'fillerWhitelistContract',
                internalType: 'address',
                type: 'address',
              },
            ],
          },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'startBlock', internalType: 'uint256', type: 'uint256' },
          { name: 'startTimestamp', internalType: 'uint256', type: 'uint256' },
          {
            name: 'state',
            internalType: 'enum DutchAuctionState',
            type: 'uint8',
          },
        ],
      },
      { name: 'fillerAuthData', internalType: 'bytes', type: 'bytes' },
      {
        name: 'safeBlockSiblings',
        internalType: 'bytes32[]',
        type: 'bytes32[]',
      },
      { name: 'safeBlockPeaks', internalType: 'bytes32[]', type: 'bytes32[]' },
    ],
    name: 'claimAuction',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'pendingOwner', internalType: 'address', type: 'address' },
    ],
    name: 'completeOwnershipHandover',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'eip712Domain',
    outputs: [
      { name: 'fields', internalType: 'bytes1', type: 'bytes1' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'version', internalType: 'string', type: 'string' },
      { name: 'chainId', internalType: 'uint256', type: 'uint256' },
      { name: 'verifyingContract', internalType: 'address', type: 'address' },
      { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
      { name: 'extensions', internalType: 'uint256[]', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'feeRouter',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getTotalOrders',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getTotalPayments',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'lightClientHeight',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'mmrRoot',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'orderHashes',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: 'result', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'pendingOwner', internalType: 'address', type: 'address' },
    ],
    name: 'ownershipHandoverExpiresAt',
    outputs: [{ name: 'result', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'paymentHashes',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'auction',
        internalType: 'struct DutchAuction',
        type: 'tuple',
        components: [
          { name: 'index', internalType: 'uint256', type: 'uint256' },
          {
            name: 'baseCreateOrderParams',
            internalType: 'struct BaseCreateOrderParams',
            type: 'tuple',
            components: [
              { name: 'owner', internalType: 'address', type: 'address' },
              {
                name: 'bitcoinScriptPubKey',
                internalType: 'bytes',
                type: 'bytes',
              },
              { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
              {
                name: 'confirmationBlocks',
                internalType: 'uint8',
                type: 'uint8',
              },
              {
                name: 'safeBlockLeaf',
                internalType: 'struct BlockLeaf',
                type: 'tuple',
                components: [
                  {
                    name: 'blockHash',
                    internalType: 'bytes32',
                    type: 'bytes32',
                  },
                  { name: 'height', internalType: 'uint32', type: 'uint32' },
                  {
                    name: 'cumulativeChainwork',
                    internalType: 'uint256',
                    type: 'uint256',
                  },
                ],
              },
            ],
          },
          {
            name: 'dutchAuctionParams',
            internalType: 'struct DutchAuctionParams',
            type: 'tuple',
            components: [
              { name: 'startBtcOut', internalType: 'uint256', type: 'uint256' },
              { name: 'endBtcOut', internalType: 'uint256', type: 'uint256' },
              { name: 'decayBlocks', internalType: 'uint256', type: 'uint256' },
              { name: 'deadline', internalType: 'uint256', type: 'uint256' },
              {
                name: 'fillerWhitelistContract',
                internalType: 'address',
                type: 'address',
              },
            ],
          },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'startBlock', internalType: 'uint256', type: 'uint256' },
          { name: 'startTimestamp', internalType: 'uint256', type: 'uint256' },
          {
            name: 'state',
            internalType: 'enum DutchAuctionState',
            type: 'uint8',
          },
        ],
      },
    ],
    name: 'refundAuction',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'order',
        internalType: 'struct Order',
        type: 'tuple',
        components: [
          { name: 'index', internalType: 'uint256', type: 'uint256' },
          { name: 'timestamp', internalType: 'uint64', type: 'uint64' },
          { name: 'unlockTimestamp', internalType: 'uint64', type: 'uint64' },
          { name: 'amount', internalType: 'uint256', type: 'uint256' },
          { name: 'takerFee', internalType: 'uint256', type: 'uint256' },
          { name: 'expectedSats', internalType: 'uint64', type: 'uint64' },
          { name: 'bitcoinScriptPubKey', internalType: 'bytes', type: 'bytes' },
          {
            name: 'designatedReceiver',
            internalType: 'address',
            type: 'address',
          },
          { name: 'owner', internalType: 'address', type: 'address' },
          { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
          { name: 'confirmationBlocks', internalType: 'uint8', type: 'uint8' },
          {
            name: 'safeBitcoinBlockHeight',
            internalType: 'uint64',
            type: 'uint64',
          },
          { name: 'state', internalType: 'enum OrderState', type: 'uint8' },
        ],
      },
    ],
    name: 'refundOrder',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'requestOwnershipHandover',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'settleOrderParams',
        internalType: 'struct SettleOrderParams[]',
        type: 'tuple[]',
        components: [
          {
            name: 'order',
            internalType: 'struct Order',
            type: 'tuple',
            components: [
              { name: 'index', internalType: 'uint256', type: 'uint256' },
              { name: 'timestamp', internalType: 'uint64', type: 'uint64' },
              {
                name: 'unlockTimestamp',
                internalType: 'uint64',
                type: 'uint64',
              },
              { name: 'amount', internalType: 'uint256', type: 'uint256' },
              { name: 'takerFee', internalType: 'uint256', type: 'uint256' },
              { name: 'expectedSats', internalType: 'uint64', type: 'uint64' },
              {
                name: 'bitcoinScriptPubKey',
                internalType: 'bytes',
                type: 'bytes',
              },
              {
                name: 'designatedReceiver',
                internalType: 'address',
                type: 'address',
              },
              { name: 'owner', internalType: 'address', type: 'address' },
              { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
              {
                name: 'confirmationBlocks',
                internalType: 'uint8',
                type: 'uint8',
              },
              {
                name: 'safeBitcoinBlockHeight',
                internalType: 'uint64',
                type: 'uint64',
              },
              { name: 'state', internalType: 'enum OrderState', type: 'uint8' },
            ],
          },
          {
            name: 'payment',
            internalType: 'struct Payment',
            type: 'tuple',
            components: [
              { name: 'index', internalType: 'uint256', type: 'uint256' },
              { name: 'orderIndex', internalType: 'uint256', type: 'uint256' },
              { name: 'orderHash', internalType: 'bytes32', type: 'bytes32' },
              {
                name: 'paymentBitcoinBlockLeaf',
                internalType: 'struct BlockLeaf',
                type: 'tuple',
                components: [
                  {
                    name: 'blockHash',
                    internalType: 'bytes32',
                    type: 'bytes32',
                  },
                  { name: 'height', internalType: 'uint32', type: 'uint32' },
                  {
                    name: 'cumulativeChainwork',
                    internalType: 'uint256',
                    type: 'uint256',
                  },
                ],
              },
              {
                name: 'challengeExpiryTimestamp',
                internalType: 'uint64',
                type: 'uint64',
              },
              {
                name: 'state',
                internalType: 'enum PaymentState',
                type: 'uint8',
              },
            ],
          },
          {
            name: 'paymentBitcoinBlockSiblings',
            internalType: 'bytes32[]',
            type: 'bytes32[]',
          },
          {
            name: 'paymentBitcoinBlockPeaks',
            internalType: 'bytes32[]',
            type: 'bytes32[]',
          },
          { name: 'tipBlockHeight', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    name: 'settleOrders',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
      {
        name: 'auctionParams',
        internalType: 'struct DutchAuctionParams',
        type: 'tuple',
        components: [
          { name: 'startBtcOut', internalType: 'uint256', type: 'uint256' },
          { name: 'endBtcOut', internalType: 'uint256', type: 'uint256' },
          { name: 'decayBlocks', internalType: 'uint256', type: 'uint256' },
          { name: 'deadline', internalType: 'uint256', type: 'uint256' },
          {
            name: 'fillerWhitelistContract',
            internalType: 'address',
            type: 'address',
          },
        ],
      },
      {
        name: 'baseCreateOrderParams',
        internalType: 'struct BaseCreateOrderParams',
        type: 'tuple',
        components: [
          { name: 'owner', internalType: 'address', type: 'address' },
          { name: 'bitcoinScriptPubKey', internalType: 'bytes', type: 'bytes' },
          { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
          { name: 'confirmationBlocks', internalType: 'uint8', type: 'uint8' },
          {
            name: 'safeBlockLeaf',
            internalType: 'struct BlockLeaf',
            type: 'tuple',
            components: [
              { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
              { name: 'height', internalType: 'uint32', type: 'uint32' },
              {
                name: 'cumulativeChainwork',
                internalType: 'uint256',
                type: 'uint256',
              },
            ],
          },
        ],
      },
    ],
    name: 'startAuction',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'paymentParams',
        internalType: 'struct SubmitPaymentProofParams[]',
        type: 'tuple[]',
        components: [
          {
            name: 'paymentBitcoinTxid',
            internalType: 'bytes32',
            type: 'bytes32',
          },
          {
            name: 'order',
            internalType: 'struct Order',
            type: 'tuple',
            components: [
              { name: 'index', internalType: 'uint256', type: 'uint256' },
              { name: 'timestamp', internalType: 'uint64', type: 'uint64' },
              {
                name: 'unlockTimestamp',
                internalType: 'uint64',
                type: 'uint64',
              },
              { name: 'amount', internalType: 'uint256', type: 'uint256' },
              { name: 'takerFee', internalType: 'uint256', type: 'uint256' },
              { name: 'expectedSats', internalType: 'uint64', type: 'uint64' },
              {
                name: 'bitcoinScriptPubKey',
                internalType: 'bytes',
                type: 'bytes',
              },
              {
                name: 'designatedReceiver',
                internalType: 'address',
                type: 'address',
              },
              { name: 'owner', internalType: 'address', type: 'address' },
              { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
              {
                name: 'confirmationBlocks',
                internalType: 'uint8',
                type: 'uint8',
              },
              {
                name: 'safeBitcoinBlockHeight',
                internalType: 'uint64',
                type: 'uint64',
              },
              { name: 'state', internalType: 'enum OrderState', type: 'uint8' },
            ],
          },
          {
            name: 'paymentBitcoinBlockLeaf',
            internalType: 'struct BlockLeaf',
            type: 'tuple',
            components: [
              { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
              { name: 'height', internalType: 'uint32', type: 'uint32' },
              {
                name: 'cumulativeChainwork',
                internalType: 'uint256',
                type: 'uint256',
              },
            ],
          },
          {
            name: 'paymentBitcoinBlockSiblings',
            internalType: 'bytes32[]',
            type: 'bytes32[]',
          },
          {
            name: 'paymentBitcoinBlockPeaks',
            internalType: 'bytes32[]',
            type: 'bytes32[]',
          },
        ],
      },
      {
        name: 'blockProofParams',
        internalType: 'struct BlockProofParams',
        type: 'tuple',
        components: [
          { name: 'priorMmrRoot', internalType: 'bytes32', type: 'bytes32' },
          { name: 'newMmrRoot', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'compressedBlockLeaves',
            internalType: 'bytes',
            type: 'bytes',
          },
          {
            name: 'tipBlockLeaf',
            internalType: 'struct BlockLeaf',
            type: 'tuple',
            components: [
              { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
              { name: 'height', internalType: 'uint32', type: 'uint32' },
              {
                name: 'cumulativeChainwork',
                internalType: 'uint256',
                type: 'uint256',
              },
            ],
          },
        ],
      },
      { name: 'proof', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'submitPaymentProofs',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'paymentParams',
        internalType: 'struct SubmitPaymentProofParams[]',
        type: 'tuple[]',
        components: [
          {
            name: 'paymentBitcoinTxid',
            internalType: 'bytes32',
            type: 'bytes32',
          },
          {
            name: 'order',
            internalType: 'struct Order',
            type: 'tuple',
            components: [
              { name: 'index', internalType: 'uint256', type: 'uint256' },
              { name: 'timestamp', internalType: 'uint64', type: 'uint64' },
              {
                name: 'unlockTimestamp',
                internalType: 'uint64',
                type: 'uint64',
              },
              { name: 'amount', internalType: 'uint256', type: 'uint256' },
              { name: 'takerFee', internalType: 'uint256', type: 'uint256' },
              { name: 'expectedSats', internalType: 'uint64', type: 'uint64' },
              {
                name: 'bitcoinScriptPubKey',
                internalType: 'bytes',
                type: 'bytes',
              },
              {
                name: 'designatedReceiver',
                internalType: 'address',
                type: 'address',
              },
              { name: 'owner', internalType: 'address', type: 'address' },
              { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
              {
                name: 'confirmationBlocks',
                internalType: 'uint8',
                type: 'uint8',
              },
              {
                name: 'safeBitcoinBlockHeight',
                internalType: 'uint64',
                type: 'uint64',
              },
              { name: 'state', internalType: 'enum OrderState', type: 'uint8' },
            ],
          },
          {
            name: 'paymentBitcoinBlockLeaf',
            internalType: 'struct BlockLeaf',
            type: 'tuple',
            components: [
              { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
              { name: 'height', internalType: 'uint32', type: 'uint32' },
              {
                name: 'cumulativeChainwork',
                internalType: 'uint256',
                type: 'uint256',
              },
            ],
          },
          {
            name: 'paymentBitcoinBlockSiblings',
            internalType: 'bytes32[]',
            type: 'bytes32[]',
          },
          {
            name: 'paymentBitcoinBlockPeaks',
            internalType: 'bytes32[]',
            type: 'bytes32[]',
          },
        ],
      },
      { name: 'proof', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'submitPaymentProofsOnly',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'syntheticBitcoin',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'takerFeeBips',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'blockProofParams',
        internalType: 'struct BlockProofParams',
        type: 'tuple',
        components: [
          { name: 'priorMmrRoot', internalType: 'bytes32', type: 'bytes32' },
          { name: 'newMmrRoot', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'compressedBlockLeaves',
            internalType: 'bytes',
            type: 'bytes',
          },
          {
            name: 'tipBlockLeaf',
            internalType: 'struct BlockLeaf',
            type: 'tuple',
            components: [
              { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
              { name: 'height', internalType: 'uint32', type: 'uint32' },
              {
                name: 'cumulativeChainwork',
                internalType: 'uint256',
                type: 'uint256',
              },
            ],
          },
        ],
      },
      { name: 'proof', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'updateLightClient',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'verifier',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'blockLeaf',
        internalType: 'struct BlockLeaf',
        type: 'tuple',
        components: [
          { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
          { name: 'height', internalType: 'uint32', type: 'uint32' },
          {
            name: 'cumulativeChainwork',
            internalType: 'uint256',
            type: 'uint256',
          },
        ],
      },
      { name: 'siblings', internalType: 'bytes32[]', type: 'bytes32[]' },
      { name: 'peaks', internalType: 'bytes32[]', type: 'bytes32[]' },
    ],
    name: 'verifyBlockInclusion',
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'proofPublicInput',
        internalType: 'struct ProofPublicInput',
        type: 'tuple',
        components: [
          { name: 'proofType', internalType: 'enum ProofType', type: 'uint8' },
          {
            name: 'payments',
            internalType: 'struct PaymentPublicInput[]',
            type: 'tuple[]',
            components: [
              {
                name: 'paymentBitcoinTxid',
                internalType: 'bytes32',
                type: 'bytes32',
              },
              {
                name: 'paymentBitcoinBlockHash',
                internalType: 'bytes32',
                type: 'bytes32',
              },
              { name: 'orderHash', internalType: 'bytes32', type: 'bytes32' },
            ],
          },
          {
            name: 'lightClient',
            internalType: 'struct LightClientPublicInput',
            type: 'tuple',
            components: [
              {
                name: 'priorMmrRoot',
                internalType: 'bytes32',
                type: 'bytes32',
              },
              { name: 'newMmrRoot', internalType: 'bytes32', type: 'bytes32' },
              {
                name: 'compressedLeavesHash',
                internalType: 'bytes32',
                type: 'bytes32',
              },
              {
                name: 'tipBlockLeaf',
                internalType: 'struct BlockLeaf',
                type: 'tuple',
                components: [
                  {
                    name: 'blockHash',
                    internalType: 'bytes32',
                    type: 'bytes32',
                  },
                  { name: 'height', internalType: 'uint32', type: 'uint32' },
                  {
                    name: 'cumulativeChainwork',
                    internalType: 'uint256',
                    type: 'uint256',
                  },
                ],
              },
            ],
          },
        ],
      },
      { name: 'proof', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'verifyProof',
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'withdrawFees',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'auction',
        internalType: 'struct DutchAuction',
        type: 'tuple',
        components: [
          { name: 'index', internalType: 'uint256', type: 'uint256' },
          {
            name: 'baseCreateOrderParams',
            internalType: 'struct BaseCreateOrderParams',
            type: 'tuple',
            components: [
              { name: 'owner', internalType: 'address', type: 'address' },
              {
                name: 'bitcoinScriptPubKey',
                internalType: 'bytes',
                type: 'bytes',
              },
              { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
              {
                name: 'confirmationBlocks',
                internalType: 'uint8',
                type: 'uint8',
              },
              {
                name: 'safeBlockLeaf',
                internalType: 'struct BlockLeaf',
                type: 'tuple',
                components: [
                  {
                    name: 'blockHash',
                    internalType: 'bytes32',
                    type: 'bytes32',
                  },
                  { name: 'height', internalType: 'uint32', type: 'uint32' },
                  {
                    name: 'cumulativeChainwork',
                    internalType: 'uint256',
                    type: 'uint256',
                  },
                ],
              },
            ],
          },
          {
            name: 'dutchAuctionParams',
            internalType: 'struct DutchAuctionParams',
            type: 'tuple',
            components: [
              { name: 'startBtcOut', internalType: 'uint256', type: 'uint256' },
              { name: 'endBtcOut', internalType: 'uint256', type: 'uint256' },
              { name: 'decayBlocks', internalType: 'uint256', type: 'uint256' },
              { name: 'deadline', internalType: 'uint256', type: 'uint256' },
              {
                name: 'fillerWhitelistContract',
                internalType: 'address',
                type: 'address',
              },
            ],
          },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'startBlock', internalType: 'uint256', type: 'uint256' },
          { name: 'startTimestamp', internalType: 'uint256', type: 'uint256' },
          {
            name: 'state',
            internalType: 'enum DutchAuctionState',
            type: 'uint8',
          },
        ],
        indexed: false,
      },
    ],
    name: 'AuctionUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'priorMmrRoot',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
      {
        name: 'newMmrRoot',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
    ],
    name: 'BitcoinLightClientUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'order',
        internalType: 'struct Order',
        type: 'tuple',
        components: [
          { name: 'index', internalType: 'uint256', type: 'uint256' },
          { name: 'timestamp', internalType: 'uint64', type: 'uint64' },
          { name: 'unlockTimestamp', internalType: 'uint64', type: 'uint64' },
          { name: 'amount', internalType: 'uint256', type: 'uint256' },
          { name: 'takerFee', internalType: 'uint256', type: 'uint256' },
          { name: 'expectedSats', internalType: 'uint64', type: 'uint64' },
          { name: 'bitcoinScriptPubKey', internalType: 'bytes', type: 'bytes' },
          {
            name: 'designatedReceiver',
            internalType: 'address',
            type: 'address',
          },
          { name: 'owner', internalType: 'address', type: 'address' },
          { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
          { name: 'confirmationBlocks', internalType: 'uint8', type: 'uint8' },
          {
            name: 'safeBitcoinBlockHeight',
            internalType: 'uint64',
            type: 'uint64',
          },
          { name: 'state', internalType: 'enum OrderState', type: 'uint8' },
        ],
        indexed: false,
      },
    ],
    name: 'OrderCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'order',
        internalType: 'struct Order',
        type: 'tuple',
        components: [
          { name: 'index', internalType: 'uint256', type: 'uint256' },
          { name: 'timestamp', internalType: 'uint64', type: 'uint64' },
          { name: 'unlockTimestamp', internalType: 'uint64', type: 'uint64' },
          { name: 'amount', internalType: 'uint256', type: 'uint256' },
          { name: 'takerFee', internalType: 'uint256', type: 'uint256' },
          { name: 'expectedSats', internalType: 'uint64', type: 'uint64' },
          { name: 'bitcoinScriptPubKey', internalType: 'bytes', type: 'bytes' },
          {
            name: 'designatedReceiver',
            internalType: 'address',
            type: 'address',
          },
          { name: 'owner', internalType: 'address', type: 'address' },
          { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
          { name: 'confirmationBlocks', internalType: 'uint8', type: 'uint8' },
          {
            name: 'safeBitcoinBlockHeight',
            internalType: 'uint64',
            type: 'uint64',
          },
          { name: 'state', internalType: 'enum OrderState', type: 'uint8' },
        ],
        indexed: false,
      },
    ],
    name: 'OrderRefunded',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'orders',
        internalType: 'struct Order[]',
        type: 'tuple[]',
        components: [
          { name: 'index', internalType: 'uint256', type: 'uint256' },
          { name: 'timestamp', internalType: 'uint64', type: 'uint64' },
          { name: 'unlockTimestamp', internalType: 'uint64', type: 'uint64' },
          { name: 'amount', internalType: 'uint256', type: 'uint256' },
          { name: 'takerFee', internalType: 'uint256', type: 'uint256' },
          { name: 'expectedSats', internalType: 'uint64', type: 'uint64' },
          { name: 'bitcoinScriptPubKey', internalType: 'bytes', type: 'bytes' },
          {
            name: 'designatedReceiver',
            internalType: 'address',
            type: 'address',
          },
          { name: 'owner', internalType: 'address', type: 'address' },
          { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
          { name: 'confirmationBlocks', internalType: 'uint8', type: 'uint8' },
          {
            name: 'safeBitcoinBlockHeight',
            internalType: 'uint64',
            type: 'uint64',
          },
          { name: 'state', internalType: 'enum OrderState', type: 'uint8' },
        ],
        indexed: false,
      },
      {
        name: 'payments',
        internalType: 'struct Payment[]',
        type: 'tuple[]',
        components: [
          { name: 'index', internalType: 'uint256', type: 'uint256' },
          { name: 'orderIndex', internalType: 'uint256', type: 'uint256' },
          { name: 'orderHash', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'paymentBitcoinBlockLeaf',
            internalType: 'struct BlockLeaf',
            type: 'tuple',
            components: [
              { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
              { name: 'height', internalType: 'uint32', type: 'uint32' },
              {
                name: 'cumulativeChainwork',
                internalType: 'uint256',
                type: 'uint256',
              },
            ],
          },
          {
            name: 'challengeExpiryTimestamp',
            internalType: 'uint64',
            type: 'uint64',
          },
          { name: 'state', internalType: 'enum PaymentState', type: 'uint8' },
        ],
        indexed: false,
      },
    ],
    name: 'OrdersSettled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'pendingOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipHandoverCanceled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'pendingOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipHandoverRequested',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'oldOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'payments',
        internalType: 'struct Payment[]',
        type: 'tuple[]',
        components: [
          { name: 'index', internalType: 'uint256', type: 'uint256' },
          { name: 'orderIndex', internalType: 'uint256', type: 'uint256' },
          { name: 'orderHash', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'paymentBitcoinBlockLeaf',
            internalType: 'struct BlockLeaf',
            type: 'tuple',
            components: [
              { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
              { name: 'height', internalType: 'uint32', type: 'uint32' },
              {
                name: 'cumulativeChainwork',
                internalType: 'uint256',
                type: 'uint256',
              },
            ],
          },
          {
            name: 'challengeExpiryTimestamp',
            internalType: 'uint64',
            type: 'uint64',
          },
          { name: 'state', internalType: 'enum PaymentState', type: 'uint8' },
        ],
        indexed: false,
      },
    ],
    name: 'PaymentsCreated',
  },
  { type: 'error', inputs: [], name: 'AlreadyInitialized' },
  { type: 'error', inputs: [], name: 'AuctionExpired' },
  { type: 'error', inputs: [], name: 'AuctionNotExpired' },
  { type: 'error', inputs: [], name: 'AuctionNotLive' },
  { type: 'error', inputs: [], name: 'BlockNotConfirmed' },
  { type: 'error', inputs: [], name: 'BlockNotInChain' },
  { type: 'error', inputs: [], name: 'ChainworkTooLow' },
  { type: 'error', inputs: [], name: 'CheckpointNotEstablished' },
  { type: 'error', inputs: [], name: 'DepositAmountTooLow' },
  { type: 'error', inputs: [], name: 'DutchAuctionDoesNotExist' },
  { type: 'error', inputs: [], name: 'FillerNotWhitelisted' },
  { type: 'error', inputs: [], name: 'InvalidAuctionRange' },
  { type: 'error', inputs: [], name: 'InvalidDeadline' },
  {
    type: 'error',
    inputs: [
      { name: 'actual', internalType: 'uint8', type: 'uint8' },
      { name: 'expected', internalType: 'uint8', type: 'uint8' },
    ],
    name: 'InvalidDecimals',
  },
  {
    type: 'error',
    inputs: [
      { name: 'actual', internalType: 'bytes32', type: 'bytes32' },
      { name: 'expected', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'InvalidOrderHash',
  },
  { type: 'error', inputs: [], name: 'InvalidScriptPubKey' },
  { type: 'error', inputs: [], name: 'InvalidTickSize' },
  { type: 'error', inputs: [], name: 'NewOwnerIsZeroAddress' },
  { type: 'error', inputs: [], name: 'NoFeeToWithdraw' },
  { type: 'error', inputs: [], name: 'NoHandoverRequest' },
  { type: 'error', inputs: [], name: 'NoPaymentsToSubmit' },
  { type: 'error', inputs: [], name: 'NotEnoughConfirmationBlocks' },
  { type: 'error', inputs: [], name: 'OrderDoesNotExist' },
  { type: 'error', inputs: [], name: 'OrderNotLive' },
  { type: 'error', inputs: [], name: 'OrderStillActive' },
  { type: 'error', inputs: [], name: 'PaymentDoesNotExist' },
  { type: 'error', inputs: [], name: 'PaymentNotProved' },
  { type: 'error', inputs: [], name: 'SatOutputTooLow' },
  { type: 'error', inputs: [], name: 'StillInChallengePeriod' },
  { type: 'error', inputs: [], name: 'Unauthorized' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Bundler3
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const bundler3Abi = [
  {
    type: 'function',
    inputs: [],
    name: 'initiator',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'bundle',
        internalType: 'struct Call[]',
        type: 'tuple[]',
        components: [
          { name: 'to', internalType: 'address', type: 'address' },
          { name: 'data', internalType: 'bytes', type: 'bytes' },
          { name: 'value', internalType: 'uint256', type: 'uint256' },
          { name: 'skipRevert', internalType: 'bool', type: 'bool' },
          { name: 'callbackHash', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'multicall',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'bundle',
        internalType: 'struct Call[]',
        type: 'tuple[]',
        components: [
          { name: 'to', internalType: 'address', type: 'address' },
          { name: 'data', internalType: 'bytes', type: 'bytes' },
          { name: 'value', internalType: 'uint256', type: 'uint256' },
          { name: 'skipRevert', internalType: 'bool', type: 'bool' },
          { name: 'callbackHash', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'reenter',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'reenterHash',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  { type: 'error', inputs: [], name: 'AlreadyInitiated' },
  { type: 'error', inputs: [], name: 'EmptyBundle' },
  { type: 'error', inputs: [], name: 'IncorrectReenterHash' },
  { type: 'error', inputs: [], name: 'MissingExpectedReenter' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ERC20
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const erc20Abi = [
  {
    type: 'function',
    inputs: [],
    name: 'DOMAIN_SEPARATOR',
    outputs: [{ name: 'result', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: 'result', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'result', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'nonces',
    outputs: [{ name: 'result', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
      { name: 'deadline', internalType: 'uint256', type: 'uint256' },
      { name: 'v', internalType: 'uint8', type: 'uint8' },
      { name: 'r', internalType: 'bytes32', type: 'bytes32' },
      { name: 's', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'permit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: 'result', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'spender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Approval',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Transfer',
  },
  { type: 'error', inputs: [], name: 'AllowanceOverflow' },
  { type: 'error', inputs: [], name: 'AllowanceUnderflow' },
  { type: 'error', inputs: [], name: 'InsufficientAllowance' },
  { type: 'error', inputs: [], name: 'InsufficientBalance' },
  { type: 'error', inputs: [], name: 'InvalidPermit' },
  { type: 'error', inputs: [], name: 'Permit2AllowanceIsFixedAtInfinity' },
  { type: 'error', inputs: [], name: 'PermitExpired' },
  { type: 'error', inputs: [], name: 'TotalSupplyOverflow' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// GeneralAdapter1
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const generalAdapter1Abi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'bundler3', internalType: 'address', type: 'address' },
      { name: 'morpho', internalType: 'address', type: 'address' },
      { name: 'wNative', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  { type: 'receive', stateMutability: 'payable' },
  {
    type: 'function',
    inputs: [],
    name: 'BUNDLER3',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MORPHO',
    outputs: [{ name: '', internalType: 'contract IMorpho', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'WRAPPED_NATIVE',
    outputs: [{ name: '', internalType: 'contract IWNative', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'erc20Transfer',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'erc20TransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'vault', internalType: 'address', type: 'address' },
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'maxSharePriceE27', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' },
    ],
    name: 'erc4626Deposit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'vault', internalType: 'address', type: 'address' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'maxSharePriceE27', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' },
    ],
    name: 'erc4626Mint',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'vault', internalType: 'address', type: 'address' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'minSharePriceE27', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'owner', internalType: 'address', type: 'address' },
    ],
    name: 'erc4626Redeem',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'vault', internalType: 'address', type: 'address' },
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'minSharePriceE27', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'owner', internalType: 'address', type: 'address' },
    ],
    name: 'erc4626Withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'marketParams',
        internalType: 'struct MarketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', internalType: 'address', type: 'address' },
          { name: 'collateralToken', internalType: 'address', type: 'address' },
          { name: 'oracle', internalType: 'address', type: 'address' },
          { name: 'irm', internalType: 'address', type: 'address' },
          { name: 'lltv', internalType: 'uint256', type: 'uint256' },
        ],
      },
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'minSharePriceE27', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' },
    ],
    name: 'morphoBorrow',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'morphoFlashLoan',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'marketParams',
        internalType: 'struct MarketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', internalType: 'address', type: 'address' },
          { name: 'collateralToken', internalType: 'address', type: 'address' },
          { name: 'oracle', internalType: 'address', type: 'address' },
          { name: 'irm', internalType: 'address', type: 'address' },
          { name: 'lltv', internalType: 'uint256', type: 'uint256' },
        ],
      },
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'maxSharePriceE27', internalType: 'uint256', type: 'uint256' },
      { name: 'onBehalf', internalType: 'address', type: 'address' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'morphoRepay',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'marketParams',
        internalType: 'struct MarketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', internalType: 'address', type: 'address' },
          { name: 'collateralToken', internalType: 'address', type: 'address' },
          { name: 'oracle', internalType: 'address', type: 'address' },
          { name: 'irm', internalType: 'address', type: 'address' },
          { name: 'lltv', internalType: 'uint256', type: 'uint256' },
        ],
      },
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'maxSharePriceE27', internalType: 'uint256', type: 'uint256' },
      { name: 'onBehalf', internalType: 'address', type: 'address' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'morphoSupply',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'marketParams',
        internalType: 'struct MarketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', internalType: 'address', type: 'address' },
          { name: 'collateralToken', internalType: 'address', type: 'address' },
          { name: 'oracle', internalType: 'address', type: 'address' },
          { name: 'irm', internalType: 'address', type: 'address' },
          { name: 'lltv', internalType: 'uint256', type: 'uint256' },
        ],
      },
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'onBehalf', internalType: 'address', type: 'address' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'morphoSupplyCollateral',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'marketParams',
        internalType: 'struct MarketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', internalType: 'address', type: 'address' },
          { name: 'collateralToken', internalType: 'address', type: 'address' },
          { name: 'oracle', internalType: 'address', type: 'address' },
          { name: 'irm', internalType: 'address', type: 'address' },
          { name: 'lltv', internalType: 'uint256', type: 'uint256' },
        ],
      },
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'minSharePriceE27', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' },
    ],
    name: 'morphoWithdraw',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'marketParams',
        internalType: 'struct MarketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', internalType: 'address', type: 'address' },
          { name: 'collateralToken', internalType: 'address', type: 'address' },
          { name: 'oracle', internalType: 'address', type: 'address' },
          { name: 'irm', internalType: 'address', type: 'address' },
          { name: 'lltv', internalType: 'uint256', type: 'uint256' },
        ],
      },
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' },
    ],
    name: 'morphoWithdrawCollateral',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'nativeTransfer',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'onMorphoFlashLoan',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'onMorphoRepay',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'onMorphoSupply',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'onMorphoSupplyCollateral',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'permit2TransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' },
    ],
    name: 'unwrapNative',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' },
    ],
    name: 'wrapNative',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  { type: 'error', inputs: [], name: 'AdapterAddress' },
  { type: 'error', inputs: [], name: 'FailedCall' },
  {
    type: 'error',
    inputs: [
      { name: 'balance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'InsufficientBalance',
  },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
  { type: 'error', inputs: [], name: 'SlippageExceeded' },
  { type: 'error', inputs: [], name: 'UnauthorizedSender' },
  { type: 'error', inputs: [], name: 'UnexpectedOwner' },
  { type: 'error', inputs: [], name: 'UnsafeCast' },
  { type: 'error', inputs: [], name: 'ZeroAddress' },
  { type: 'error', inputs: [], name: 'ZeroAmount' },
  { type: 'error', inputs: [], name: 'ZeroShares' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// LibExposer
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const libExposerAbi = [
  {
    type: 'function',
    inputs: [{ name: 'peaks', internalType: 'bytes32[]', type: 'bytes32[]' }],
    name: 'bagPeaks',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'blocksElapsed', internalType: 'uint64', type: 'uint64' }],
    name: 'calculateChallengePeriod',
    outputs: [
      { name: 'challengePeriod', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'confirmations', internalType: 'uint8', type: 'uint8' }],
    name: 'calculateDepositLockupPeriod',
    outputs: [
      { name: 'depositLockupPeriod', internalType: 'uint64', type: 'uint64' },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'takerFeeBips', internalType: 'uint16', type: 'uint16' },
    ],
    name: 'calculateFeeFromDeposit',
    outputs: [
      { name: 'protocolFee', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'takerFeeBips', internalType: 'uint16', type: 'uint16' }],
    name: 'calculateMinDepositAmount',
    outputs: [
      { name: 'minDepositAmount', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getChallengePeriodBuffer',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getDepositLockupPeriodScalar',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getMinConfirmationBlocks',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getMinOutputSats',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getProofGenScalingFactor',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getScaledProofGenIntercept',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getScaledProofGenSlope',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'blockLeaf',
        internalType: 'struct BlockLeaf',
        type: 'tuple',
        components: [
          { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
          { name: 'height', internalType: 'uint32', type: 'uint32' },
          {
            name: 'cumulativeChainwork',
            internalType: 'uint256',
            type: 'uint256',
          },
        ],
      },
    ],
    name: 'hashBlockLeaf',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'dutchAuction',
        internalType: 'struct DutchAuction',
        type: 'tuple',
        components: [
          { name: 'index', internalType: 'uint256', type: 'uint256' },
          {
            name: 'baseCreateOrderParams',
            internalType: 'struct BaseCreateOrderParams',
            type: 'tuple',
            components: [
              { name: 'owner', internalType: 'address', type: 'address' },
              {
                name: 'bitcoinScriptPubKey',
                internalType: 'bytes',
                type: 'bytes',
              },
              { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
              {
                name: 'confirmationBlocks',
                internalType: 'uint8',
                type: 'uint8',
              },
              {
                name: 'safeBlockLeaf',
                internalType: 'struct BlockLeaf',
                type: 'tuple',
                components: [
                  {
                    name: 'blockHash',
                    internalType: 'bytes32',
                    type: 'bytes32',
                  },
                  { name: 'height', internalType: 'uint32', type: 'uint32' },
                  {
                    name: 'cumulativeChainwork',
                    internalType: 'uint256',
                    type: 'uint256',
                  },
                ],
              },
            ],
          },
          {
            name: 'dutchAuctionParams',
            internalType: 'struct DutchAuctionParams',
            type: 'tuple',
            components: [
              { name: 'startBtcOut', internalType: 'uint256', type: 'uint256' },
              { name: 'endBtcOut', internalType: 'uint256', type: 'uint256' },
              { name: 'decayBlocks', internalType: 'uint256', type: 'uint256' },
              { name: 'deadline', internalType: 'uint256', type: 'uint256' },
              {
                name: 'fillerWhitelistContract',
                internalType: 'address',
                type: 'address',
              },
            ],
          },
          { name: 'depositAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'startBlock', internalType: 'uint256', type: 'uint256' },
          { name: 'startTimestamp', internalType: 'uint256', type: 'uint256' },
          {
            name: 'state',
            internalType: 'enum DutchAuctionState',
            type: 'uint8',
          },
        ],
      },
    ],
    name: 'hashDutchAuction',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'order',
        internalType: 'struct Order',
        type: 'tuple',
        components: [
          { name: 'index', internalType: 'uint256', type: 'uint256' },
          { name: 'timestamp', internalType: 'uint64', type: 'uint64' },
          { name: 'unlockTimestamp', internalType: 'uint64', type: 'uint64' },
          { name: 'amount', internalType: 'uint256', type: 'uint256' },
          { name: 'takerFee', internalType: 'uint256', type: 'uint256' },
          { name: 'expectedSats', internalType: 'uint64', type: 'uint64' },
          { name: 'bitcoinScriptPubKey', internalType: 'bytes', type: 'bytes' },
          {
            name: 'designatedReceiver',
            internalType: 'address',
            type: 'address',
          },
          { name: 'owner', internalType: 'address', type: 'address' },
          { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
          { name: 'confirmationBlocks', internalType: 'uint8', type: 'uint8' },
          {
            name: 'safeBitcoinBlockHeight',
            internalType: 'uint64',
            type: 'uint64',
          },
          { name: 'state', internalType: 'enum OrderState', type: 'uint8' },
        ],
      },
    ],
    name: 'hashOrder',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'payment',
        internalType: 'struct Payment',
        type: 'tuple',
        components: [
          { name: 'index', internalType: 'uint256', type: 'uint256' },
          { name: 'orderIndex', internalType: 'uint256', type: 'uint256' },
          { name: 'orderHash', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'paymentBitcoinBlockLeaf',
            internalType: 'struct BlockLeaf',
            type: 'tuple',
            components: [
              { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
              { name: 'height', internalType: 'uint32', type: 'uint32' },
              {
                name: 'cumulativeChainwork',
                internalType: 'uint256',
                type: 'uint256',
              },
            ],
          },
          {
            name: 'challengeExpiryTimestamp',
            internalType: 'uint64',
            type: 'uint64',
          },
          { name: 'state', internalType: 'enum PaymentState', type: 'uint8' },
        ],
      },
    ],
    name: 'hashPayment',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      { name: 'startPoint', internalType: 'uint256', type: 'uint256' },
      { name: 'endPoint', internalType: 'uint256', type: 'uint256' },
      { name: 'currentPoint', internalType: 'uint256', type: 'uint256' },
      { name: 'startAmount', internalType: 'int256', type: 'int256' },
      { name: 'endAmount', internalType: 'int256', type: 'int256' },
    ],
    name: 'linearDecayInt',
    outputs: [{ name: '', internalType: 'int256', type: 'int256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      { name: 'startPoint', internalType: 'uint256', type: 'uint256' },
      { name: 'endPoint', internalType: 'uint256', type: 'uint256' },
      { name: 'currentPoint', internalType: 'uint256', type: 'uint256' },
      { name: 'startAmount', internalType: 'uint256', type: 'uint256' },
      { name: 'endAmount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'linearDecayUint',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [{ name: 'scriptPubKey', internalType: 'bytes', type: 'bytes' }],
    name: 'validateScriptPubKey',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      { name: 'leafHash', internalType: 'bytes32', type: 'bytes32' },
      { name: 'leafIndex', internalType: 'uint256', type: 'uint256' },
      { name: 'siblings', internalType: 'bytes32[]', type: 'bytes32[]' },
      { name: 'peaks', internalType: 'bytes32[]', type: 'bytes32[]' },
      { name: 'leafCount', internalType: 'uint32', type: 'uint32' },
      { name: 'mmrRoot', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'verifyMMRProof',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ParaswapAdapter
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const paraswapAdapterAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'bundler3', internalType: 'address', type: 'address' },
      { name: 'morpho', internalType: 'address', type: 'address' },
      { name: 'augustusRegistry', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  { type: 'receive', stateMutability: 'payable' },
  {
    type: 'function',
    inputs: [],
    name: 'AUGUSTUS_REGISTRY',
    outputs: [
      { name: '', internalType: 'contract IAugustusRegistry', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'BUNDLER3',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MORPHO',
    outputs: [{ name: '', internalType: 'contract IMorpho', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'augustus', internalType: 'address', type: 'address' },
      { name: 'callData', internalType: 'bytes', type: 'bytes' },
      { name: 'srcToken', internalType: 'address', type: 'address' },
      { name: 'destToken', internalType: 'address', type: 'address' },
      { name: 'newDestAmount', internalType: 'uint256', type: 'uint256' },
      {
        name: 'offsets',
        internalType: 'struct Offsets',
        type: 'tuple',
        components: [
          { name: 'exactAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'limitAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'quotedAmount', internalType: 'uint256', type: 'uint256' },
        ],
      },
      { name: 'receiver', internalType: 'address', type: 'address' },
    ],
    name: 'buy',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'augustus', internalType: 'address', type: 'address' },
      { name: 'callData', internalType: 'bytes', type: 'bytes' },
      { name: 'srcToken', internalType: 'address', type: 'address' },
      {
        name: 'marketParams',
        internalType: 'struct MarketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', internalType: 'address', type: 'address' },
          { name: 'collateralToken', internalType: 'address', type: 'address' },
          { name: 'oracle', internalType: 'address', type: 'address' },
          { name: 'irm', internalType: 'address', type: 'address' },
          { name: 'lltv', internalType: 'uint256', type: 'uint256' },
        ],
      },
      {
        name: 'offsets',
        internalType: 'struct Offsets',
        type: 'tuple',
        components: [
          { name: 'exactAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'limitAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'quotedAmount', internalType: 'uint256', type: 'uint256' },
        ],
      },
      { name: 'onBehalf', internalType: 'address', type: 'address' },
      { name: 'receiver', internalType: 'address', type: 'address' },
    ],
    name: 'buyMorphoDebt',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'erc20Transfer',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'nativeTransfer',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'augustus', internalType: 'address', type: 'address' },
      { name: 'callData', internalType: 'bytes', type: 'bytes' },
      { name: 'srcToken', internalType: 'address', type: 'address' },
      { name: 'destToken', internalType: 'address', type: 'address' },
      { name: 'sellEntireBalance', internalType: 'bool', type: 'bool' },
      {
        name: 'offsets',
        internalType: 'struct Offsets',
        type: 'tuple',
        components: [
          { name: 'exactAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'limitAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'quotedAmount', internalType: 'uint256', type: 'uint256' },
        ],
      },
      { name: 'receiver', internalType: 'address', type: 'address' },
    ],
    name: 'sell',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  { type: 'error', inputs: [], name: 'AdapterAddress' },
  { type: 'error', inputs: [], name: 'BuyAmountTooLow' },
  { type: 'error', inputs: [], name: 'FailedCall' },
  {
    type: 'error',
    inputs: [
      { name: 'balance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'InsufficientBalance',
  },
  { type: 'error', inputs: [], name: 'InvalidAugustus' },
  { type: 'error', inputs: [], name: 'InvalidOffset' },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
  { type: 'error', inputs: [], name: 'SellAmountTooHigh' },
  { type: 'error', inputs: [], name: 'UnauthorizedSender' },
  { type: 'error', inputs: [], name: 'ZeroAddress' },
  { type: 'error', inputs: [], name: 'ZeroAmount' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// RiftAuctionAdaptor
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const riftAuctionAdaptorAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_bundler3', internalType: 'address', type: 'address' },
      { name: '_btcAuctionHouse', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  { type: 'receive', stateMutability: 'payable' },
  {
    type: 'function',
    inputs: [],
    name: 'BUNDLER3',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'btcAuctionHouse',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'startsBTCperBTCRate', internalType: 'uint256', type: 'uint256' },
      { name: 'endcbsBTCperBTCRate', internalType: 'uint256', type: 'uint256' },
      { name: 'decayBlocks', internalType: 'uint64', type: 'uint64' },
      { name: 'deadline', internalType: 'uint64', type: 'uint64' },
      {
        name: 'fillerWhitelistContract',
        internalType: 'address',
        type: 'address',
      },
      {
        name: 'baseParams',
        internalType: 'struct BaseCreateOrderParams',
        type: 'tuple',
        components: [
          { name: 'owner', internalType: 'address', type: 'address' },
          { name: 'bitcoinScriptPubKey', internalType: 'bytes', type: 'bytes' },
          { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
          { name: 'confirmationBlocks', internalType: 'uint8', type: 'uint8' },
          {
            name: 'safeBlockLeaf',
            internalType: 'struct BlockLeaf',
            type: 'tuple',
            components: [
              { name: 'blockHash', internalType: 'bytes32', type: 'bytes32' },
              { name: 'height', internalType: 'uint32', type: 'uint32' },
              {
                name: 'cumulativeChainwork',
                internalType: 'uint256',
                type: 'uint256',
              },
            ],
          },
        ],
      },
    ],
    name: 'createAuction',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'erc20Transfer',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'nativeTransfer',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'syntheticBitcoin',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  { type: 'error', inputs: [], name: 'AdapterAddress' },
  { type: 'error', inputs: [], name: 'FailedCall' },
  {
    type: 'error',
    inputs: [
      { name: 'balance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'InsufficientBalance',
  },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
  { type: 'error', inputs: [], name: 'UnauthorizedSender' },
  { type: 'error', inputs: [], name: 'ZeroAddress' },
  { type: 'error', inputs: [], name: 'ZeroAmount' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// React
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__
 */
export const useReadBtcDutchAuctionHouse = /*#__PURE__*/ createUseReadContract({
  abi: btcDutchAuctionHouseAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"accumulatedFees"`
 */
export const useReadBtcDutchAuctionHouseAccumulatedFees =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'accumulatedFees',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"auctionHashes"`
 */
export const useReadBtcDutchAuctionHouseAuctionHashes =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'auctionHashes',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"checkpoints"`
 */
export const useReadBtcDutchAuctionHouseCheckpoints =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'checkpoints',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"circuitVerificationKey"`
 */
export const useReadBtcDutchAuctionHouseCircuitVerificationKey =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'circuitVerificationKey',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"eip712Domain"`
 */
export const useReadBtcDutchAuctionHouseEip712Domain =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'eip712Domain',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"feeRouter"`
 */
export const useReadBtcDutchAuctionHouseFeeRouter =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'feeRouter',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"getTotalOrders"`
 */
export const useReadBtcDutchAuctionHouseGetTotalOrders =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'getTotalOrders',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"getTotalPayments"`
 */
export const useReadBtcDutchAuctionHouseGetTotalPayments =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'getTotalPayments',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"lightClientHeight"`
 */
export const useReadBtcDutchAuctionHouseLightClientHeight =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'lightClientHeight',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"mmrRoot"`
 */
export const useReadBtcDutchAuctionHouseMmrRoot =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'mmrRoot',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"orderHashes"`
 */
export const useReadBtcDutchAuctionHouseOrderHashes =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'orderHashes',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"owner"`
 */
export const useReadBtcDutchAuctionHouseOwner =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'owner',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"ownershipHandoverExpiresAt"`
 */
export const useReadBtcDutchAuctionHouseOwnershipHandoverExpiresAt =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'ownershipHandoverExpiresAt',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"paymentHashes"`
 */
export const useReadBtcDutchAuctionHousePaymentHashes =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'paymentHashes',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"syntheticBitcoin"`
 */
export const useReadBtcDutchAuctionHouseSyntheticBitcoin =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'syntheticBitcoin',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"takerFeeBips"`
 */
export const useReadBtcDutchAuctionHouseTakerFeeBips =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'takerFeeBips',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"verifier"`
 */
export const useReadBtcDutchAuctionHouseVerifier =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'verifier',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"verifyBlockInclusion"`
 */
export const useReadBtcDutchAuctionHouseVerifyBlockInclusion =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'verifyBlockInclusion',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"verifyProof"`
 */
export const useReadBtcDutchAuctionHouseVerifyProof =
  /*#__PURE__*/ createUseReadContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'verifyProof',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__
 */
export const useWriteBtcDutchAuctionHouse =
  /*#__PURE__*/ createUseWriteContract({ abi: btcDutchAuctionHouseAbi })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"adminSetFeeRouter"`
 */
export const useWriteBtcDutchAuctionHouseAdminSetFeeRouter =
  /*#__PURE__*/ createUseWriteContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'adminSetFeeRouter',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"adminSetTakerFeeBips"`
 */
export const useWriteBtcDutchAuctionHouseAdminSetTakerFeeBips =
  /*#__PURE__*/ createUseWriteContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'adminSetTakerFeeBips',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"cancelOwnershipHandover"`
 */
export const useWriteBtcDutchAuctionHouseCancelOwnershipHandover =
  /*#__PURE__*/ createUseWriteContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'cancelOwnershipHandover',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"claimAuction"`
 */
export const useWriteBtcDutchAuctionHouseClaimAuction =
  /*#__PURE__*/ createUseWriteContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'claimAuction',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"completeOwnershipHandover"`
 */
export const useWriteBtcDutchAuctionHouseCompleteOwnershipHandover =
  /*#__PURE__*/ createUseWriteContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'completeOwnershipHandover',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"refundAuction"`
 */
export const useWriteBtcDutchAuctionHouseRefundAuction =
  /*#__PURE__*/ createUseWriteContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'refundAuction',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"refundOrder"`
 */
export const useWriteBtcDutchAuctionHouseRefundOrder =
  /*#__PURE__*/ createUseWriteContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'refundOrder',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useWriteBtcDutchAuctionHouseRenounceOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"requestOwnershipHandover"`
 */
export const useWriteBtcDutchAuctionHouseRequestOwnershipHandover =
  /*#__PURE__*/ createUseWriteContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'requestOwnershipHandover',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"settleOrders"`
 */
export const useWriteBtcDutchAuctionHouseSettleOrders =
  /*#__PURE__*/ createUseWriteContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'settleOrders',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"startAuction"`
 */
export const useWriteBtcDutchAuctionHouseStartAuction =
  /*#__PURE__*/ createUseWriteContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'startAuction',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"submitPaymentProofs"`
 */
export const useWriteBtcDutchAuctionHouseSubmitPaymentProofs =
  /*#__PURE__*/ createUseWriteContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'submitPaymentProofs',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"submitPaymentProofsOnly"`
 */
export const useWriteBtcDutchAuctionHouseSubmitPaymentProofsOnly =
  /*#__PURE__*/ createUseWriteContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'submitPaymentProofsOnly',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useWriteBtcDutchAuctionHouseTransferOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"updateLightClient"`
 */
export const useWriteBtcDutchAuctionHouseUpdateLightClient =
  /*#__PURE__*/ createUseWriteContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'updateLightClient',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"withdrawFees"`
 */
export const useWriteBtcDutchAuctionHouseWithdrawFees =
  /*#__PURE__*/ createUseWriteContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'withdrawFees',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__
 */
export const useSimulateBtcDutchAuctionHouse =
  /*#__PURE__*/ createUseSimulateContract({ abi: btcDutchAuctionHouseAbi })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"adminSetFeeRouter"`
 */
export const useSimulateBtcDutchAuctionHouseAdminSetFeeRouter =
  /*#__PURE__*/ createUseSimulateContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'adminSetFeeRouter',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"adminSetTakerFeeBips"`
 */
export const useSimulateBtcDutchAuctionHouseAdminSetTakerFeeBips =
  /*#__PURE__*/ createUseSimulateContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'adminSetTakerFeeBips',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"cancelOwnershipHandover"`
 */
export const useSimulateBtcDutchAuctionHouseCancelOwnershipHandover =
  /*#__PURE__*/ createUseSimulateContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'cancelOwnershipHandover',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"claimAuction"`
 */
export const useSimulateBtcDutchAuctionHouseClaimAuction =
  /*#__PURE__*/ createUseSimulateContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'claimAuction',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"completeOwnershipHandover"`
 */
export const useSimulateBtcDutchAuctionHouseCompleteOwnershipHandover =
  /*#__PURE__*/ createUseSimulateContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'completeOwnershipHandover',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"refundAuction"`
 */
export const useSimulateBtcDutchAuctionHouseRefundAuction =
  /*#__PURE__*/ createUseSimulateContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'refundAuction',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"refundOrder"`
 */
export const useSimulateBtcDutchAuctionHouseRefundOrder =
  /*#__PURE__*/ createUseSimulateContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'refundOrder',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useSimulateBtcDutchAuctionHouseRenounceOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"requestOwnershipHandover"`
 */
export const useSimulateBtcDutchAuctionHouseRequestOwnershipHandover =
  /*#__PURE__*/ createUseSimulateContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'requestOwnershipHandover',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"settleOrders"`
 */
export const useSimulateBtcDutchAuctionHouseSettleOrders =
  /*#__PURE__*/ createUseSimulateContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'settleOrders',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"startAuction"`
 */
export const useSimulateBtcDutchAuctionHouseStartAuction =
  /*#__PURE__*/ createUseSimulateContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'startAuction',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"submitPaymentProofs"`
 */
export const useSimulateBtcDutchAuctionHouseSubmitPaymentProofs =
  /*#__PURE__*/ createUseSimulateContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'submitPaymentProofs',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"submitPaymentProofsOnly"`
 */
export const useSimulateBtcDutchAuctionHouseSubmitPaymentProofsOnly =
  /*#__PURE__*/ createUseSimulateContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'submitPaymentProofsOnly',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useSimulateBtcDutchAuctionHouseTransferOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"updateLightClient"`
 */
export const useSimulateBtcDutchAuctionHouseUpdateLightClient =
  /*#__PURE__*/ createUseSimulateContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'updateLightClient',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `functionName` set to `"withdrawFees"`
 */
export const useSimulateBtcDutchAuctionHouseWithdrawFees =
  /*#__PURE__*/ createUseSimulateContract({
    abi: btcDutchAuctionHouseAbi,
    functionName: 'withdrawFees',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__
 */
export const useWatchBtcDutchAuctionHouseEvent =
  /*#__PURE__*/ createUseWatchContractEvent({ abi: btcDutchAuctionHouseAbi })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `eventName` set to `"AuctionUpdated"`
 */
export const useWatchBtcDutchAuctionHouseAuctionUpdatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: btcDutchAuctionHouseAbi,
    eventName: 'AuctionUpdated',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `eventName` set to `"BitcoinLightClientUpdated"`
 */
export const useWatchBtcDutchAuctionHouseBitcoinLightClientUpdatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: btcDutchAuctionHouseAbi,
    eventName: 'BitcoinLightClientUpdated',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `eventName` set to `"OrderCreated"`
 */
export const useWatchBtcDutchAuctionHouseOrderCreatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: btcDutchAuctionHouseAbi,
    eventName: 'OrderCreated',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `eventName` set to `"OrderRefunded"`
 */
export const useWatchBtcDutchAuctionHouseOrderRefundedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: btcDutchAuctionHouseAbi,
    eventName: 'OrderRefunded',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `eventName` set to `"OrdersSettled"`
 */
export const useWatchBtcDutchAuctionHouseOrdersSettledEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: btcDutchAuctionHouseAbi,
    eventName: 'OrdersSettled',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `eventName` set to `"OwnershipHandoverCanceled"`
 */
export const useWatchBtcDutchAuctionHouseOwnershipHandoverCanceledEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: btcDutchAuctionHouseAbi,
    eventName: 'OwnershipHandoverCanceled',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `eventName` set to `"OwnershipHandoverRequested"`
 */
export const useWatchBtcDutchAuctionHouseOwnershipHandoverRequestedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: btcDutchAuctionHouseAbi,
    eventName: 'OwnershipHandoverRequested',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const useWatchBtcDutchAuctionHouseOwnershipTransferredEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: btcDutchAuctionHouseAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link btcDutchAuctionHouseAbi}__ and `eventName` set to `"PaymentsCreated"`
 */
export const useWatchBtcDutchAuctionHousePaymentsCreatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: btcDutchAuctionHouseAbi,
    eventName: 'PaymentsCreated',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link bundler3Abi}__
 */
export const useReadBundler3 = /*#__PURE__*/ createUseReadContract({
  abi: bundler3Abi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link bundler3Abi}__ and `functionName` set to `"initiator"`
 */
export const useReadBundler3Initiator = /*#__PURE__*/ createUseReadContract({
  abi: bundler3Abi,
  functionName: 'initiator',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link bundler3Abi}__ and `functionName` set to `"reenterHash"`
 */
export const useReadBundler3ReenterHash = /*#__PURE__*/ createUseReadContract({
  abi: bundler3Abi,
  functionName: 'reenterHash',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link bundler3Abi}__
 */
export const useWriteBundler3 = /*#__PURE__*/ createUseWriteContract({
  abi: bundler3Abi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link bundler3Abi}__ and `functionName` set to `"multicall"`
 */
export const useWriteBundler3Multicall = /*#__PURE__*/ createUseWriteContract({
  abi: bundler3Abi,
  functionName: 'multicall',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link bundler3Abi}__ and `functionName` set to `"reenter"`
 */
export const useWriteBundler3Reenter = /*#__PURE__*/ createUseWriteContract({
  abi: bundler3Abi,
  functionName: 'reenter',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link bundler3Abi}__
 */
export const useSimulateBundler3 = /*#__PURE__*/ createUseSimulateContract({
  abi: bundler3Abi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link bundler3Abi}__ and `functionName` set to `"multicall"`
 */
export const useSimulateBundler3Multicall =
  /*#__PURE__*/ createUseSimulateContract({
    abi: bundler3Abi,
    functionName: 'multicall',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link bundler3Abi}__ and `functionName` set to `"reenter"`
 */
export const useSimulateBundler3Reenter =
  /*#__PURE__*/ createUseSimulateContract({
    abi: bundler3Abi,
    functionName: 'reenter',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link erc20Abi}__
 */
export const useReadErc20 = /*#__PURE__*/ createUseReadContract({
  abi: erc20Abi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"DOMAIN_SEPARATOR"`
 */
export const useReadErc20DomainSeparator = /*#__PURE__*/ createUseReadContract({
  abi: erc20Abi,
  functionName: 'DOMAIN_SEPARATOR',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"allowance"`
 */
export const useReadErc20Allowance = /*#__PURE__*/ createUseReadContract({
  abi: erc20Abi,
  functionName: 'allowance',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"balanceOf"`
 */
export const useReadErc20BalanceOf = /*#__PURE__*/ createUseReadContract({
  abi: erc20Abi,
  functionName: 'balanceOf',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"decimals"`
 */
export const useReadErc20Decimals = /*#__PURE__*/ createUseReadContract({
  abi: erc20Abi,
  functionName: 'decimals',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"name"`
 */
export const useReadErc20Name = /*#__PURE__*/ createUseReadContract({
  abi: erc20Abi,
  functionName: 'name',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"nonces"`
 */
export const useReadErc20Nonces = /*#__PURE__*/ createUseReadContract({
  abi: erc20Abi,
  functionName: 'nonces',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"symbol"`
 */
export const useReadErc20Symbol = /*#__PURE__*/ createUseReadContract({
  abi: erc20Abi,
  functionName: 'symbol',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"totalSupply"`
 */
export const useReadErc20TotalSupply = /*#__PURE__*/ createUseReadContract({
  abi: erc20Abi,
  functionName: 'totalSupply',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link erc20Abi}__
 */
export const useWriteErc20 = /*#__PURE__*/ createUseWriteContract({
  abi: erc20Abi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"approve"`
 */
export const useWriteErc20Approve = /*#__PURE__*/ createUseWriteContract({
  abi: erc20Abi,
  functionName: 'approve',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"permit"`
 */
export const useWriteErc20Permit = /*#__PURE__*/ createUseWriteContract({
  abi: erc20Abi,
  functionName: 'permit',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"transfer"`
 */
export const useWriteErc20Transfer = /*#__PURE__*/ createUseWriteContract({
  abi: erc20Abi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"transferFrom"`
 */
export const useWriteErc20TransferFrom = /*#__PURE__*/ createUseWriteContract({
  abi: erc20Abi,
  functionName: 'transferFrom',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link erc20Abi}__
 */
export const useSimulateErc20 = /*#__PURE__*/ createUseSimulateContract({
  abi: erc20Abi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"approve"`
 */
export const useSimulateErc20Approve = /*#__PURE__*/ createUseSimulateContract({
  abi: erc20Abi,
  functionName: 'approve',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"permit"`
 */
export const useSimulateErc20Permit = /*#__PURE__*/ createUseSimulateContract({
  abi: erc20Abi,
  functionName: 'permit',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"transfer"`
 */
export const useSimulateErc20Transfer = /*#__PURE__*/ createUseSimulateContract(
  { abi: erc20Abi, functionName: 'transfer' },
)

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"transferFrom"`
 */
export const useSimulateErc20TransferFrom =
  /*#__PURE__*/ createUseSimulateContract({
    abi: erc20Abi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link erc20Abi}__
 */
export const useWatchErc20Event = /*#__PURE__*/ createUseWatchContractEvent({
  abi: erc20Abi,
})

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link erc20Abi}__ and `eventName` set to `"Approval"`
 */
export const useWatchErc20ApprovalEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: erc20Abi,
    eventName: 'Approval',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link erc20Abi}__ and `eventName` set to `"Transfer"`
 */
export const useWatchErc20TransferEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: erc20Abi,
    eventName: 'Transfer',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link generalAdapter1Abi}__
 */
export const useReadGeneralAdapter1 = /*#__PURE__*/ createUseReadContract({
  abi: generalAdapter1Abi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"BUNDLER3"`
 */
export const useReadGeneralAdapter1Bundler3 =
  /*#__PURE__*/ createUseReadContract({
    abi: generalAdapter1Abi,
    functionName: 'BUNDLER3',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"MORPHO"`
 */
export const useReadGeneralAdapter1Morpho = /*#__PURE__*/ createUseReadContract(
  { abi: generalAdapter1Abi, functionName: 'MORPHO' },
)

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"WRAPPED_NATIVE"`
 */
export const useReadGeneralAdapter1WrappedNative =
  /*#__PURE__*/ createUseReadContract({
    abi: generalAdapter1Abi,
    functionName: 'WRAPPED_NATIVE',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__
 */
export const useWriteGeneralAdapter1 = /*#__PURE__*/ createUseWriteContract({
  abi: generalAdapter1Abi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"erc20Transfer"`
 */
export const useWriteGeneralAdapter1Erc20Transfer =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'erc20Transfer',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"erc20TransferFrom"`
 */
export const useWriteGeneralAdapter1Erc20TransferFrom =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'erc20TransferFrom',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"erc4626Deposit"`
 */
export const useWriteGeneralAdapter1Erc4626Deposit =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'erc4626Deposit',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"erc4626Mint"`
 */
export const useWriteGeneralAdapter1Erc4626Mint =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'erc4626Mint',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"erc4626Redeem"`
 */
export const useWriteGeneralAdapter1Erc4626Redeem =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'erc4626Redeem',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"erc4626Withdraw"`
 */
export const useWriteGeneralAdapter1Erc4626Withdraw =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'erc4626Withdraw',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"morphoBorrow"`
 */
export const useWriteGeneralAdapter1MorphoBorrow =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'morphoBorrow',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"morphoFlashLoan"`
 */
export const useWriteGeneralAdapter1MorphoFlashLoan =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'morphoFlashLoan',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"morphoRepay"`
 */
export const useWriteGeneralAdapter1MorphoRepay =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'morphoRepay',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"morphoSupply"`
 */
export const useWriteGeneralAdapter1MorphoSupply =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'morphoSupply',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"morphoSupplyCollateral"`
 */
export const useWriteGeneralAdapter1MorphoSupplyCollateral =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'morphoSupplyCollateral',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"morphoWithdraw"`
 */
export const useWriteGeneralAdapter1MorphoWithdraw =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'morphoWithdraw',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"morphoWithdrawCollateral"`
 */
export const useWriteGeneralAdapter1MorphoWithdrawCollateral =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'morphoWithdrawCollateral',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"nativeTransfer"`
 */
export const useWriteGeneralAdapter1NativeTransfer =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'nativeTransfer',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"onMorphoFlashLoan"`
 */
export const useWriteGeneralAdapter1OnMorphoFlashLoan =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'onMorphoFlashLoan',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"onMorphoRepay"`
 */
export const useWriteGeneralAdapter1OnMorphoRepay =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'onMorphoRepay',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"onMorphoSupply"`
 */
export const useWriteGeneralAdapter1OnMorphoSupply =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'onMorphoSupply',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"onMorphoSupplyCollateral"`
 */
export const useWriteGeneralAdapter1OnMorphoSupplyCollateral =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'onMorphoSupplyCollateral',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"permit2TransferFrom"`
 */
export const useWriteGeneralAdapter1Permit2TransferFrom =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'permit2TransferFrom',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"unwrapNative"`
 */
export const useWriteGeneralAdapter1UnwrapNative =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'unwrapNative',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"wrapNative"`
 */
export const useWriteGeneralAdapter1WrapNative =
  /*#__PURE__*/ createUseWriteContract({
    abi: generalAdapter1Abi,
    functionName: 'wrapNative',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__
 */
export const useSimulateGeneralAdapter1 =
  /*#__PURE__*/ createUseSimulateContract({ abi: generalAdapter1Abi })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"erc20Transfer"`
 */
export const useSimulateGeneralAdapter1Erc20Transfer =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'erc20Transfer',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"erc20TransferFrom"`
 */
export const useSimulateGeneralAdapter1Erc20TransferFrom =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'erc20TransferFrom',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"erc4626Deposit"`
 */
export const useSimulateGeneralAdapter1Erc4626Deposit =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'erc4626Deposit',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"erc4626Mint"`
 */
export const useSimulateGeneralAdapter1Erc4626Mint =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'erc4626Mint',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"erc4626Redeem"`
 */
export const useSimulateGeneralAdapter1Erc4626Redeem =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'erc4626Redeem',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"erc4626Withdraw"`
 */
export const useSimulateGeneralAdapter1Erc4626Withdraw =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'erc4626Withdraw',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"morphoBorrow"`
 */
export const useSimulateGeneralAdapter1MorphoBorrow =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'morphoBorrow',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"morphoFlashLoan"`
 */
export const useSimulateGeneralAdapter1MorphoFlashLoan =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'morphoFlashLoan',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"morphoRepay"`
 */
export const useSimulateGeneralAdapter1MorphoRepay =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'morphoRepay',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"morphoSupply"`
 */
export const useSimulateGeneralAdapter1MorphoSupply =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'morphoSupply',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"morphoSupplyCollateral"`
 */
export const useSimulateGeneralAdapter1MorphoSupplyCollateral =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'morphoSupplyCollateral',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"morphoWithdraw"`
 */
export const useSimulateGeneralAdapter1MorphoWithdraw =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'morphoWithdraw',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"morphoWithdrawCollateral"`
 */
export const useSimulateGeneralAdapter1MorphoWithdrawCollateral =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'morphoWithdrawCollateral',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"nativeTransfer"`
 */
export const useSimulateGeneralAdapter1NativeTransfer =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'nativeTransfer',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"onMorphoFlashLoan"`
 */
export const useSimulateGeneralAdapter1OnMorphoFlashLoan =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'onMorphoFlashLoan',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"onMorphoRepay"`
 */
export const useSimulateGeneralAdapter1OnMorphoRepay =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'onMorphoRepay',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"onMorphoSupply"`
 */
export const useSimulateGeneralAdapter1OnMorphoSupply =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'onMorphoSupply',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"onMorphoSupplyCollateral"`
 */
export const useSimulateGeneralAdapter1OnMorphoSupplyCollateral =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'onMorphoSupplyCollateral',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"permit2TransferFrom"`
 */
export const useSimulateGeneralAdapter1Permit2TransferFrom =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'permit2TransferFrom',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"unwrapNative"`
 */
export const useSimulateGeneralAdapter1UnwrapNative =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'unwrapNative',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link generalAdapter1Abi}__ and `functionName` set to `"wrapNative"`
 */
export const useSimulateGeneralAdapter1WrapNative =
  /*#__PURE__*/ createUseSimulateContract({
    abi: generalAdapter1Abi,
    functionName: 'wrapNative',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__
 */
export const useReadLibExposer = /*#__PURE__*/ createUseReadContract({
  abi: libExposerAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"bagPeaks"`
 */
export const useReadLibExposerBagPeaks = /*#__PURE__*/ createUseReadContract({
  abi: libExposerAbi,
  functionName: 'bagPeaks',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"calculateChallengePeriod"`
 */
export const useReadLibExposerCalculateChallengePeriod =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'calculateChallengePeriod',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"calculateDepositLockupPeriod"`
 */
export const useReadLibExposerCalculateDepositLockupPeriod =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'calculateDepositLockupPeriod',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"calculateFeeFromDeposit"`
 */
export const useReadLibExposerCalculateFeeFromDeposit =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'calculateFeeFromDeposit',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"calculateMinDepositAmount"`
 */
export const useReadLibExposerCalculateMinDepositAmount =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'calculateMinDepositAmount',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"getChallengePeriodBuffer"`
 */
export const useReadLibExposerGetChallengePeriodBuffer =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'getChallengePeriodBuffer',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"getDepositLockupPeriodScalar"`
 */
export const useReadLibExposerGetDepositLockupPeriodScalar =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'getDepositLockupPeriodScalar',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"getMinConfirmationBlocks"`
 */
export const useReadLibExposerGetMinConfirmationBlocks =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'getMinConfirmationBlocks',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"getMinOutputSats"`
 */
export const useReadLibExposerGetMinOutputSats =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'getMinOutputSats',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"getProofGenScalingFactor"`
 */
export const useReadLibExposerGetProofGenScalingFactor =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'getProofGenScalingFactor',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"getScaledProofGenIntercept"`
 */
export const useReadLibExposerGetScaledProofGenIntercept =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'getScaledProofGenIntercept',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"getScaledProofGenSlope"`
 */
export const useReadLibExposerGetScaledProofGenSlope =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'getScaledProofGenSlope',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"hashBlockLeaf"`
 */
export const useReadLibExposerHashBlockLeaf =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'hashBlockLeaf',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"hashDutchAuction"`
 */
export const useReadLibExposerHashDutchAuction =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'hashDutchAuction',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"hashOrder"`
 */
export const useReadLibExposerHashOrder = /*#__PURE__*/ createUseReadContract({
  abi: libExposerAbi,
  functionName: 'hashOrder',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"hashPayment"`
 */
export const useReadLibExposerHashPayment = /*#__PURE__*/ createUseReadContract(
  { abi: libExposerAbi, functionName: 'hashPayment' },
)

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"linearDecayInt"`
 */
export const useReadLibExposerLinearDecayInt =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'linearDecayInt',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"linearDecayUint"`
 */
export const useReadLibExposerLinearDecayUint =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'linearDecayUint',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"validateScriptPubKey"`
 */
export const useReadLibExposerValidateScriptPubKey =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'validateScriptPubKey',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link libExposerAbi}__ and `functionName` set to `"verifyMMRProof"`
 */
export const useReadLibExposerVerifyMmrProof =
  /*#__PURE__*/ createUseReadContract({
    abi: libExposerAbi,
    functionName: 'verifyMMRProof',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link paraswapAdapterAbi}__
 */
export const useReadParaswapAdapter = /*#__PURE__*/ createUseReadContract({
  abi: paraswapAdapterAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link paraswapAdapterAbi}__ and `functionName` set to `"AUGUSTUS_REGISTRY"`
 */
export const useReadParaswapAdapterAugustusRegistry =
  /*#__PURE__*/ createUseReadContract({
    abi: paraswapAdapterAbi,
    functionName: 'AUGUSTUS_REGISTRY',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link paraswapAdapterAbi}__ and `functionName` set to `"BUNDLER3"`
 */
export const useReadParaswapAdapterBundler3 =
  /*#__PURE__*/ createUseReadContract({
    abi: paraswapAdapterAbi,
    functionName: 'BUNDLER3',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link paraswapAdapterAbi}__ and `functionName` set to `"MORPHO"`
 */
export const useReadParaswapAdapterMorpho = /*#__PURE__*/ createUseReadContract(
  { abi: paraswapAdapterAbi, functionName: 'MORPHO' },
)

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link paraswapAdapterAbi}__
 */
export const useWriteParaswapAdapter = /*#__PURE__*/ createUseWriteContract({
  abi: paraswapAdapterAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link paraswapAdapterAbi}__ and `functionName` set to `"buy"`
 */
export const useWriteParaswapAdapterBuy = /*#__PURE__*/ createUseWriteContract({
  abi: paraswapAdapterAbi,
  functionName: 'buy',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link paraswapAdapterAbi}__ and `functionName` set to `"buyMorphoDebt"`
 */
export const useWriteParaswapAdapterBuyMorphoDebt =
  /*#__PURE__*/ createUseWriteContract({
    abi: paraswapAdapterAbi,
    functionName: 'buyMorphoDebt',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link paraswapAdapterAbi}__ and `functionName` set to `"erc20Transfer"`
 */
export const useWriteParaswapAdapterErc20Transfer =
  /*#__PURE__*/ createUseWriteContract({
    abi: paraswapAdapterAbi,
    functionName: 'erc20Transfer',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link paraswapAdapterAbi}__ and `functionName` set to `"nativeTransfer"`
 */
export const useWriteParaswapAdapterNativeTransfer =
  /*#__PURE__*/ createUseWriteContract({
    abi: paraswapAdapterAbi,
    functionName: 'nativeTransfer',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link paraswapAdapterAbi}__ and `functionName` set to `"sell"`
 */
export const useWriteParaswapAdapterSell = /*#__PURE__*/ createUseWriteContract(
  { abi: paraswapAdapterAbi, functionName: 'sell' },
)

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link paraswapAdapterAbi}__
 */
export const useSimulateParaswapAdapter =
  /*#__PURE__*/ createUseSimulateContract({ abi: paraswapAdapterAbi })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link paraswapAdapterAbi}__ and `functionName` set to `"buy"`
 */
export const useSimulateParaswapAdapterBuy =
  /*#__PURE__*/ createUseSimulateContract({
    abi: paraswapAdapterAbi,
    functionName: 'buy',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link paraswapAdapterAbi}__ and `functionName` set to `"buyMorphoDebt"`
 */
export const useSimulateParaswapAdapterBuyMorphoDebt =
  /*#__PURE__*/ createUseSimulateContract({
    abi: paraswapAdapterAbi,
    functionName: 'buyMorphoDebt',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link paraswapAdapterAbi}__ and `functionName` set to `"erc20Transfer"`
 */
export const useSimulateParaswapAdapterErc20Transfer =
  /*#__PURE__*/ createUseSimulateContract({
    abi: paraswapAdapterAbi,
    functionName: 'erc20Transfer',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link paraswapAdapterAbi}__ and `functionName` set to `"nativeTransfer"`
 */
export const useSimulateParaswapAdapterNativeTransfer =
  /*#__PURE__*/ createUseSimulateContract({
    abi: paraswapAdapterAbi,
    functionName: 'nativeTransfer',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link paraswapAdapterAbi}__ and `functionName` set to `"sell"`
 */
export const useSimulateParaswapAdapterSell =
  /*#__PURE__*/ createUseSimulateContract({
    abi: paraswapAdapterAbi,
    functionName: 'sell',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link riftAuctionAdaptorAbi}__
 */
export const useReadRiftAuctionAdaptor = /*#__PURE__*/ createUseReadContract({
  abi: riftAuctionAdaptorAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link riftAuctionAdaptorAbi}__ and `functionName` set to `"BUNDLER3"`
 */
export const useReadRiftAuctionAdaptorBundler3 =
  /*#__PURE__*/ createUseReadContract({
    abi: riftAuctionAdaptorAbi,
    functionName: 'BUNDLER3',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link riftAuctionAdaptorAbi}__ and `functionName` set to `"btcAuctionHouse"`
 */
export const useReadRiftAuctionAdaptorBtcAuctionHouse =
  /*#__PURE__*/ createUseReadContract({
    abi: riftAuctionAdaptorAbi,
    functionName: 'btcAuctionHouse',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link riftAuctionAdaptorAbi}__ and `functionName` set to `"syntheticBitcoin"`
 */
export const useReadRiftAuctionAdaptorSyntheticBitcoin =
  /*#__PURE__*/ createUseReadContract({
    abi: riftAuctionAdaptorAbi,
    functionName: 'syntheticBitcoin',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link riftAuctionAdaptorAbi}__
 */
export const useWriteRiftAuctionAdaptor = /*#__PURE__*/ createUseWriteContract({
  abi: riftAuctionAdaptorAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link riftAuctionAdaptorAbi}__ and `functionName` set to `"createAuction"`
 */
export const useWriteRiftAuctionAdaptorCreateAuction =
  /*#__PURE__*/ createUseWriteContract({
    abi: riftAuctionAdaptorAbi,
    functionName: 'createAuction',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link riftAuctionAdaptorAbi}__ and `functionName` set to `"erc20Transfer"`
 */
export const useWriteRiftAuctionAdaptorErc20Transfer =
  /*#__PURE__*/ createUseWriteContract({
    abi: riftAuctionAdaptorAbi,
    functionName: 'erc20Transfer',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link riftAuctionAdaptorAbi}__ and `functionName` set to `"nativeTransfer"`
 */
export const useWriteRiftAuctionAdaptorNativeTransfer =
  /*#__PURE__*/ createUseWriteContract({
    abi: riftAuctionAdaptorAbi,
    functionName: 'nativeTransfer',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link riftAuctionAdaptorAbi}__
 */
export const useSimulateRiftAuctionAdaptor =
  /*#__PURE__*/ createUseSimulateContract({ abi: riftAuctionAdaptorAbi })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link riftAuctionAdaptorAbi}__ and `functionName` set to `"createAuction"`
 */
export const useSimulateRiftAuctionAdaptorCreateAuction =
  /*#__PURE__*/ createUseSimulateContract({
    abi: riftAuctionAdaptorAbi,
    functionName: 'createAuction',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link riftAuctionAdaptorAbi}__ and `functionName` set to `"erc20Transfer"`
 */
export const useSimulateRiftAuctionAdaptorErc20Transfer =
  /*#__PURE__*/ createUseSimulateContract({
    abi: riftAuctionAdaptorAbi,
    functionName: 'erc20Transfer',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link riftAuctionAdaptorAbi}__ and `functionName` set to `"nativeTransfer"`
 */
export const useSimulateRiftAuctionAdaptorNativeTransfer =
  /*#__PURE__*/ createUseSimulateContract({
    abi: riftAuctionAdaptorAbi,
    functionName: 'nativeTransfer',
  })
