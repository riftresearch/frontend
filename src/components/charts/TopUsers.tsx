import React from "react";
import { Box, Flex, Text, Spinner, Button } from "@chakra-ui/react";
import { GridFlex } from "@/components/other/GridFlex";
import { FONT_FAMILIES } from "@/utils/font";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { useAnalyticsStore } from "@/utils/analyticsStore";
import { FiRefreshCw } from "react-icons/fi";

interface TopUser {
  user_evm_account_address: string;
  total_volume: string; // In satoshis (cbBTC 8 decimals)
  total_rift_fees: string; // In satoshis
  total_swaps: number;
  first_swap_at: string;
  last_swap_at: string;
}

interface TopUsersResponse {
  users: TopUser[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

const ANALYTICS_API_URL = process.env.NEXT_PUBLIC_ANALYTICS_API_URL || "http://localhost:3000";

function getApiKeyFromCookie(): string {
  if (typeof document === "undefined") return "";

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "admin_api_key") {
      return value;
    }
  }
  return "";
}

async function fetchUsers(
  sort: "volume" | "swaps" | "recent" = "volume",
  page = 0,
  pageSize = 20
): Promise<TopUsersResponse> {
  const offset = page * pageSize;
  const apiKey = getApiKeyFromCookie();

  console.log(
    `🔗 Fetching users: ${ANALYTICS_API_URL}/api/users?limit=${pageSize}&offset=${offset}&sort=${sort}`
  );

  const response = await fetch(
    `${ANALYTICS_API_URL}/api/users?limit=${pageSize}&offset=${offset}&sort=${sort}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  console.log("📡 Users API response status:", response.status);

  if (!response.ok) {
    const { toastError } = await import("@/utils/toast");
    toastError(null, {
      title: "Failed to Fetch Users",
      description: `Server returned ${response.status}`,
    });
    throw new Error(`Failed to fetch users: ${response.status}`);
  }

  const data = await response.json();
  console.log("📦 Users response data:", JSON.stringify(data, null, 2));

  return data;
}

function displayShortAddress(addr: string): string {
  if (!addr || addr.length < 8) return addr;
  const prefix = addr.startsWith("0x") ? "0x" : "";
  const hex = addr.replace(/^0x/, "");
  return `${prefix}${hex.slice(0, 6)}...${hex.slice(-4)}`;
}

function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatBTC(satoshis: string): number {
  // Convert from satoshis (8 decimals) to BTC
  return parseInt(satoshis, 10) / 1e8;
}

function timeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const UserRow: React.FC<{ user: TopUser; btcPriceUsd: number }> = ({ user, btcPriceUsd }) => {
  const volumeBtc = formatBTC(user.total_volume);
  const volumeUsd = volumeBtc * btcPriceUsd;
  const feesBtc = formatBTC(user.total_rift_fees);
  const feesUsd = feesBtc * btcPriceUsd;

  return (
    <Flex w="100%" py="14px" px="16px" align="center" letterSpacing={"-0.8px"}>
      <Box w="275px">
        <Flex
          as="button"
          onClick={() =>
            window.open(`https://etherscan.io/address/${user.user_evm_account_address}`, "_blank")
          }
          bg="#1D1D1D"
          px="10px"
          py="7px"
          borderRadius="10px"
          _hover={{ filter: "brightness(1.1)" }}
          cursor="pointer"
          justifyContent="center"
          alignItems="center"
        >
          <Text fontSize="14px" color={colorsAnalytics.offWhite} fontFamily={FONT_FAMILIES.SF_PRO}>
            {displayShortAddress(user.user_evm_account_address)}
          </Text>
        </Flex>
      </Box>
      <Box w="253px">
        <Text fontSize="17px" color={colorsAnalytics.offWhite} fontFamily={FONT_FAMILIES.SF_PRO}>
          {formatUSD(volumeUsd)}
        </Text>
      </Box>
      <Box w="253px">
        <Text fontSize="17px" color={colorsAnalytics.offWhite} fontFamily={FONT_FAMILIES.SF_PRO}>
          {formatUSD(feesUsd)}
        </Text>
      </Box>
      <Box w="190px">
        <Text fontSize="17px" color={colorsAnalytics.offWhite} fontFamily={FONT_FAMILIES.SF_PRO}>
          {new Intl.NumberFormat("en-US").format(user.total_swaps)}
        </Text>
      </Box>
      <Box w="190px">
        <Text fontSize="16px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
          {timeAgo(user.first_swap_at)}
        </Text>
      </Box>
      <Box w="190px">
        <Text fontSize="16px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
          {timeAgo(user.last_swap_at)}
        </Text>
      </Box>
    </Flex>
  );
};

