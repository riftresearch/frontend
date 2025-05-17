# Rift

A trustless bridge between Ethereum and Bitcoin using zero-knowledge proofs

![Rift](https://utfs.io/f/fba5931a-c414-4252-b282-633fb4353a59-gtky0k.png)


## Network Configuration

Supported chains are configured in [`src/config/chains.ts`](src/config/chains.ts).
Each entry maps a chain ID to RPC URLs, block explorer links, and Rift contract
addresses. By default the app targets Base mainnet (8453) but you can switch to
Ethereum (1) or the local Devnet (1337) using the dropdown in the navigation bar.

Example commands using **pnpm**:

```bash
pnpm install
pnpm run dev
```




