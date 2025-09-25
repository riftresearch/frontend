import React, { useState } from "react";
import { Box, Input, Button, Text, Flex, VStack } from "@chakra-ui/react";
import { FONT_FAMILIES } from "@/utils/font";
import { colors } from "@/utils/colors";
import { verifyAdminPassword } from "@/utils/auth";

interface PasswordGateProps {
  onAuthenticated: () => void;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({
  onAuthenticated,
}) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Small delay to prevent timing attacks
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (verifyAdminPassword(password)) {
      onAuthenticated();
    } else {
      setError("Invalid password");
      setPassword("");
    }

    setIsLoading(false);
  };

  return (
    <Flex
      minHeight="100vh"
      align="center"
      justify="center"
      bg={colors.offBlack}
      px={4}
    >
      <Box
        bg={colors.offBlackLighter}
        p={8}
        borderRadius="lg"
        borderWidth={2}
        borderColor={colors.borderGray}
        boxShadow="xl"
        maxWidth="400px"
        width="100%"
      >
        <VStack spacing={6}>
          <Text
            fontSize="2xl"
            fontWeight="bold"
            color={colors.offWhite}
            fontFamily={FONT_FAMILIES.NOSTROMO}
          >
            Admin Access
          </Text>

          <Text
            fontSize="sm"
            color={colors.textGray}
            textAlign="center"
            fontFamily={FONT_FAMILIES.AUX_MONO}
          >
            Enter the admin password to continue
          </Text>

          <Box as="form" onSubmit={handleSubmit} width="100%">
            <VStack spacing={4}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                bg={colors.offBlack}
                border="2px solid"
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

              {error && (
                <Box
                  p={3}
                  bg={colors.red + "20"}
                  border="1px solid"
                  borderColor={colors.red}
                  borderRadius="md"
                  width="100%"
                >
                  <Text
                    color={colors.red}
                    fontSize="sm"
                    fontFamily={FONT_FAMILIES.AUX_MONO}
                    textAlign="center"
                  >
                    {error}
                  </Text>
                </Box>
              )}

              <Button
                type="submit"
                isLoading={isLoading}
                loadingText="Verifying..."
                bg={colors.purpleBackground}
                borderWidth="2px"
                borderColor={colors.purpleBorder}
                color={colors.offWhite}
                fontFamily={FONT_FAMILIES.NOSTROMO}
                _hover={{ bg: colors.purpleHover }}
                _active={{ bg: colors.purpleHover }}
                size="lg"
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
