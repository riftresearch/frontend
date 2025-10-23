import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Box, Flex, Text, Spinner, Button } from "@chakra-ui/react";
import { useAccount } from "wagmi";
import { AdminSwapItem, AdminSwapFlowStep } from "@/utils/types";
import { FONT_FAMILIES } from "@/utils/font";
import { colors } from "@/utils/colors";
import { mapDbRowToAdminSwap } from "@/utils/analyticsClient";
import { ANALYTICS_API_URL } from "@/utils/analyticsClient";
import { reownModal } from "@/utils/wallet";
import { FiClock, FiCheck, FiX, FiExternalLink } from "react-icons/fi";
import { GridFlex } from "@/components/other/GridFlex";

function displayShortTxHash(hash: string): string {
  if (!hash || hash.length < 12) return hash;
  const prefix = hash.startsWith("0x") ? "0x" : "";
  const hex = hash.replace(/^0x/, "");
  // Show double the characters: 8 at start and 8 at end
  return `${prefix}${hex.slice(0, 8)}...${hex.slice(-8)}`;
}

function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatBTC(n: number) {
  return `${Number(n)
    .toFixed(8)
    .replace(/\.0+$/, "")
    .replace(/(\.[0-9]*?)0+$/, "$1")} BTC`;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

const AssetIcon: React.FC<{ badge?: "BTC" | "cbBTC" }> = ({ badge }) => {
  if (!badge) return null;
  const src = badge === "BTC" ? "/images/BTC_icon.svg" : "/images/cbBTC_icon.svg";
  return <Image src={src} alt={badge} width={18} height={18} style={{ opacity: 0.9 }} />;
};

const StatusBadge: React.FC<{ swap: AdminSwapItem }> = ({ swap }) => {
  const lastStep = swap.flow[swap.flow.length - 1];
  const isCompleted = lastStep?.state === "completed" && lastStep?.status === "settled";
  const isInProgress = !isCompleted;

  if (isCompleted) {
    return (
      <Flex
        align="center"
        gap="6px"
        bg="rgba(34, 197, 94, 0.15)"
        border="1.5px solid rgba(34, 197, 94, 0.4)"
        borderRadius="16px"
        px="12px"
        h="35px"
      >
        <FiCheck size={14} color="#22c55e" />
        <Text
          fontSize="13px"
          color="#22c55e"
          fontWeight="500"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          letterSpacing="-0.5px"
        >
          Completed
        </Text>
      </Flex>
    );
  }

  return (
    <Flex
      align="center"
      gap="6px"
      bg="rgba(251, 191, 36, 0.15)"
      border="1.5px solid rgba(251, 191, 36, 0.4)"
      borderRadius="16px"
      px="12px"
      h="35px"
    >
      <Spinner size="xs" color="#fbbf24" />
      <Text
        fontSize="13px"
        color="#fbbf24"
        fontWeight="500"
        fontFamily={FONT_FAMILIES.AUX_MONO}
        letterSpacing="-0.5px"
      >
        Swapping
      </Text>
    </Flex>
  );
};

async function fetchUserSwaps(account: string): Promise<AdminSwapItem[]> {
  try {
    const url = `${ANALYTICS_API_URL}/api/swaps?account=${account}&limit=50&offset=0`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error("Failed to fetch user swaps:", response.status);
      return [];
    }

    const data = await response.json();
    if (!data.swaps || !Array.isArray(data.swaps)) {
      return [];
    }

    return data.swaps.map((row: any) => mapDbRowToAdminSwap(row));
  } catch (error) {
    console.error("Error fetching user swaps:", error);
    return [];
  }
}

