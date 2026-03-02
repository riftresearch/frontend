import React, { useState, useRef, useEffect, useMemo } from "react";
import { Flex, Text, Box, Image, Portal } from "@chakra-ui/react";
import { useDynamicContext, useUserWallets, useDynamicModals } from "@dynamic-labs/sdk-react-core";
import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { FiChevronDown, FiPlus, FiEdit3 } from "react-icons/fi";
import { colors } from "@/utils/colors";
import { getPaymentAddress, getAllBtcAddressesWithInfo, type BtcAddressInfo } from "@/hooks/useBitcoinTransaction";

// Dynamic's icon sprite URL
const DYNAMIC_ICON_BASE = "https://iconic.dynamic-static-assets.com/icons/sprite.svg";

interface AddressSelectorProps {
  chainType: "EVM" | "BTC";
  selectedAddress: string | null;
  onSelect: (address: string | null) => void;
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

  // Entry type for wallet addresses (BTC wallets expand to multiple entries)
  interface WalletAddressEntry {
    wallet: any;
    address: string;
    addressLabel?: string; // For BTC: "Taproot", "Native Segwit", etc.
  }

  // Map wallets with their addresses (BTC wallets expand to multiple entries - one per address type)
  const walletsWithAddresses: WalletAddressEntry[] = useMemo(() => {
    const result: WalletAddressEntry[] = [];
    
    for (const wallet of filteredWallets) {
      if (chainType === "BTC" && isBitcoinWallet(wallet)) {
        // Expand BTC wallet into multiple entries (Taproot, Native Segwit, etc.)
        const addressInfos = getAllBtcAddressesWithInfo(wallet);
        for (const info of addressInfos) {
          result.push({
            wallet,
            address: info.address,
            addressLabel: info.label,
          });
        }
      } else {
        // EVM wallets - single entry
        result.push({
          wallet,
          address: wallet.address,
        });
      }
    }
    
    return result;
  }, [filteredWallets, chainType]);

  // Get wallet icon key for Dynamic sprite
  const getWalletIconKey = (wallet: any): string => {
    return wallet.connector?.name?.toLowerCase() || wallet.key?.toLowerCase() || "walletconnect";
  };

  // Format address for display
  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Find the selected wallet (checking by correct address type)
  const selectedWalletData = walletsWithAddresses.find((w) => w.address === selectedAddress);
  const selectedWallet = selectedWalletData?.wallet;

  // Determine if this is a pasted address (not from a connected wallet)
  const isPastedAddress = selectedAddress && !selectedWalletData;

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

  // Track previous wallet count to detect disconnections
  const prevWalletCountRef = useRef(filteredWallets.length);
  const prevSelectedAddressRef = useRef(selectedAddress);

  // Track if this address was manually pasted (vs from connected wallet)
  const wasPastedRef = useRef(false);

  // Handle wallet selection and disconnection
  useEffect(() => {
    const walletsDecreased = filteredWallets.length < prevWalletCountRef.current;
    const addressChanged = selectedAddress !== prevSelectedAddressRef.current;

    // Update refs
    prevWalletCountRef.current = filteredWallets.length;
    prevSelectedAddressRef.current = selectedAddress;

    // Track if new address was pasted (address changed but not to a connected wallet)
    if (addressChanged && selectedAddress) {
      const isFromWallet = walletsWithAddresses.some((w) => w.address === selectedAddress);
      wasPastedRef.current = !isFromWallet;
    } else if (!selectedAddress) {
      wasPastedRef.current = false;
    }

    // If address was just changed externally, don't interfere
    if (addressChanged) return;

    // Auto-select first wallet if none selected and wallets available
    if (!selectedAddress && walletsWithAddresses.length > 0) {
      onSelect(walletsWithAddresses[0].address);
      return;
    }

    // Handle disconnection - only if wallets decreased and address is not manually pasted
    if (walletsDecreased && selectedAddress && !wasPastedRef.current) {
      const stillConnected = walletsWithAddresses.some((w) => w.address === selectedAddress);
      if (!stillConnected) {
        // Wallet was disconnected - select first available or clear
        if (walletsWithAddresses.length > 0) {
          onSelect(walletsWithAddresses[0].address);
        } else {
          onSelect(null);
        }
      }
    }
  }, [filteredWallets.length, selectedAddress, onSelect, walletsWithAddresses]);

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
        {selectedWalletData ? (
          <>
            {selectedWalletData.addressLabel && (
              <Text
                color={chainType === "EVM" ? "#788CFF" : "#F7AA50"}
                fontSize="13px"
                fontWeight="500"
                fontFamily="Aux"
                letterSpacing="-0.5px"
                whiteSpace="nowrap"
              >
                {selectedWalletData.addressLabel}
              </Text>
            )}
            <Image
              src={`${DYNAMIC_ICON_BASE}#${getWalletIconKey(selectedWallet)}`}
              alt="wallet"
              w="14px"
              h="14px"
              borderRadius="3px"
              flexShrink={0}
            />
            <Text
              color={chainType === "EVM" ? "#788CFF" : "#F7AA50"}
              fontSize="13px"
              fontWeight="500"
              fontFamily="Aux"
              letterSpacing="-0.5px"
              whiteSpace="nowrap"
            >
              {formatAddress(selectedWalletData.address)}
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
              whiteSpace="nowrap"
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
            whiteSpace="nowrap"
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
            overflow="hidden"
            border="1px solid #333"
            py="0px"
            zIndex={2000}
            boxShadow="0 8px 32px rgba(0,0,0,0.4)"
          >
            {/* Connected Wallets - BTC wallets show each address type separately */}
            {walletsWithAddresses.map(({ wallet, address, addressLabel }, index) => (
              <Flex
                key={`${wallet.id}-${address}`}
                align="center"
                gap="10px"
                px="12px"
                py="10px"
                cursor="pointer"
                bg={selectedAddress === address ? "#252525" : "transparent"}
                _hover={{ bg: "#252525" }}
                onClick={() => handleSelectWallet(address)}
              >
                <Image
                  src={`${DYNAMIC_ICON_BASE}#${getWalletIconKey(wallet)}`}
                  alt="wallet"
                  w="22px"
                  h="22px"
                  borderRadius="6px"
                />
                <Flex direction="column" gap="2px">
                  <Text color={colors.offWhite} fontSize="14px" fontWeight="500" fontFamily="Inter">
                    {formatAddress(address)}
                  </Text>
                  {addressLabel && (
                    <Text color={colors.textGray} fontSize="11px" fontFamily="Inter">
                      {addressLabel}
                    </Text>
                  )}
                </Flex>
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
