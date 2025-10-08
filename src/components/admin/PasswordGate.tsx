import React, { useState } from "react";
import { Box, Input, Button, Text, Flex, VStack } from "@chakra-ui/react";
import { FONT_FAMILIES } from "@/utils/font";
import { colors } from "@/utils/colors";
import { verifyAdminPassword } from "@/utils/auth";
import { toastError } from "@/utils/toast";

interface PasswordGateProps {
  onAuthenticated: (password: string) => void;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({
  onAuthenticated,
}) => {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await verifyAdminPassword(password);

    if (result.success) {
      onAuthenticated(password);
    } else {
      // Show appropriate error toast based on error type
      if (result.error === "NETWORK_ERROR") {
        toastError(null, {
          title: "Analytics Server Down",
          description:
            "Could not connect to the analytics server. Please try again later.",
        });
      } else if (result.error === "SERVER_ERROR") {
        toastError(null, {
          title: "Analytics Server Error",
          description:
            result.message ||
            "Server endpoint not found. Please contact support.",
        });
      } else {
        toastError(null, {
          title: "Invalid Password",
          description: "Please check your password and try again.",
        });
      }
      setPassword("");
    }

    setIsLoading(false);
  };

  return (
    <Flex
      minHeight="100vh"
      align="center"
      justify="center"
      bg={"#000000"}
      px={4}
    >
      <Box
        bg={"#151515"}
        p={8}
        borderRadius="20px"
        borderWidth={2}
        borderColor={colors.borderGray}
        boxShadow="xl"
        maxWidth="450px"
        width="100%"
      >
        <VStack gap={6}>
          <Text
            fontSize="2xl"
            fontWeight="bold"
            color={colors.offWhite}
            fontFamily={FONT_FAMILIES.NOSTROMO}
          >
            Admin Access
          </Text>

          <Text
            fontSize="14px"
            mt="-7px"
            color={colors.textGray}
            textAlign="center"
            fontFamily={FONT_FAMILIES.AUX_MONO}
          >
            Enter your admin password to continue
          </Text>

          <Box as="form" onSubmit={handleSubmit} width="100%">
            <VStack gap={4}>
              <Input
                pl="13px"
                height="50px"
                type="password"
                mb="8px"
                borderRadius="10px"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                bg={colors.offBlack}
                border="2px solid"
                fontSize="16px"
                borderColor={colors.borderGray}
                color={colors.offWhite}
                fontFamily={FONT_FAMILIES.AUX_MONO}
                _hover={{ borderColor: colors.borderGrayLight }}
                _focus={{
                  borderColor: colors.purpleBorder,
                  boxShadow: `0 0 0 1px ${colors.purpleBorder}`,
                }}
                size="lg"
              />

              <Button
                type="submit"
                // @ts-ignore
                isLoading={isLoading}
                loadingText="Verifying..."
                bg={colors.currencyCard.btc.background}
                borderWidth="2px"
                borderColor={colors.RiftOrange}
                color={colors.offWhite}
                fontFamily={FONT_FAMILIES.NOSTROMO}
                _hover={{ bg: colors.purpleHover }}
                _active={{ bg: colors.purpleHover }}
                size="lg"
                height="50px"
                borderRadius="10px"
                width="100%"
                isDisabled={!password.trim()}
              >
                Access Admin Panel
              </Button>
            </VStack>
          </Box>
        </VStack>
      </Box>
    </Flex>
  );
};
