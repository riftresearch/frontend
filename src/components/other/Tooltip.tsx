import { Flex } from "@chakra-ui/react";
import { ReactNode } from "react";
import { InfoSVG } from "./SVGs";
import { colors } from "@/utils/colors";

interface TooltipProps {
  hoverText: ReactNode;
  body?: ReactNode;
  show?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  iconWidth?: string;
  width?: string;
}

export const Tooltip = ({
  hoverText,
  body,
  show = false,
  onMouseEnter,
  onMouseLeave,
  iconWidth = "14px",
  width = "200px",
}: TooltipProps) => {
  return (
    <Flex position="relative">
      <Flex
        cursor="pointer"
        userSelect="none"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {body || (
          <Flex mt="0px" mr="2px">
            <InfoSVG width={iconWidth} />
          </Flex>
        )}
      </Flex>
      {show && (
        <Flex
          position="absolute"
          bottom="100%"
          left="0"
          mb="8px"
          bg="#121212"
          color={colors.offWhite}
          fontSize="12px"
          fontFamily="Monospace"
          letterSpacing="-0.5px"
          padding="8px 12px"
          borderRadius="8px"
          border={`1px solid ${colors.borderGray}`}
          zIndex={1000}
          flexDirection="column"
          gap="4px"
          width={width}
          whiteSpace="normal"
          boxShadow="0 4px 12px rgba(0, 0, 0, 0.4)"
        >
          {hoverText}
        </Flex>
      )}
    </Flex>
  );
};
