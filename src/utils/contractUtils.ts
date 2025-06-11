import { createMemoryClient, parseEther } from 'tevm';

import { tevmDefault } from 'tevm/common';
import {
    BTCDutchAuctionHouse,
    Bundler3,
    GeneralAdapter1,
    LibExposer,
    ParaswapAdapter,
    RiftAuctionAdaptor,
} from './contractArtifacts';

const client = createMemoryClient({
    miningConfig: { type: 'auto' },
    allowUnlimitedContractSize: true,
});

let deployedLibExposerAddress: `0x${string}` | null = null;

const getDeployedLibExposer = async (): Promise<`0x${string}`> => {
    // Return cached address if already deployed
    if (deployedLibExposerAddress) {
        return deployedLibExposerAddress;
    }

    await client.tevmReady();
    // 1. Create a test account with funds
    const deployerAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    await client.setBalance({
        address: deployerAddress,
        value: parseEther('10'),
    });

    // 3. Deploy the contract
    const deployResult = await client.tevmDeploy({
        abi: LibExposer.abi,
        bytecode: LibExposer.bytecode.object as `0x${string}`,
        args: [],
    });

    // Cache the deployed address for future use
    deployedLibExposerAddress = deployResult.createdAddress!;
    return deployedLibExposerAddress;
};

// =============================================================================
//                              BITCOIN SCRIPT UTILITIES
// =============================================================================

export const validateScriptPubKey = async (scriptPubKey: `0x${string}`) => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'validateScriptPubKey',
        args: [scriptPubKey],
    });
};

// =============================================================================
//                              HASH UTILITIES
// =============================================================================

export const hashOrder = async (order: any) => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'hashOrder',
        args: [order],
    });
};

export const hashPayment = async (payment: any) => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'hashPayment',
        args: [payment],
    });
};

export const hashBlockLeaf = async (blockLeaf: any) => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'hashBlockLeaf',
        args: [blockLeaf],
    });
};

export const hashDutchAuction = async (dutchAuction: any) => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'hashDutchAuction',
        args: [dutchAuction],
    });
};

// =============================================================================
//                              FEE CALCULATIONS
// =============================================================================

export const calculateMinDepositAmount = async (takerFeeBips: number) => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'calculateMinDepositAmount',
        args: [takerFeeBips],
    });
};

export const calculateFeeFromDeposit = async (amount: bigint, takerFeeBips: number) => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'calculateFeeFromDeposit',
        args: [amount, takerFeeBips],
    });
};

// =============================================================================
//                              PERIOD CALCULATIONS
// =============================================================================

export const getDepositLockupPeriodScalar = async () => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'getDepositLockupPeriodScalar',
        args: [],
    });
};

export const getChallengePeriodBuffer = async () => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'getChallengePeriodBuffer',
        args: [],
    });
};

export const getScaledProofGenSlope = async () => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'getScaledProofGenSlope',
        args: [],
    });
};

export const getScaledProofGenIntercept = async () => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'getScaledProofGenIntercept',
        args: [],
    });
};

export const getProofGenScalingFactor = async () => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'getProofGenScalingFactor',
        args: [],
    });
};

export const calculateChallengePeriod = async (blocksElapsed: bigint) => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'calculateChallengePeriod',
        args: [blocksElapsed],
    });
};

export const calculateDepositLockupPeriod = async (confirmations: number) => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'calculateDepositLockupPeriod',
        args: [confirmations],
    });
};

// =============================================================================
//                              DUTCH DECAY CALCULATIONS
// =============================================================================

export const linearDecayUint = async (
    startPoint: bigint,
    endPoint: bigint,
    currentPoint: bigint,
    startAmount: bigint,
    endAmount: bigint,
) => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'linearDecayUint',
        args: [startPoint, endPoint, currentPoint, startAmount, endAmount],
    });
};

export const linearDecayInt = async (
    startPoint: bigint,
    endPoint: bigint,
    currentPoint: bigint,
    startAmount: bigint,
    endAmount: bigint,
) => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'linearDecayInt',
        args: [startPoint, endPoint, currentPoint, startAmount, endAmount],
    });
};

// =============================================================================
//                              MMR PROOF VERIFICATION
// =============================================================================

export const verifyMMRProof = async (
    leafHash: `0x${string}`,
    leafIndex: bigint,
    siblings: `0x${string}`[],
    peaks: `0x${string}`[],
    leafCount: number,
    mmrRoot: `0x${string}`,
) => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'verifyMMRProof',
        args: [leafHash, leafIndex, siblings, peaks, leafCount, mmrRoot],
    });
};

export const bagPeaks = async (peaks: `0x${string}`[]) => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'bagPeaks',
        args: [peaks],
    });
};

// =============================================================================
//                              ORDER VALIDATION CONSTANTS
// =============================================================================

export const minOutputSats = async () => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'getMinOutputSats',
        args: [],
    });
};

export const getMinConfirmationBlocks = async () => {
    return await client.readContract({
        address: await getDeployedLibExposer(),
        abi: LibExposer.abi,
        functionName: 'getMinConfirmationBlocks',
        args: [],
    });
};

console.log('alpine', minOutputSats());