export const UserSwapHistory: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [swaps, setSwaps] = useState<AdminSwapItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      setLoading(true);
      fetchUserSwaps(address)
        .then(setSwaps)
        .finally(() => setLoading(false));
    } else {
      setSwaps([]);
    }
  }, [address, isConnected]);

  const handleConnectWallet = async () => {
    await reownModal.open();
  };

  if (!isConnected) {
    return (
      <Flex
        w="100%"
        direction="column"
        align="center"
        justify="center"
        bg={colors.offBlack}
        borderRadius="20px"
        border={`2px solid ${colors.borderGray}`}
        p="60px"
        minH="400px"
      >
        <Text
          fontSize="32px"
          fontFamily={FONT_FAMILIES.NOSTROMO}
          color={colors.offWhite}
          mb="16px"
          textAlign="center"
        >
          Swap History
        </Text>
        <Text
          fontSize="16px"
          fontFamily={FONT_FAMILIES.SF_PRO}
          color={colors.textGray}
          mb="32px"
          textAlign="center"
        >
          Connect your wallet to view your swap history and track the status of your current and
          previous Rift swaps.
        </Text>
        <Button
          onClick={handleConnectWallet}
          cursor="pointer"
          color={colors.offWhite}
          _active={{ bg: colors.swapBgColor }}
          _hover={{ bg: colors.swapHoverColor }}
          borderRadius="12px"
          border={`2.5px solid ${colors.swapBorderColor}`}
          type="button"
          fontFamily={FONT_FAMILIES.SF_PRO}
          fontSize="17px"
          paddingX="32px"
          paddingY="12px"
          bg={colors.swapBgColor}
          boxShadow="0px 0px 5px 3px rgba(18,18,18,1)"
        >
          Connect Wallet
        </Button>
      </Flex>
    );
  }

  return (
    <GridFlex width="100%" borderRadius="40px" heightBlocks={13} contentPadding={0}>
      <Flex direction="column" w="100%" h="100%">
        {/* Table */}
        {loading ? (
          <Flex w="100%" justify="center" align="center" py="80px">
            <Spinner size="lg" color={colors.offWhite} />
          </Flex>
        ) : swaps.length === 0 ? (
          <Flex w="100%" direction="column" align="center" justify="center" py="80px">
            <Text fontSize="18px" fontFamily={FONT_FAMILIES.SF_PRO} color={colors.textGray}>
              No swaps found
            </Text>
            <Text
              fontSize="14px"
              fontFamily={FONT_FAMILIES.SF_PRO}
              color={colors.textGray}
              mt="8px"
            >
              Your swap history will appear here once you make your first swap
            </Text>
          </Flex>
        ) : (
          <Box w="100%" overflowY="auto" flex="1">
            {/* Table Header */}
            <Flex
              w="100%"
              px="32px"
              py="12px"
              bg="rgba(255, 255, 255, 0.02)"
              borderBottom={`1px solid ${colors.borderGray}`}
              fontSize="11px"
              fontFamily={FONT_FAMILIES.SF_PRO}
              color={colors.textGray}
              fontWeight="600"
              textTransform="uppercase"
              letterSpacing="0.5px"
              flexShrink={0}
            >
              <Text flex="0 0 122px">Time</Text>
              <Text flex="0 0 104px">USD</Text>
              <Text flex="0 0 150px">Amount</Text>
              <Text flex="0 0 217px">Deposit Txn</Text>
              <Text flex="0 0 167px">Direction</Text>
              <Text flex="0 0 209px">Payout Txn</Text>
              <Text flex="1">Status</Text>
            </Flex>

            {/* Table Rows */}
            {swaps.map((swap) => {
              const userDepositStep = swap.flow.find(
                (s) => s.status === "waiting_user_deposit_initiated"
              );
              const mmDepositStep = swap.flow.find(
                (s) => s.status === "waiting_mm_deposit_initiated"
              );
              let userTxHash = userDepositStep?.txHash;
              const userTxChain = userDepositStep?.txChain;
              let mmTxHash = mmDepositStep?.txHash;
              const mmTxChain = mmDepositStep?.txChain;

              // Add 0x prefix to Ethereum transaction hashes if missing
              if (userTxHash && userTxChain !== "BTC" && !userTxHash.startsWith("0x")) {
                userTxHash = `0x${userTxHash}`;
              }
              if (mmTxHash && mmTxChain !== "BTC" && !mmTxHash.startsWith("0x")) {
                mmTxHash = `0x${mmTxHash}`;
              }

              console.log(`[SWAP ${swap.id}] Deposit Txn:`, {
                swap,
                userDepositStep,
                userTxHash,
                userTxChain,
                mmTxHash,
                mmTxChain,
                flowSteps: swap.flow.map((s) => ({
                  status: s.status,
                  txHash: s.txHash,
                  txChain: s.txChain,
                })),
              });

              // Determine colors based on direction
              // BTC_TO_EVM: User deposits BTC (orange), MM pays out cbBTC (blue)
              // EVM_TO_BTC: User deposits cbBTC (blue), MM pays out BTC (orange)
              const isBTCtoEVM = swap.direction === "BTC_TO_EVM";
              const userBg = isBTCtoEVM ? "rgba(255, 143, 40, 0.15)" : "rgba(57, 74, 255, 0.2)";
              const userBorder = isBTCtoEVM ? "rgba(255, 143, 40, 0.4)" : "rgba(57, 74, 255, 0.7)";
              const userColor = isBTCtoEVM ? "#FF8F28" : "#5085FF";
              const mmBg = isBTCtoEVM ? "rgba(57, 74, 255, 0.2)" : "rgba(255, 143, 40, 0.15)";
              const mmBorder = isBTCtoEVM ? "rgba(57, 74, 255, 0.7)" : "rgba(255, 143, 40, 0.4)";
              const mmColor = isBTCtoEVM ? "#5085FF" : "#FF8F28";

              // Amount color matches deposit transaction color
              const amountColor = userColor;

              const lastStep = swap.flow[swap.flow.length - 1];
              const isCompleted = lastStep?.state === "completed" && lastStep?.status === "settled";

              return (
                <Flex
                  key={swap.id}
                  w="100%"
                  px="32px"
                  py="16px"
                  borderBottom={`1px solid ${colors.borderGray}`}
                  align="center"
                  _hover={{ bg: "rgba(255, 255, 255, 0.02)" }}
                  transition="background 0.15s ease"
                >
                  {/* Time */}
                  <Flex flex="0 0 122px">
                    <Text
                      fontSize="12px"
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      color={colors.textGray}
                      letterSpacing="-0.5px"
                    >
                      {formatTimeAgo(swap.swapCreationTimestamp)}
                    </Text>
                  </Flex>

                  {/* USD */}
                  <Flex flex="0 0 104px">
                    <Text
                      fontSize="13px"
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      color={colors.offWhite}
                      fontWeight="500"
                      letterSpacing="-0.5px"
                    >
                      {formatUSD(swap.swapInitialAmountUsd)}
                    </Text>
                  </Flex>

                  {/* Amount */}
                  <Flex flex="0 0 150px">
                    <Text
                      fontSize="13px"
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      color={amountColor}
                      fontWeight="500"
                      letterSpacing="-0.5px"
                    >
                      {formatBTC(swap.swapInitialAmountBtc)}
                    </Text>
                  </Flex>

                  {/* User Deposit Transaction */}
                  <Flex flex="0 0 217px">
                    {userTxHash ? (
                      <Flex
                        as="button"
                        onClick={() => {
                          const url =
                            userTxChain === "BTC"
                              ? `https://mempool.space/tx/${userTxHash}`
                              : userTxChain === "ETH"
                                ? `https://etherscan.io/tx/${userTxHash}`
                                : `https://basescan.org/tx/${userTxHash}`;
                          window.open(url, "_blank");
                        }}
                        bg={userBg}
                        border={`1.5px solid ${userBorder}`}
                        borderRadius="16px"
                        px="10px"
                        h="35px"
                        _hover={{ filter: "brightness(1.2)" }}
                        fontSize="11px"
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        color={userColor}
                        fontWeight="500"
                        cursor="pointer"
                        w="fit-content"
                        align="center"
                        gap="4px"
                        letterSpacing="-0.5px"
                      >
                        {displayShortTxHash(userTxHash)}
                        <Box ml="4px">
                          <FiExternalLink size={11} />
                        </Box>
                      </Flex>
                    ) : (
                      <Text
                        fontSize="11px"
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        color={colors.textGray}
                        letterSpacing="-0.5px"
                      >
                        Pending...
                      </Text>
                    )}
                  </Flex>

                  {/* Direction */}
                  <Flex flex="0 0 167px" align="center" gap="6px">
                    <AssetIcon badge={swap.direction === "BTC_TO_EVM" ? "BTC" : "cbBTC"} />
                    <Text
                      fontSize="12px"
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      color={colors.textGray}
                      letterSpacing="-0.5px"
                    >
                      {swap.direction === "BTC_TO_EVM" ? "BTC" : "cbBTC"}
                    </Text>
                    <Text
                      fontSize="13px"
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      color={colors.textGray}
                      letterSpacing="-0.5px"
                    >
                      →
                    </Text>
                    <AssetIcon badge={swap.direction === "BTC_TO_EVM" ? "cbBTC" : "BTC"} />
                    <Text
                      fontSize="12px"
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      color={colors.textGray}
                      letterSpacing="-0.5px"
                    >
                      {swap.direction === "BTC_TO_EVM" ? "cbBTC" : "BTC"}
                    </Text>
                  </Flex>

                  {/* MM Payout Transaction */}
                  <Flex flex="0 0 209px">
                    {mmTxHash ? (
                      <Flex
                        as="button"
                        onClick={() => {
                          const url =
                            mmTxChain === "BTC"
                              ? `https://mempool.space/tx/${mmTxHash}`
                              : mmTxChain === "ETH"
                                ? `https://etherscan.io/tx/${mmTxHash}`
                                : `https://basescan.org/tx/${mmTxHash}`;
                          window.open(url, "_blank");
                        }}
                        bg={mmBg}
                        border={`1.5px solid ${mmBorder}`}
                        borderRadius="16px"
                        px="10px"
                        h="35px"
                        _hover={{ filter: "brightness(1.2)" }}
                        fontSize="11px"
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        color={mmColor}
                        fontWeight="500"
                        cursor="pointer"
                        w="fit-content"
                        align="center"
                        gap="4px"
                        letterSpacing="-0.5px"
                      >
                        {displayShortTxHash(mmTxHash)}
                        <Box ml="4px">
                          <FiExternalLink size={11} />
                        </Box>
                      </Flex>
                    ) : isCompleted ? (
                      <Text
                        fontSize="11px"
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        color={colors.textGray}
                        letterSpacing="-0.5px"
                      >
                        —
                      </Text>
                    ) : (
                      <Text
                        fontSize="11px"
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        color={colors.textGray}
                        letterSpacing="-0.5px"
                      >
                        Pending...
                      </Text>
                    )}
                  </Flex>

                  {/* Status */}
                  <Flex flex="1">
                    <StatusBadge swap={swap} />
                  </Flex>
                </Flex>
              );
            })}
          </Box>
        )}
      </Flex>
    </GridFlex>
  );
};
