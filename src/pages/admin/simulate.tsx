import React, { useState, useEffect } from "react";
import { NextPage } from "next";
import { OpenGraph } from "@/components/other/OpenGraph";
import { PasswordGate } from "@/components/admin/PasswordGate";
import {
  getAdminPasswordFromCookie,
  setAdminPasswordCookie,
  clearAdminPasswordCookie,
} from "@/utils/auth";
import { Navbar } from "@/components/nav/Navbar";
import { TEEStatusFooter } from "@/components/other/TEEStatusFooter";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import { useBtcEthPrices } from "@/hooks/useBtcEthPrices";
import { Flex, Input, Button, Text, Box } from "@chakra-ui/react";
import { UserSwapHistory } from "@/components/activity/UserSwapHistory";
import { StatsOverview } from "@/components/other/StatsOverview";
import useWindowSize from "@/hooks/useWindowSize";
import { FONT_FAMILIES } from "@/utils/font";
import { colors } from "@/utils/colors";
import { isAddress, getAddress } from "viem";

const SimulatePage: NextPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [addressInput, setAddressInput] = useState("");
  const [simulatedAddress, setSimulatedAddress] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const { isMobile } = useWindowSize();

  useSyncChainIdToStore();
  useBtcEthPrices();

  // Check for existing authentication on mount
  useEffect(() => {
    const apiKey = getAdminPasswordFromCookie();
    if (apiKey) {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  // Set body attribute to hide wallet components
  useEffect(() => {
    document.body.setAttribute("data-admin-page", "true");
    return () => {
      document.body.removeAttribute("data-admin-page");
    };
  }, []);

  const handleAuthenticated = (password: string) => {
    setAdminPasswordCookie(password);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearAdminPasswordCookie();
    setIsAuthenticated(false);
  };

  const handleSimulate = () => {
    setAddressError(null);

    // Validate Ethereum address
    if (!addressInput.trim()) {
      setAddressError("Please enter an Ethereum address");
      return;
    }

    if (!isAddress(addressInput.trim())) {
      setAddressError("Invalid Ethereum address format");
      return;
    }

    try {
      // Convert to checksum address
      const checksumAddress = getAddress(addressInput.trim());
      setSimulatedAddress(checksumAddress);
      setShowStats(false);
    } catch (error) {
      setAddressError("Invalid Ethereum address");
    }
  };

  const handleClearSimulation = () => {
    setSimulatedAddress(null);
    setAddressInput("");
    setAddressError(null);
    setShowStats(false);
  };

  const handleInitialLoadComplete = () => {
    setShowStats(true);
  };

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <>
        <OpenGraph
          title="RIFT - Admin Simulation"
          description="Simulate user swap history view"
          embed={{ image: "/images/PreviewArt.png" }}
        />
        <PasswordGate onAuthenticated={handleAuthenticated} />
      </>
    );
  }

  return (
    <>
      <OpenGraph
        title="RIFT - Admin Simulation"
        description="Simulate user swap history view"
        embed={{ image: "/images/PreviewArt.png" }}
      />
      <Flex
        minH="100vh"
        width="100%"
        direction="column"
        backgroundImage="url('/images/rift_background_low.webp')"
        backgroundSize="cover"
        backgroundPosition="center"
        zIndex={0}
      >
        <Navbar />
        <Flex
          direction="column"
          align="center"
          justify="center"
          alignSelf="center"
          w="100%"
          maxW="1400px"
          px="20px"
          py="20px"
          flex="1"
        >
          {/* Admin Controls */}
          <Flex
            w="100%"
            maxW="1400px"
            mb="20px"
            mt={isMobile ? "80px" : "0"}
            direction="column"
            gap="12px"
            bg="rgba(10, 10, 10, 0.85)"
            borderRadius="28px"
            border={`2px solid ${colors.borderGray}`}
            p={isMobile ? "20px" : "32px"}
          >
            <Flex justify="space-between" align="center" mb="8px">
              <Text
                fontSize={isMobile ? "20px" : "24px"}
                fontFamily={FONT_FAMILIES.NOSTROMO}
                color={colors.offWhite}
              >
                Admin Simulation
              </Text>
              <Button
                onClick={handleLogout}
                size="sm"
                bg="rgba(178, 50, 50, 0.15)"
                border={`2px solid rgba(178, 50, 50, 0.4)`}
                color={colors.offWhite}
                _hover={{ bg: "rgba(178, 50, 50, 0.25)" }}
                fontFamily={FONT_FAMILIES.AUX_MONO}
                fontSize="12px"
              >
                Logout
              </Button>
            </Flex>

            <Text
              fontSize={isMobile ? "13px" : "14px"}
              fontFamily={FONT_FAMILIES.AUX_MONO}
              color={colors.textGray}
              letterSpacing="-0.5px"
              mb="12px"
            >
              Enter an Ethereum address to view their swap history as if you were that user.
            </Text>

            {/* Address Input */}
            <Flex gap="12px" direction={isMobile ? "column" : "row"} align="stretch">
              <Input
                placeholder="0x... (Ethereum Address)"
                value={addressInput}
                onChange={(e) => {
                  setAddressInput(e.target.value);
                  setAddressError(null);
                }}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleSimulate();
                  }
                }}
                bg="rgba(0, 0, 0, 0.5)"
                border={`2px solid ${addressError ? "rgba(178, 50, 50, 0.6)" : colors.borderGray}`}
                borderRadius="12px"
                color={colors.offWhite}
                fontFamily={FONT_FAMILIES.AUX_MONO}
                fontSize="14px"
                px="16px"
                h="48px"
                _placeholder={{ color: colors.textGray }}
                _focus={{
                  borderColor: addressError ? "rgba(178, 50, 50, 0.8)" : "rgba(86, 50, 168, 0.6)",
                  boxShadow: "none",
                }}
                flex="1"
              />
              <Button
                onClick={handleSimulate}
                bg="rgba(86, 50, 168, 0.15)"
                border={`2px solid rgba(86, 50, 168, 0.4)`}
                color={colors.offWhite}
                _hover={{ bg: "rgba(86, 50, 168, 0.25)" }}
                fontFamily={FONT_FAMILIES.NOSTROMO}
                fontSize={isMobile ? "14px" : "15px"}
                h="48px"
                px="32px"
                borderRadius="12px"
              >
                Simulate
              </Button>
            </Flex>

            {addressError && (
              <Text
                fontSize="13px"
                color="#E74C4C"
                fontFamily={FONT_FAMILIES.AUX_MONO}
                letterSpacing="-0.5px"
              >
                {addressError}
              </Text>
            )}

            {/* Currently Simulating Banner */}
            {simulatedAddress && (
              <Flex
                mt="12px"
                p="16px"
                bg="rgba(86, 50, 168, 0.15)"
                border={`2px solid rgba(86, 50, 168, 0.4)`}
                borderRadius="12px"
                direction="column"
                gap="8px"
              >
                <Flex justify="space-between" align="center">
                  <Text
                    fontSize="13px"
                    fontFamily={FONT_FAMILIES.AUX_MONO}
                    color="#a78bfa"
                    letterSpacing="-0.5px"
                  >
                    Currently simulating wallet:
                  </Text>
                  <Button
                    onClick={handleClearSimulation}
                    size="sm"
                    bg="rgba(178, 50, 50, 0.15)"
                    border={`1px solid rgba(178, 50, 50, 0.4)`}
                    color={colors.offWhite}
                    _hover={{ bg: "rgba(178, 50, 50, 0.25)" }}
                    fontFamily={FONT_FAMILIES.AUX_MONO}
                    fontSize="11px"
                    h="28px"
                  >
                    Clear
                  </Button>
                </Flex>
                <Text
                  fontSize={isMobile ? "12px" : "14px"}
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  color={colors.offWhite}
                  letterSpacing="-0.5px"
                  wordBreak="break-all"
                >
                  {simulatedAddress}
                </Text>
              </Flex>
            )}
          </Flex>

          {/* Swap History - only show when simulating */}
          {simulatedAddress && (
            <>
              <UserSwapHistory
                simulatedAddress={simulatedAddress}
                onInitialLoadComplete={handleInitialLoadComplete}
              />

              {/* Stats Overview at bottom - only show after initial spinner completes */}
              {showStats && (
                <Flex w="100%" maxW="1400px" mt={isMobile ? "10px" : "15px"} mb="40px">
                  <StatsOverview />
                </Flex>
              )}
            </>
          )}
        </Flex>
        {process.env.NEXT_PUBLIC_FAKE_OTC === "true" ||
        process.env.NEXT_PUBLIC_FAKE_RFQ === "true" ? null : (
          <TEEStatusFooter />
        )}
      </Flex>
    </>
  );
};

export default SimulatePage;
