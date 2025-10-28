import { Flex, Text } from "@chakra-ui/react";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";

export const MaintenanceBanner = () => {
  return (
    <Flex
      position="fixed"
      bottom="0"
      left="0"
      right="0"
      bg="rgba(255, 100, 0, 0.95)"
      backdropFilter="blur(10px)"
      borderTop="2px solid"
      borderColor="#FF8C00"
      py="12px"
      px="20px"
      zIndex="1000"
      align="center"
      justify="center"
    >
      <Flex align="center" gap="12px">
        <Flex
          w="8px"
          h="8px"
          borderRadius="50%"
          bg="#FFF"
          animation="pulse 2s ease-in-out infinite"
          // @ts-ignore
          sx={{
            "@keyframes pulse": {
              "0%, 100%": {
                opacity: 1,
              },
              "50%": {
                opacity: 0.4,
              },
            },
          }}
        />
        <Text
          color="#FFF"
          fontSize="14px"
          fontWeight="bold"
          fontFamily={FONT_FAMILIES.NOSTROMO}
          letterSpacing="0.5px"
        >
          Rift is down for maintenance
        </Text>
      </Flex>
    </Flex>
  );
};
