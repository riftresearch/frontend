import React from "react";
import { Box, Text, Flex } from "@chakra-ui/react";
import { FONT_FAMILIES } from "@/utils/font";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { RiftLogo } from "@/components/other/RiftLogo";
import { GridFlex } from "../other/GridFlex";
import { VolumeTxnChart } from "@/components/charts/VolumeTxnChart";
import { useAnalyticsStore } from "@/utils/analyticsStore";

interface AdminDashboardProps {
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  // data from analytics store
  const totalVolume = useAnalyticsStore((s) => s.totalVolume);
  const totalFeesCollected = useAnalyticsStore((s) => s.totalFeesCollected);
  const totalSwaps = useAnalyticsStore((s) => s.totalSwaps);
  const totalUsers = useAnalyticsStore((s) => s.totalUsers);

  return (
    <Flex minHeight="100vh" bg={"#000000"} justifyContent="center">
      <Flex width="1400px" py="30px" mt="15px" direction="column">
        {/* HEADER */}
        <Flex justify="space-between" align="center">
          <RiftLogo width="110" height="28" fill={colorsAnalytics.offWhite} />
          <Text
            fontSize="sm"
            color={colorsAnalytics.textGray}
            fontFamily={FONT_FAMILIES.SF_PRO}
          >
            Admin Dashboard
          </Text>
        </Flex>
        {/* OVERVIEW */}
        <Flex justify="space-between" align="center" mt="40px" gap="20px">
          {/* TOTAL VOLUME */}
          <GridFlex widthBlocks={10} heightBlocks={3}>
            <Flex direction="column" pl="25px" pt="18px">
              <Text
                color={colorsAnalytics.textGray}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="19px"
                fontWeight="bold"
                mb="8px"
              >
                Total Volume
              </Text>
              <Text
                mt="-11px"
                fontWeight="bold"
                color={colorsAnalytics.offWhite}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="49px"
              >
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format(totalVolume)}
              </Text>
            </Flex>
          </GridFlex>

          {/* TOTAL FEES COLLECTED */}
          <GridFlex widthBlocks={9} heightBlocks={3}>
            <Flex direction="column" pl="25px" pt="18px">
              <Text
                color={colorsAnalytics.textGray}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="19px"
                fontWeight="bold"
                mb="8px"
              >
                Total Fees Collected
              </Text>
              <Text
                mt="-12px"
                fontWeight="bold"
                color={colorsAnalytics.offWhite}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="49px"
              >
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format(totalFeesCollected)}
              </Text>
            </Flex>
          </GridFlex>

          {/* TOTAL SWAPS */}
          <GridFlex widthBlocks={5.6} heightBlocks={3}>
            <Flex direction="column" pl="25px" pt="18px">
              <Text
                color={colorsAnalytics.textGray}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="19px"
                fontWeight="bold"
                mb="8px"
              >
                Total Swaps
              </Text>
              <Text
                mt="-12px"
                fontWeight="bold"
                color={colorsAnalytics.offWhite}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="49px"
              >
                {new Intl.NumberFormat("en-US", {
                  maximumFractionDigits: 0,
                }).format(totalSwaps)}
              </Text>
            </Flex>
          </GridFlex>

          {/* TOTAL USERS */}
          <GridFlex widthBlocks={5.6} heightBlocks={3}>
            <Flex direction="column" pl="25px" pt="18px">
              <Text
                color={colorsAnalytics.textGray}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="19px"
                fontWeight="bold"
                mb="8px"
              >
                Total Users
              </Text>
              <Text
                mt="-12px"
                fontWeight="bold"
                color={colorsAnalytics.offWhite}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="49px"
              >
                {new Intl.NumberFormat("en-US", {
                  maximumFractionDigits: 0,
                }).format(totalUsers)}
              </Text>
            </Flex>
          </GridFlex>
        </Flex>
        {/* VOLUME CHART */}
        <GridFlex width="100%" heightBlocks={13} mt="30px">
          <VolumeTxnChart />
        </GridFlex>
      </Flex>
    </Flex>
  );
};
