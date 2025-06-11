import { createMemoryClient, parseEther } from 'tevm';
import {
    BTCDutchAuctionHouse,
    Bundler3,
    GeneralAdapter1,
    LibExposer,
    ParaswapAdapter,
    RiftAuctionAdaptor,
} from './contractArtifacts';
import { anvil } from 'viem/chains';

const client = createMemoryClient();

const getDeployedLibExposer = async () => {
    // 1. Create a test account with funds
    const deployerAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    await client.setBalance({
        address: deployerAddress,
        value: parseEther('10'),
    });
    // 3. Deploy the contract
    const deployHash = await client.sendTransaction({
        account: deployerAddress,
        to: undefined,
        data: LibExposer.bytecode.object as `0x${string}`,
        kzg: undefined,
        chain: anvil,
    });

    // Mine to include the deployment
    await client.mine({ blocks: 1 });

    // 4. Get the deployment receipt to find contract address
    const receipt = await client.getTransactionReceipt({
        hash: deployHash,
    });
    const contractAddress = receipt.contractAddress;
    console.log(`Contract deployed at: ${contractAddress}`);

    return contractAddress;
};

export const minOutputSats = async () => {
    const contractAddress = await getDeployedLibExposer();
    const minOutputSats = await client.readContract({
        address: contractAddress,
        abi: LibExposer.abi,
        functionName: 'minOutputSats',
        args: [],
    });
    return minOutputSats;
};
