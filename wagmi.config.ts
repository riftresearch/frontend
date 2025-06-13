import { defineConfig } from "@wagmi/cli";
import { react } from "@wagmi/cli/plugins";
import {
  BTCDutchAuctionHouse,
  Bundler3,
  GeneralAdapter1,
  ParaswapAdapter,
  RiftAuctionAdaptor,
  ERC20,
  LibExposer,
} from "./src/utils/contractArtifacts";
import type { Abi } from "viem";

export default defineConfig({
  out: "src/generated.ts",
  contracts: [
    {
      name: "BTCDutchAuctionHouse",
      abi: BTCDutchAuctionHouse.abi as Abi,
    },
    {
      name: "Bundler3",
      abi: Bundler3.abi as Abi,
    },
    {
      name: "GeneralAdapter1",
      abi: GeneralAdapter1.abi as Abi,
    },
    {
      name: "ParaswapAdapter",
      abi: ParaswapAdapter.abi as Abi,
    },
    {
      name: "RiftAuctionAdaptor",
      abi: RiftAuctionAdaptor.abi as Abi,
    },
    {
      name: "ERC20",
      abi: ERC20.abi as Abi,
    },
    {
      name: "LibExposer",
      abi: LibExposer.abi as Abi,
    },
  ],
  plugins: [react()],
});
