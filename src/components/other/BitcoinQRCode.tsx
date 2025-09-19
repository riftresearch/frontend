import React from "react";
import { Flex, Text, Box } from "@chakra-ui/react";
import { QRCodeSVG } from "qrcode.react";
import { LuCopy } from "react-icons/lu";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import WebAssetTag from "./WebAssetTag";

interface BitcoinQRCodeProps {
  bitcoinUri: string;
  address: string;
  amount: number;
}

export const BitcoinQRCode: React.FC<BitcoinQRCodeProps> = ({
  bitcoinUri,
  address,
  amount,
}) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Flex mt="10px" mx="10px" gap="40px" align="start">
      {/* QR Code */}
      <Flex
        py="10px"
        px="10px"
        w="270px"
        borderRadius="10px"
        bg="white"
        boxShadow="0px 15px 15px rgba(0, 16, 118, 0.4)"
        justify="center"
        align="center"
      >
        <QRCodeSVG value={bitcoinUri} size={250} />
      </Flex>

      {/* Address and Amount Details */}
      <Flex direction="column" flex="1">
        {/* Bitcoin Address Section */}
        <Text
          mt="8px"
          fontSize="16px"
          color={colors.textGray}
          fontFamily={FONT_FAMILIES.NOSTROMO}
        >
          Bitcoin Address:
        </Text>
        <Flex direction="column" alignItems="flex-start" maxW="400px">
          <Text
            mt="6px"
            fontSize="25px"
            display="inline-flex"
            letterSpacing="-1px"
            color={colors.offWhite}
            fontFamily={FONT_FAMILIES.AUX_MONO}
            whiteSpace="nowrap"
            overflow="hidden"
            textOverflow="ellipsis"
          >
            {address.slice(0, Math.floor((2 / 3) * address.length))}
          </Text>
          <Flex alignItems="center">
            <Text
              letterSpacing="-1px"
              fontSize="25px"
              display="inline-flex"
              color={colors.offWhite}
              fontFamily={FONT_FAMILIES.AUX_MONO}
            >
              {address.slice(Math.floor((2 / 3) * address.length))}
            </Text>
            <LuCopy
              color="gray"
              size={20}
              style={{
                cursor: "pointer",
                marginLeft: "10px",
              }}
              onClick={() => copyToClipboard(address)}
            />
          </Flex>
        </Flex>

        {/* Amount Section */}
        <Text
          mt="25px"
          fontSize="16px"
          mb="-18px"
          color={colors.textGray}
          fontFamily={FONT_FAMILIES.NOSTROMO}
        >
          Deposit Amount:
        </Text>
        <Flex alignItems="center">
          <Text
            letterSpacing="-1px"
            mt="2px"
            fontSize="25px"
            width="500px"
            color={colors.offWhite}
            fontFamily={FONT_FAMILIES.AUX_MONO}
            display="inline-flex"
            flexDirection="row"
            alignItems="center"
          >
            {amount.toFixed(8)}
            <LuCopy
              color="gray"
              size={20}
              style={{
                cursor: "pointer",
                marginLeft: "10px",
              }}
              onClick={() => copyToClipboard(amount.toFixed(8))}
            />
            <Flex ml="20px" mt="-1px">
              <WebAssetTag asset="BTC" />
            </Flex>
          </Text>
        </Flex>
      </Flex>
    </Flex>
  );
};
