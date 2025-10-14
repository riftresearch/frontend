import { formatUnits, BigNumberish } from "ethers";
import { BITCOIN_DECIMALS } from "./constants";

export function satsToBtc(sats: number): string {
  const satsValue = sats as BigNumberish;
  return formatUnits(satsValue, BITCOIN_DECIMALS);
}