export const TopUsers: React.FC<{ heightBlocks?: number }> = ({ heightBlocks = 10 }) => {
  const [users, setUsers] = React.useState<TopUser[]>([]);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  const [sortBy, setSortBy] = React.useState<"volume" | "swaps" | "recent">("volume");
  const pageSize = 20;

  // Get BTC price from store for USD conversions
  const btcPriceUsd = useAnalyticsStore((s) => s.btcPriceUsd);

  // Refresh users (reset and refetch)
  const handleRefresh = React.useCallback(() => {
    setUsers([]);
    setPage(0);
    setHasMore(true);
    setIsInitialLoad(true);
  }, []);

  // Fetch next page
  const fetchNextPage = React.useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      console.log(`Fetching users page ${page} (sort: ${sortBy})...`);
      const data = await fetchUsers(sortBy, page, pageSize);
      console.log("Raw users data:", JSON.stringify(data, null, 2));
      const newUsers = data?.users || [];

      console.log(`Received ${newUsers.length} users from page ${page}`);
      if (newUsers.length > 0) {
        console.log("First user sample:", JSON.stringify(newUsers[0], null, 2));
      }

      if (newUsers.length < pageSize) {
        setHasMore(false);
      }

      setUsers((prev) => {
        const existing = new Set(prev.map((u) => u.user_evm_account_address));
        const filtered = newUsers.filter((u) => !existing.has(u.user_evm_account_address));
        return [...prev, ...filtered];
      });

      setPage((p) => p + 1);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoadingMore(false);
      setIsInitialLoad(false);
    }
  }, [page, pageSize, isLoadingMore, hasMore, sortBy]);

  // Initial load and refetch when sort changes
  React.useEffect(() => {
    setUsers([]);
    setPage(0);
    setHasMore(true);
    setIsInitialLoad(true);
  }, [sortBy]);

  React.useEffect(() => {
    if (page === 0 && users.length === 0) {
      fetchNextPage();
    }
  }, [page, users.length, fetchNextPage]);

  // Handle scroll for infinite loading
  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (isLoadingMore || !hasMore) return;
      const el = e.currentTarget;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 100) {
        fetchNextPage();
      }
    },
    [isLoadingMore, hasMore, fetchNextPage]
  );

  return (
    <Box position="relative" w="100%">
      {/* Sort Buttons and Refresh Button - Outside GridFlex */}
      <Flex justify="flex-end" align="center" mb="12px" gap="8px">
        {/* Sort Buttons */}
        <Button
          size="sm"
          onClick={() => setSortBy("recent")}
          bg={sortBy === "recent" ? colorsAnalytics.greenBackground : "transparent"}
          borderWidth="2px"
          borderRadius="16px"
          borderColor={
            sortBy === "recent" ? colorsAnalytics.greenOutline : colorsAnalytics.borderGray
          }
          color={colorsAnalytics.offWhite}
          fontFamily={FONT_FAMILIES.SF_PRO}
          fontSize="12px"
          px="12px"
          _hover={{
            opacity: 0.8,
          }}
        >
          Recent
        </Button>
        <Button
          size="sm"
          onClick={() => setSortBy("swaps")}
          bg={sortBy === "swaps" ? colorsAnalytics.greenBackground : "transparent"}
          borderRadius="16px"
          borderWidth="2px"
          borderColor={
            sortBy === "swaps" ? colorsAnalytics.greenOutline : colorsAnalytics.borderGray
          }
          color={colorsAnalytics.offWhite}
          fontFamily={FONT_FAMILIES.SF_PRO}
          fontSize="12px"
          px="12px"
          _hover={{
            opacity: 0.8,
          }}
        >
          By Swaps
        </Button>

        <Button
          size="sm"
          onClick={() => setSortBy("volume")}
          bg={sortBy === "volume" ? colorsAnalytics.greenBackground : "transparent"}
          borderWidth="2px"
          borderRadius="16px"
          borderColor={
            sortBy === "volume" ? colorsAnalytics.greenOutline : colorsAnalytics.borderGray
          }
          color={colorsAnalytics.offWhite}
          fontFamily={FONT_FAMILIES.SF_PRO}
          fontSize="12px"
          px="12px"
          _hover={{
            opacity: 0.8,
          }}
        >
          By Volume
        </Button>

        {/* Refresh Button */}
        <Button
          size="sm"
          onClick={handleRefresh}
          bg="transparent"
          borderWidth="2px"
          borderRadius="16px"
          borderColor={colorsAnalytics.borderGray}
          color={colorsAnalytics.offWhite}
          fontFamily={FONT_FAMILIES.SF_PRO}
          fontSize="12px"
          px="12px"
          _hover={{
            opacity: 0.8,
          }}
        >
          <FiRefreshCw />
        </Button>
      </Flex>

      <GridFlex width="100%" heightBlocks={heightBlocks} contentPadding={0}>
        <Flex direction="column" w="100%" h="100%">
          {/* Header Row */}
          <Flex
            px="16px"
            pt="16px"
            pb="8px"
            fontSize="15px"
            align="center"
            fontWeight="bold"
            color={colorsAnalytics.textGray}
            flexShrink={0}
          >
            <Box w="275px">
              <Text fontFamily={FONT_FAMILIES.SF_PRO}>User EVM Account</Text>
            </Box>
            <Box w="253px">
              <Text fontFamily={FONT_FAMILIES.SF_PRO}>Total Volume</Text>
            </Box>
            <Box w="253px">
              <Text fontFamily={FONT_FAMILIES.SF_PRO}>Total Rift Fees</Text>
            </Box>
            <Box w="190px">
              <Text fontFamily={FONT_FAMILIES.SF_PRO}>Total Swaps</Text>
            </Box>
            <Box w="190px">
              <Text fontFamily={FONT_FAMILIES.SF_PRO}>First Swap</Text>
            </Box>
            <Box w="190px">
              <Text fontFamily={FONT_FAMILIES.SF_PRO}>Latest Swap</Text>
            </Box>
          </Flex>

          {/* Rows */}
          <Box
            flex="1"
            overflowY="auto"
            overflowX="hidden"
            onScroll={handleScroll}
            mr="8px"
            css={{
              "&::-webkit-scrollbar": {
                width: "8px",
              },
              "&::-webkit-scrollbar-track": {
                background: "transparent",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "#333",
                borderRadius: "4px",
              },
              "&::-webkit-scrollbar-thumb:hover": {
                background: "#444",
              },
            }}
            minHeight="0"
          >
            <Flex direction="column" w="100%">
              {isInitialLoad && users.length === 0 ? (
                <Flex justify="center" align="center" py="40px">
                  <Spinner size="md" color={colorsAnalytics.offWhite} />
                </Flex>
              ) : (
                <>
                  {users.map((user) => (
                    <UserRow
                      key={user.user_evm_account_address}
                      user={user}
                      btcPriceUsd={btcPriceUsd}
                    />
                  ))}
                  {isLoadingMore && (
                    <Flex justify="center" py="12px" flexShrink={0}>
                      <Spinner size="sm" color={colorsAnalytics.offWhite} />
                    </Flex>
                  )}
                  {!hasMore && users.length > 0 && (
                    <Flex justify="center" py="12px" flexShrink={0}>
                      <Text
                        fontSize="14px"
                        color={colorsAnalytics.textGray}
                        fontFamily={FONT_FAMILIES.SF_PRO}
                      >
                        No more users to load
                      </Text>
                    </Flex>
                  )}
                  {users.length === 0 && !isInitialLoad && (
                    <Flex justify="center" py="40px">
                      <Text
                        fontSize="14px"
                        color={colorsAnalytics.textGray}
                        fontFamily={FONT_FAMILIES.SF_PRO}
                      >
                        No users found
                      </Text>
                    </Flex>
                  )}
                </>
              )}
            </Flex>
          </Box>
        </Flex>
      </GridFlex>
    </Box>
  );
};

export default TopUsers;
