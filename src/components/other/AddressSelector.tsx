import React, { useState, useRef, useEffect } from "react";
import { Flex, Text, Box, Image, Portal } from "@chakra-ui/react";
import { useDynamicContext, useUserWallets, useDynamicModals } from "@dynamic-labs/sdk-react-core";
import { FiChevronDown, FiPlus, FiEdit3 } from "react-icons/fi";
import { colors } from "@/utils/colors";

// Dynamic's icon sprite URL
const DYNAMIC_ICON_BASE = "https://iconic.dynamic-static-assets.com/icons/sprite.svg";

interface AddressSelectorProps {
  chainType: "EVM" | "BTC";
  selectedAddress: string | null;
  onSelect: (address: string) => void;
  onPasteAddress?: () => void;
  showPasteOption?: boolean;
}

export const AddressSelector: React.FC<AddressSelectorProps> = ({
  chainType,
  selectedAddress,
  onSelect,
  onPasteAddress,
  showPasteOption = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  const { setShowAuthFlow } = useDynamicContext();
  const { setShowLinkNewWalletModal } = useDynamicModals();
  const userWallets = useUserWallets();

  // Filter wallets by chain type
  const filteredWallets = userWallets.filter((wallet) => {
    const walletChain = wallet.chain?.toUpperCase();
    if (chainType === "EVM") {
      return walletChain === "EVM";
    } else {
      return walletChain === "BTC" || walletChain === "BITCOIN";
    }
  });

  // Get wallet icon key for Dynamic sprite
  const getWalletIconKey = (wallet: any): string => {
    return wallet.connector?.name?.toLowerCase() || wallet.key?.toLowerCase() || "walletconnect";
  };

  // Format address for display
  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Find the selected wallet
  const selectedWallet = filteredWallets.find((w) => w.address === selectedAddress);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Auto-select first wallet if none selected
  useEffect(() => {
    if (!selectedAddress && filteredWallets.length > 0) {
      onSelect(filteredWallets[0].address);
    }
  }, [filteredWallets, selectedAddress, onSelect]);

  const handleConnectNewWallet = () => {
    setIsOpen(false);
    if (userWallets.length > 0) {
      // Already has wallets, use link modal
      setShowLinkNewWalletModal(true);
    } else {
      // No wallets, use auth flow
      setShowAuthFlow(true);
    }
  };

  const handlePasteAddress = () => {
    setIsOpen(false);
    onPasteAddress?.();
  };

  const handleSelectWallet = (address: string) => {
    onSelect(address);
    setIsOpen(false);
  };

  // Get button position for dropdown
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 220),
      });
    }
  }, [isOpen]);

  // Determine what to show in the button
  const hasWallets = filteredWallets.length > 0;
  const isPastedAddress = selectedAddress && !selectedWallet;

  return (
    <Box position="relative">
      {/* Selector - text only with icon and caret */}
      <Flex
        ref={buttonRef}
        align="center"
        gap="5px"
        cursor="pointer"
        transition="opacity 0.15s ease"
        _hover={{ opacity: 0.8 }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedWallet ? (
          <>
            <Image
              src={`${DYNAMIC_ICON_BASE}#${getWalletIconKey(selectedWallet)}`}
              alt="wallet"
              w="16px"
              h="16px"
              borderRadius="3px"
            />
            <Text
              color={chainType === "EVM" ? "#788CFF" : "#F7AA50"}
              fontSize="14px"
              fontWeight="500"
              fontFamily="Aux"
              letterSpacing="-1px"
            >
              {formatAddress(selectedWallet.address)}
            </Text>
          </>
        ) : isPastedAddress ? (
          <>
            <FiEdit3 size={12} color={chainType === "EVM" ? "#788CFF" : "#F7AA50"} />
            <Text
              color={chainType === "EVM" ? "#788CFF" : "#F7AA50"}
              fontSize="14px"
              fontWeight="500"
              fontFamily="Aux"
              letterSpacing="-1px"
            >
              {formatAddress(selectedAddress!)}
            </Text>
          </>
        ) : (
          <Text
            color={colors.textGray}
            fontSize="14px"
            fontWeight="500"
            fontFamily="Aux"
            letterSpacing="-1px"
          >
            Select address
          </Text>
        )}
        <Box flexShrink={0}>
          <FiChevronDown
            size={12}
            color={chainType === "EVM" ? "#788CFF" : "#F7AA50"}
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}
          />
        </Box>
      </Flex>

      {/* Dropdown */}
      {isOpen && (
        <Portal>
          <Box
            ref={dropdownRef}
            position="fixed"
            top={`${dropdownPosition.top}px`}
            left={`${dropdownPosition.left}px`}
            minW={`${dropdownPosition.width}px`}
            bg="#1a1a1a"
            borderRadius="12px"
            border="1px solid #333"
            py="6px"
            zIndex={2000}
            boxShadow="0 8px 32px rgba(0,0,0,0.4)"
          >
            {/* Connected Wallets */}
            {filteredWallets.map((wallet) => (
              <Flex
                key={wallet.id}
                align="center"
                gap="10px"
                px="12px"
                py="10px"
                cursor="pointer"
                bg={selectedAddress === wallet.address ? "#252525" : "transparent"}
                _hover={{ bg: "#252525" }}
                onClick={() => handleSelectWallet(wallet.address)}
              >
                <Image
                  src={`${DYNAMIC_ICON_BASE}#${getWalletIconKey(wallet)}`}
                  alt="wallet"
                  w="22px"
                  h="22px"
                  borderRadius="6px"
                />
                <Text color={colors.offWhite} fontSize="14px" fontWeight="500" fontFamily="Inter">
                  {formatAddress(wallet.address)}
                </Text>
              </Flex>
            ))}

            {/* Divider if there are wallets */}
            {hasWallets && <Box h="1px" bg="#333" my="6px" mx="8px" />}

            {/* Connect new wallet option */}
            <Flex
              align="center"
              gap="10px"
              px="12px"
              py="10px"
              cursor="pointer"
              _hover={{ bg: "#252525" }}
              onClick={handleConnectNewWallet}
            >
              <Flex
                w="22px"
                h="22px"
                borderRadius="6px"
                bg="#2a2a2a"
                align="center"
                justify="center"
              >
                <FiPlus size={14} color={colors.textGray} />
              </Flex>
              <Text color={colors.textGray} fontSize="14px" fontWeight="500" fontFamily="Inter">
                Connect a new wallet
              </Text>
            </Flex>

            {/* Paste address option */}
            {showPasteOption && (
              <Flex
                align="center"
                gap="10px"
                px="12px"
                py="10px"
                cursor="pointer"
                _hover={{ bg: "#252525" }}
                onClick={handlePasteAddress}
              >
                <Flex
                  w="22px"
                  h="22px"
                  borderRadius="6px"
                  bg="#2a2a2a"
                  align="center"
                  justify="center"
                >
                  <FiEdit3 size={14} color={colors.textGray} />
                </Flex>
                <Text color={colors.textGray} fontSize="14px" fontWeight="500" fontFamily="Inter">
                  Paste wallet address
                </Text>
              </Flex>
            )}
          </Box>
        </Portal>
      )}
    </Box>
  );
};

