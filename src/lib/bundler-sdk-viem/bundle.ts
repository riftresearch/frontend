import type { SimulationState } from "@morpho-org/simulation-sdk";
import type { Address } from "viem";
import { encodeBundle } from "./actions";
import {
  type BundlingOptions,
  finalizeBundle,
  populateBundle,
} from "./operations";
import type { InputBundlerOperation } from "./types/index";

export const setupBundle = (
  inputOperations: InputBundlerOperation[],
  startData: SimulationState,
  receiver: Address,
  {
    supportsSignature,
    unwrapTokens,
    unwrapSlippage,
    ...options
  }: BundlingOptions & {
    supportsSignature?: boolean;
    unwrapTokens?: Set<Address>;
    unwrapSlippage?: bigint;
  } = {},
) => {
  let { operations } = populateBundle(inputOperations, startData, options);

  operations = finalizeBundle(
    operations,
    startData,
    receiver,
    unwrapTokens,
    unwrapSlippage,
  );

  const bundle = encodeBundle(operations, startData, supportsSignature);

  return {
    operations,
    bundle,
  };
};
