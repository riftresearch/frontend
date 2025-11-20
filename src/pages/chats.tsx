import React, { useState, useEffect } from "react";
import { NextPage } from "next";
import { Flex, Box, Text, Button } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { OpenGraph } from "@/components/other/OpenGraph";
import { AdminChats } from "@/components/admin/AdminChats";
import { RiftLogo } from "@/components/other/RiftLogo";
import { FONT_FAMILIES } from "@/utils/font";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import {
  getAdminPasswordFromCookie,
  setAdminPasswordCookie,
  clearAdminPasswordCookie,
} from "@/utils/auth";
import { PasswordGate } from "@/components/admin/PasswordGate";
import { FiArrowLeft } from "react-icons/fi";

const ChatsPage: NextPage = () => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <>
        <OpenGraph
          title="RIFT - Admin Chats"
          description="Admin chat management for RIFT protocol"
          embed={{ image: "/images/PreviewArt.png" }}
        />
        <PasswordGate onAuthenticated={handleAuthenticated} />
      </>
    );
  }

  return (
    <>
      <OpenGraph
        title="RIFT - Admin Chats"
        description="Admin chat management for RIFT protocol"
        embed={{ image: "/images/PreviewArt.png" }}
      />

      <Flex minHeight="100vh" bg={"#000000"} justifyContent="center">
        <Flex width="100%" maxW="1400px" px="20px" py="30px" mt="15px" direction="column">
          {/* HEADER */}
          <Flex justify="space-between" align="center" mb="30px">
            <Flex align="center" gap="20px">
              <Button
                onClick={() => router.push("/admin")}
                bg="transparent"
                border={`2px solid ${colorsAnalytics.borderGray}`}
                color={colorsAnalytics.offWhite}
                _hover={{
                  opacity: 0.8,
                }}
                // @ts-ignore
                leftIcon={<FiArrowLeft />}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="14px"
                px="16px"
                py="6px"
                borderRadius="12px"
                h="auto"
              >
                Back
              </Button>
              <Box cursor="pointer" onClick={() => router.push("/admin")}>
                <RiftLogo width="110" height="28" fill={colorsAnalytics.offWhite} />
              </Box>
            </Flex>
            <Flex align="center" gap="24px">
              <Text
                fontSize="sm"
                color={colorsAnalytics.textGray}
                fontFamily={FONT_FAMILIES.SF_PRO}
              >
                Admin Chats &nbsp;|&nbsp;{" "}
                {new Date().toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </Text>
            </Flex>
          </Flex>

          {/* FEEDBACK CHATS */}
          <Flex direction="column">
            <Text
              ml="5px"
              color={colorsAnalytics.offWhite}
              fontFamily={FONT_FAMILIES.SF_PRO}
              fontWeight="bold"
              fontSize="35px"
              style={{ textShadow: "0 0 18px rgba(255,255,255,0.18)" }}
              mb="28px"
            >
              Feedback Chats
            </Text>
            <AdminChats />
          </Flex>

          {/* FOOTER */}
          <Flex justify="center" mt="60px" mb="60px">
            <RiftLogo width="80" height="20" fill={colorsAnalytics.textGray} />
          </Flex>
        </Flex>
      </Flex>
    </>
  );
};

export default ChatsPage;
