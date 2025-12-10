import React, { useState, useEffect, useRef } from "react";
import { Box, Button, Flex, Text, Input, Spinner } from "@chakra-ui/react";
import { IoSend } from "react-icons/io5";
import { FiCopy, FiCheck, FiExternalLink, FiArrowLeft, FiList } from "react-icons/fi";
import { FONT_FAMILIES } from "@/utils/font";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { GridFlex } from "@/components/other/GridFlex";
import {
  listAllChats,
  getThreadAsAdmin,
  appendMessageAsAdmin,
  ChatThread,
} from "@/utils/chatClient";
import { toastError, toastSuccess } from "@/utils/toast";
import { getAdminPasswordFromCookie } from "@/utils/auth";
import { AdminSwapItem, AdminSwapFlowStep } from "@/utils/types";
import { mapDbRowToAdminSwap, ANALYTICS_API_URL } from "@/utils/analyticsClient";
import { AssetIcon } from "@/components/other/AssetIcon";
import useWindowSize from "@/hooks/useWindowSize";

export const AdminChats: React.FC = () => {
  const { isMobile } = useWindowSize();
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [userSwaps, setUserSwaps] = useState<AdminSwapItem[]>([]);
  const [loadingSwaps, setLoadingSwaps] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat" | "swaps">("list");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom only when shouldAutoScroll is true (e.g., after sending a message)
  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setShouldAutoScroll(false);
    }
  }, [selectedThread?.messages, shouldAutoScroll]);

  // Load all chats on mount
  useEffect(() => {
    loadAllChats();
  }, []);

  // Set up polling for new messages (refresh list and current thread)
  useEffect(() => {
    // Poll every 10 seconds
    pollingIntervalRef.current = setInterval(() => {
      loadAllChats();

      // If a thread is open, reload it to show new messages
      if (selectedChatId) {
        loadThread(selectedChatId);
      }
    }, 10000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [selectedChatId]);

  const loadAllChats = async () => {
    setIsLoading(true);
    try {
      const adminPassword = getAdminPasswordFromCookie();
      console.log("[ADMIN CHATS] Admin password exists:", !!adminPassword);
      console.log("[ADMIN CHATS] Admin password length:", adminPassword?.length || 0);
      console.log(
        "[ADMIN CHATS] Admin password (first 4 chars):",
        adminPassword?.slice(0, 4) || "N/A"
      );

      if (!adminPassword) {
        throw new Error("Not authenticated as admin");
      }

      const allChats = await listAllChats(adminPassword);
      console.log("[ADMIN CHATS] Loaded all chats:", allChats);

      // Filter out chats with no messages
      const chatsWithMessages = allChats.filter(
        (chat) => chat.messages && chat.messages.length > 0
      );
      console.log(
        "[ADMIN CHATS] Chats with messages:",
        chatsWithMessages.length,
        "of",
        allChats.length
      );

      setChats(chatsWithMessages);
    } catch (error) {
      console.error("Error loading admin chats:", error);
      toastError(error, {
        title: "Error Loading Chats",
        description: "Unable to load chat list",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadThread = async (chatId: string, shouldScroll: boolean = false) => {
    try {
      const adminPassword = getAdminPasswordFromCookie();
      if (!adminPassword) {
        throw new Error("Not authenticated as admin");
      }

      const thread = await getThreadAsAdmin(chatId, adminPassword);
      console.log("[ADMIN CHATS] Loaded thread:", thread);
      setSelectedThread(thread);
      setSelectedChatId(chatId);

      // On mobile, switch to chat view when opening a thread
      if (isMobile) {
        setMobileView("chat");
      }

      // Only scroll if this is a new thread being opened or after sending a message
      if (shouldScroll) {
        setShouldAutoScroll(true);
      }

      // Load swap history for this user
      if (thread.user_eth_address) {
        loadUserSwaps(thread.user_eth_address);
      }
    } catch (error) {
      console.error("Error loading thread:", error);
      toastError(error, {
        title: "Error Loading Thread",
        description: "Unable to load chat messages",
      });
    }
  };

  const loadUserSwaps = async (address: string) => {
    setLoadingSwaps(true);
    try {
      const url = `${ANALYTICS_API_URL}/api/swaps?account=${address}&limit=20&offset=0`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error("Failed to fetch user swaps:", response.status);
        setUserSwaps([]);
        return;
      }

      const data = await response.json();
      if (!data.swaps || !Array.isArray(data.swaps)) {
        setUserSwaps([]);
        return;
      }

      const swaps = data.swaps.map((row: any) => mapDbRowToAdminSwap(row));
      setUserSwaps(swaps);
    } catch (error) {
      console.error("Error loading user swaps:", error);
      setUserSwaps([]);
    } finally {
      setLoadingSwaps(false);
    }
  };

  const copyAddress = () => {
    if (selectedThread?.user_eth_address) {
      navigator.clipboard.writeText(selectedThread.user_eth_address);
      setCopiedAddress(true);
      toastSuccess({
        title: "Copied",
        description: "ETH address copied to clipboard",
      });
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedChatId || !selectedThread || isSending) return;

    setIsSending(true);
    try {
      const adminPassword = getAdminPasswordFromCookie();
      if (!adminPassword) {
        throw new Error("Not authenticated as admin");
      }

      await appendMessageAsAdmin(
        selectedChatId,
        selectedThread.user_eth_address,
        messageInput.trim(),
        adminPassword
      );

      // Reload the thread to get updated messages and scroll to bottom
      await loadThread(selectedChatId, true);
      setMessageInput("");

      toastSuccess({
        title: "Message Sent",
        description: "Your message has been sent",
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toastError(error, {
        title: "Error Sending Message",
        description: "Unable to send your message",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // List view - no chat selected
  if (!selectedChatId) {
    return (
      <GridFlex width="100%" heightBlocks={20} contentPadding="0">
        <Flex direction="column" w="100%" h="100%">
          {/* Header */}
          <Flex
            px="24px"
            py="20px"
            borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
            bg="rgba(0, 0, 0, 0.3)"
          >
            <Text
              fontFamily={FONT_FAMILIES.NOSTROMO}
              fontSize="18px"
              color={colorsAnalytics.offWhite}
              letterSpacing="0.5px"
            >
              FEEDBACK CHATS
            </Text>
          </Flex>

          {/* Chat List */}
          <Box
            flex="1"
            overflowY="auto"
            css={{
              "&::-webkit-scrollbar": {
                width: "8px",
              },
              "&::-webkit-scrollbar-track": {
                background: "transparent",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "#333",
                borderRadius: "4px",
              },
              "&::-webkit-scrollbar-thumb:hover": {
                background: "#444",
              },
            }}
          >
            {isLoading ? (
              <Flex justify="center" align="center" py="40px">
                <Spinner size="lg" color={colorsAnalytics.offWhite} />
              </Flex>
            ) : chats.length === 0 ? (
              <Flex justify="center" align="center" py="40px">
                <Text
                  fontFamily={FONT_FAMILIES.SF_PRO}
                  fontSize="14px"
                  color={colorsAnalytics.textGray}
                >
                  No chats yet
                </Text>
              </Flex>
            ) : (
              <Flex direction="column">
                {chats.map((chat) => (
                  <Flex
                    key={chat.id}
                    p="20px"
                    borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
                    cursor="pointer"
                    _hover={{ bg: "rgba(255, 255, 255, 0.03)" }}
                    transition="background 0.15s"
                    onClick={() => loadThread(chat.id, true)}
                    direction="column"
                    gap="8px"
                  >
                    <Flex justify="space-between" align="center">
                      <Text
                        fontFamily={FONT_FAMILIES.SF_PRO}
                        fontSize="13px"
                        color={colorsAnalytics.offWhite}
                        fontWeight="600"
                      >
                        {chat.user_eth_address.slice(0, 6)}...{chat.user_eth_address.slice(-4)}
                      </Text>
                      <Text
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        fontSize="11px"
                        color={colorsAnalytics.textGray}
                      >
                        {new Date(chat.last_message_at).toLocaleString()}
                      </Text>
                    </Flex>
                    {chat.messages && chat.messages.length > 0 && (
                      <Text
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        fontSize="12px"
                        color={colorsAnalytics.textGray}
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                      >
                        {chat.messages[chat.messages.length - 1].message}
                      </Text>
                    )}
                  </Flex>
                ))}
              </Flex>
            )}
          </Box>
        </Flex>
      </GridFlex>
    );
  }

  // Chat view - chat selected
  return (
    <GridFlex width="100%" heightBlocks={20} contentPadding="0">
      <Flex direction="row" w="100%" h="100%" overflow="hidden">
        {/* Mobile: Show only one panel at a time */}
        {isMobile ? (
          <>
            {/* Mobile: Chat List */}
            {mobileView === "list" && (
              <Flex direction="column" w="100%" h="100%">
                <Flex
                  px="24px"
                  py="20px"
                  borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
                  bg="rgba(0, 0, 0, 0.3)"
                >
                  <Text
                    fontFamily={FONT_FAMILIES.NOSTROMO}
                    fontSize="18px"
                    color={colorsAnalytics.offWhite}
                    letterSpacing="0.5px"
                  >
                    FEEDBACK CHATS
                  </Text>
                </Flex>
                <Box
                  flex="1"
                  overflowY="auto"
                  css={{
                    "&::-webkit-scrollbar": {
                      width: "8px",
                    },
                    "&::-webkit-scrollbar-track": {
                      background: "transparent",
                    },
                    "&::-webkit-scrollbar-thumb": {
                      background: "#333",
                      borderRadius: "4px",
                    },
                  }}
                >
                  {isLoading ? (
                    <Flex justify="center" align="center" py="40px">
                      <Spinner size="lg" color={colorsAnalytics.offWhite} />
                    </Flex>
                  ) : chats.length === 0 ? (
                    <Flex justify="center" align="center" py="40px">
                      <Text
                        fontFamily={FONT_FAMILIES.SF_PRO}
                        fontSize="14px"
                        color={colorsAnalytics.textGray}
                      >
                        No chats yet
                      </Text>
                    </Flex>
                  ) : (
                    <Flex direction="column">
                      {chats.map((chat) => (
                        <Flex
                          key={chat.id}
                          p="20px"
                          borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
                          cursor="pointer"
                          _hover={{ bg: "rgba(255, 255, 255, 0.03)" }}
                          transition="background 0.15s"
                          onClick={() => loadThread(chat.id, true)}
                          direction="column"
                          gap="8px"
                        >
                          <Flex justify="space-between" align="center">
                            <Text
                              fontFamily={FONT_FAMILIES.SF_PRO}
                              fontSize="13px"
                              color={colorsAnalytics.offWhite}
                              fontWeight="600"
                            >
                              {chat.user_eth_address.slice(0, 6)}...
                              {chat.user_eth_address.slice(-4)}
                            </Text>
                            <Text
                              fontFamily={FONT_FAMILIES.AUX_MONO}
                              fontSize="11px"
                              color={colorsAnalytics.textGray}
                            >
                              {new Date(chat.last_message_at).toLocaleString()}
                            </Text>
                          </Flex>
                          {chat.messages && chat.messages.length > 0 && (
                            <Text
                              fontFamily={FONT_FAMILIES.AUX_MONO}
                              fontSize="12px"
                              color={colorsAnalytics.textGray}
                              overflow="hidden"
                              textOverflow="ellipsis"
                              whiteSpace="nowrap"
                            >
                              {chat.messages[chat.messages.length - 1].message}
                            </Text>
                          )}
                        </Flex>
                      ))}
                    </Flex>
                  )}
                </Box>
              </Flex>
            )}

            {/* Mobile: Chat Messages */}
            {mobileView === "chat" && selectedThread && (
              <Flex direction="column" w="100%" h="100%">
                {/* Mobile Header with Back and Swap History buttons */}
                <Flex
                  px="16px"
                  py="16px"
                  borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
                  bg="rgba(0, 0, 0, 0.3)"
                  justify="space-between"
                  align="center"
                >
                  <Flex gap="8px">
                    <Button
                      size="sm"
                      onClick={() => {
                        setMobileView("list");
                        setSelectedChatId(null);
                        setSelectedThread(null);
                      }}
                      bg="transparent"
                      border={`1px solid ${colorsAnalytics.borderGray}`}
                      color={colorsAnalytics.offWhite}
                      _hover={{
                        borderColor: colorsAnalytics.greenOutline,
                        bg: "rgba(255, 255, 255, 0.03)",
                      }}
                      minW="auto"
                      h="32px"
                      px="12px"
                      fontSize="12px"
                      fontFamily={FONT_FAMILIES.SF_PRO}
                    >
                      <Flex align="center" gap="6px">
                        <FiArrowLeft size={14} />
                        <Text>Back</Text>
                      </Flex>
                    </Button>
                  </Flex>

                  <Flex align="center" gap="8px">
                    <Text
                      fontFamily={FONT_FAMILIES.NOSTROMO}
                      fontSize="14px"
                      color={colorsAnalytics.offWhite}
                      letterSpacing="0.5px"
                    >
                      {selectedThread.user_eth_address.slice(0, 6)}...
                      {selectedThread.user_eth_address.slice(-4)}
                    </Text>
                    <Button
                      size="sm"
                      onClick={copyAddress}
                      bg="transparent"
                      border={`1px solid ${colorsAnalytics.borderGray}`}
                      color={colorsAnalytics.offWhite}
                      _hover={{
                        borderColor: colorsAnalytics.greenOutline,
                        bg: "rgba(255, 255, 255, 0.03)",
                      }}
                      minW="auto"
                      h="28px"
                      px="8px"
                    >
                      {copiedAddress ? <FiCheck size={12} /> : <FiCopy size={12} />}
                    </Button>
                  </Flex>

                  <Button
                    size="sm"
                    onClick={() => setMobileView("swaps")}
                    bg="transparent"
                    border={`1px solid ${colorsAnalytics.borderGray}`}
                    color={colorsAnalytics.offWhite}
                    _hover={{
                      borderColor: colorsAnalytics.greenOutline,
                      bg: "rgba(255, 255, 255, 0.03)",
                    }}
                    minW="auto"
                    h="32px"
                    px="12px"
                    fontSize="12px"
                    fontFamily={FONT_FAMILIES.SF_PRO}
                  >
                    <Flex align="center" gap="6px">
                      <Text>Swaps</Text>
                      <FiList size={14} />
                    </Flex>
                  </Button>
                </Flex>

                {/* Messages */}
                <Box
                  flex="1"
                  overflowY="auto"
                  p="16px"
                  css={{
                    "&::-webkit-scrollbar": {
                      width: "6px",
                    },
                    "&::-webkit-scrollbar-track": {
                      background: "transparent",
                    },
                    "&::-webkit-scrollbar-thumb": {
                      background: "#333",
                      borderRadius: "4px",
                    },
                  }}
                >
                  {selectedThread.messages && selectedThread.messages.length > 0 ? (
                    <Flex direction="column" gap="16px">
                      {selectedThread.messages.map((msg, idx) => (
                        <Flex key={idx} justify={msg.role === "admin" ? "flex-end" : "flex-start"}>
                          <Box maxW="80%">
                            <Flex align="center" gap="8px" mb="4px">
                              <Text
                                fontFamily={FONT_FAMILIES.SF_PRO}
                                fontSize="10px"
                                color={colorsAnalytics.textGray}
                                fontWeight="600"
                              >
                                {msg.role === "admin" ? "ADMIN" : "USER"}
                              </Text>
                              <Text
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                fontSize="9px"
                                color={colorsAnalytics.textGray}
                              >
                                {new Date(msg.ts).toLocaleString()}
                              </Text>
                            </Flex>
                            <Box
                              bg={
                                msg.role === "admin"
                                  ? colorsAnalytics.greenBackground
                                  : "rgba(255, 255, 255, 0.05)"
                              }
                              border={`1px solid ${msg.role === "admin" ? colorsAnalytics.greenOutline : colorsAnalytics.borderGray}`}
                              borderRadius="12px"
                              p="12px"
                            >
                              <Text
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                fontSize="12px"
                                color={colorsAnalytics.offWhite}
                                whiteSpace="pre-wrap"
                                lineHeight="1.5"
                              >
                                {msg.message}
                              </Text>
                            </Box>
                          </Box>
                        </Flex>
                      ))}
                      <div ref={messagesEndRef} />
                    </Flex>
                  ) : (
                    <Flex justify="center" align="center" h="100%">
                      <Text
                        fontFamily={FONT_FAMILIES.SF_PRO}
                        fontSize="14px"
                        color={colorsAnalytics.textGray}
                      >
                        No messages yet
                      </Text>
                    </Flex>
                  )}
                </Box>

                {/* Input */}
                <Flex
                  p="16px"
                  borderTop={`1px solid ${colorsAnalytics.borderGray}`}
                  gap="12px"
                  bg="rgba(0, 0, 0, 0.3)"
                >
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your response..."
                    bg="rgba(255, 255, 255, 0.05)"
                    border={`1px solid ${colorsAnalytics.borderGray}`}
                    borderRadius="12px"
                    color={colorsAnalytics.offWhite}
                    fontFamily={FONT_FAMILIES.AUX_MONO}
                    fontSize="13px"
                    px="16px"
                    _placeholder={{ color: colorsAnalytics.textGray }}
                    _focus={{
                      borderColor: colorsAnalytics.greenOutline,
                      boxShadow: "none",
                    }}
                  />
                  <Button
                    onClick={sendMessage}
                    bg={colorsAnalytics.greenBackground}
                    border={`2px solid ${colorsAnalytics.greenOutline}`}
                    color={colorsAnalytics.offWhite}
                    _hover={{
                      opacity: 0.8,
                    }}
                    _active={{
                      bg: colorsAnalytics.greenBackground,
                    }}
                    disabled={!messageInput.trim() || isSending}
                    minW="auto"
                    px="20px"
                  >
                    {isSending ? <Spinner size="sm" /> : <IoSend size={18} />}
                  </Button>
                </Flex>
              </Flex>
            )}

            {/* Mobile: Swap History */}
            {mobileView === "swaps" && selectedThread && (
              <Flex direction="column" w="100%" h="100%">
                <Flex
                  px="16px"
                  py="16px"
                  borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
                  bg="rgba(0, 0, 0, 0.3)"
                  justify="space-between"
                  align="center"
                >
                  <Button
                    size="sm"
                    onClick={() => setMobileView("chat")}
                    bg="transparent"
                    border={`1px solid ${colorsAnalytics.borderGray}`}
                    color={colorsAnalytics.offWhite}
                    _hover={{
                      borderColor: colorsAnalytics.greenOutline,
                      bg: "rgba(255, 255, 255, 0.03)",
                    }}
                    minW="auto"
                    h="32px"
                    px="12px"
                    fontSize="12px"
                    fontFamily={FONT_FAMILIES.SF_PRO}
                  >
                    <Flex align="center" gap="6px">
                      <FiArrowLeft size={14} />
                      <Text>Back to Chat</Text>
                    </Flex>
                  </Button>
                  <Text
                    fontFamily={FONT_FAMILIES.NOSTROMO}
                    fontSize="14px"
                    color={colorsAnalytics.offWhite}
                    letterSpacing="0.5px"
                  >
                    SWAP HISTORY
                  </Text>
                  <Text
                    fontFamily={FONT_FAMILIES.SF_PRO}
                    fontSize="11px"
                    color={colorsAnalytics.textGray}
                  >
                    {userSwaps.length} swap{userSwaps.length !== 1 ? "s" : ""}
                  </Text>
                </Flex>

                <Box
                  flex="1"
                  overflowY="auto"
                  css={{
                    "&::-webkit-scrollbar": {
                      width: "6px",
                    },
                    "&::-webkit-scrollbar-track": {
                      background: "transparent",
                    },
                    "&::-webkit-scrollbar-thumb": {
                      background: "#333",
                      borderRadius: "4px",
                    },
                  }}
                >
                  {loadingSwaps ? (
                    <Flex justify="center" align="center" py="40px">
                      <Spinner size="md" color={colorsAnalytics.offWhite} />
                    </Flex>
                  ) : userSwaps.length === 0 ? (
                    <Flex justify="center" align="center" py="40px" px="20px">
                      <Text
                        fontFamily={FONT_FAMILIES.SF_PRO}
                        fontSize="13px"
                        color={colorsAnalytics.textGray}
                        textAlign="center"
                      >
                        No swaps found
                      </Text>
                    </Flex>
                  ) : (
                    <Flex direction="column">
                      {userSwaps.map((swap) => {
                        const currentStep =
                          swap.flow.find((s) => s.state === "inProgress") ||
                          swap.flow[swap.flow.length - 1];
                        const isCompleted = currentStep?.status === "settled";
                        const isRefunded =
                          currentStep?.status === "refunding_user" ||
                          currentStep?.status === "refunding_mm" ||
                          currentStep?.status === "user_refunded_detected";
                        const isFailed =
                          (swap.rawData as any)?.isRefundAvailable ||
                          (swap.rawData as any)?.is_refund_available;

                        const startAsset =
                          swap.direction === "BTC_TO_EVM"
                            ? "BTC"
                            : swap.startAssetMetadata?.ticker || "cbBTC";
                        const endAsset = swap.direction === "BTC_TO_EVM" ? "cbBTC" : "BTC";

                        return (
                          <Box
                            key={swap.id}
                            p="16px"
                            borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
                            cursor="pointer"
                            _hover={{ bg: "rgba(255, 255, 255, 0.05)" }}
                            transition="background 0.15s"
                            onClick={() => window.open(`/swap/${swap.id}`, "_blank")}
                          >
                            <Flex align="center" justify="space-between" mb="10px">
                              <Flex align="center" gap="8px">
                                <AssetIcon
                                  asset={startAsset}
                                  iconUrl={swap.startAssetMetadata?.icon}
                                  size={22}
                                />
                                <Text
                                  fontFamily={FONT_FAMILIES.SF_PRO}
                                  fontSize="13px"
                                  color={colorsAnalytics.offWhite}
                                  fontWeight="600"
                                >
                                  {startAsset}
                                </Text>
                                <Text
                                  fontFamily={FONT_FAMILIES.SF_PRO}
                                  fontSize="12px"
                                  color={colorsAnalytics.textGray}
                                >
                                  →
                                </Text>
                                <AssetIcon asset={endAsset} size={22} />
                                <Text
                                  fontFamily={FONT_FAMILIES.SF_PRO}
                                  fontSize="13px"
                                  color={colorsAnalytics.offWhite}
                                  fontWeight="600"
                                >
                                  {endAsset}
                                </Text>
                              </Flex>
                            </Flex>

                            {/* Amount */}
                            <Flex align="center" gap="6px" mb="6px">
                              <Text
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                fontSize="12px"
                                color={colorsAnalytics.offWhite}
                                fontWeight="500"
                              >
                                {swap.swapInitialAmountBtc.toFixed(6)} BTC
                              </Text>
                              <Text
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                fontSize="11px"
                                color={colorsAnalytics.textGray}
                              >
                                (~$
                                {swap.swapInitialAmountUsd.toLocaleString(undefined, {
                                  maximumFractionDigits: 2,
                                  minimumFractionDigits: 2,
                                })}
                                )
                              </Text>
                            </Flex>

                            <Flex justify="space-between" align="center" mb="6px">
                              <Text
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                fontSize="11px"
                                color={colorsAnalytics.textGray}
                              >
                                {swap.id.slice(0, 12)}...
                              </Text>
                              <Box
                                bg={
                                  isRefunded
                                    ? "rgba(251, 191, 36, 0.15)"
                                    : isCompleted
                                      ? "rgba(34, 197, 94, 0.15)"
                                      : isFailed
                                        ? "rgba(239, 68, 68, 0.15)"
                                        : "rgba(251, 191, 36, 0.15)"
                                }
                                border={`1px solid ${
                                  isRefunded
                                    ? "rgba(251, 191, 36, 0.4)"
                                    : isCompleted
                                      ? "rgba(34, 197, 94, 0.4)"
                                      : isFailed
                                        ? "rgba(239, 68, 68, 0.4)"
                                        : "rgba(251, 191, 36, 0.4)"
                                }`}
                                borderRadius="8px"
                                px="8px"
                                py="3px"
                              >
                                <Text
                                  fontSize="10px"
                                  color={
                                    isRefunded
                                      ? "#fbbf24"
                                      : isCompleted
                                        ? "#22c55e"
                                        : isFailed
                                          ? "#ef4444"
                                          : "#fbbf24"
                                  }
                                  fontWeight="500"
                                  fontFamily={FONT_FAMILIES.AUX_MONO}
                                >
                                  {isRefunded
                                    ? "Refunded"
                                    : isCompleted
                                      ? "Complete"
                                      : isFailed
                                        ? "Failed"
                                        : "Pending"}
                                </Text>
                              </Box>
                            </Flex>

                            <Text
                              fontFamily={FONT_FAMILIES.AUX_MONO}
                              fontSize="10px"
                              color={colorsAnalytics.textGray}
                            >
                              {new Date(swap.swapCreationTimestamp).toLocaleString()}
                            </Text>
                          </Box>
                        );
                      })}
                    </Flex>
                  )}
                </Box>
              </Flex>
            )}
          </>
        ) : (
          <>
            {/* Desktop: Three-column layout */}
            {/* Sidebar */}
            <Box
              minWidth="240px"
              width="240px"
              borderRight={`1px solid ${colorsAnalytics.borderGray}`}
              bg="rgba(0, 0, 0, 0.3)"
              overflowY="auto"
              flexShrink={0}
              css={{
                "&::-webkit-scrollbar": {
                  width: "6px",
                },
                "&::-webkit-scrollbar-track": {
                  background: "transparent",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "#333",
                  borderRadius: "4px",
                },
                "&::-webkit-scrollbar-thumb:hover": {
                  background: "#444",
                },
              }}
            >
              <Flex
                px="16px"
                py="16px"
                borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
                justify="space-between"
                align="center"
              >
                <Text
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  fontSize="12px"
                  color={colorsAnalytics.offWhite}
                  letterSpacing="0.5px"
                >
                  ALL CHATS
                </Text>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedChatId(null);
                    setSelectedThread(null);
                  }}
                  bg="transparent"
                  color={colorsAnalytics.offWhite}
                  fontSize="10px"
                  fontFamily={FONT_FAMILIES.SF_PRO}
                  px="8px"
                  h="auto"
                  _hover={{ opacity: 0.7 }}
                >
                  Back
                </Button>
              </Flex>
              <Flex direction="column">
                {chats.map((chat) => (
                  <Box
                    key={chat.id}
                    p="14px"
                    bg={selectedChatId === chat.id ? "rgba(255, 255, 255, 0.08)" : "transparent"}
                    borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
                    cursor="pointer"
                    onClick={() => loadThread(chat.id)}
                    _hover={{ bg: "rgba(255, 255, 255, 0.05)" }}
                    transition="all 0.15s"
                  >
                    <Text
                      fontFamily={FONT_FAMILIES.SF_PRO}
                      fontSize="12px"
                      color={colorsAnalytics.offWhite}
                      mb="4px"
                    >
                      {chat.user_eth_address.slice(0, 8)}...{chat.user_eth_address.slice(-6)}
                    </Text>
                    <Text
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      fontSize="10px"
                      color={colorsAnalytics.textGray}
                    >
                      {new Date(chat.last_message_at).toLocaleString()}
                    </Text>
                  </Box>
                ))}
              </Flex>
            </Box>

            {/* Chat Area */}
            <Flex direction="column" flex="1">
              {/* Header with copy button */}
              <Flex
                px="24px"
                py="16px"
                borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
                bg="rgba(0, 0, 0, 0.3)"
                justify="space-between"
                align="center"
              >
                <Flex align="center" gap="12px">
                  <Text
                    fontFamily={FONT_FAMILIES.NOSTROMO}
                    fontSize="16px"
                    color={colorsAnalytics.offWhite}
                    letterSpacing="0.5px"
                  >
                    {selectedThread?.user_eth_address.slice(0, 8)}...
                    {selectedThread?.user_eth_address.slice(-6)}
                  </Text>
                  <Button
                    size="sm"
                    onClick={copyAddress}
                    bg="transparent"
                    border={`1px solid ${colorsAnalytics.borderGray}`}
                    color={colorsAnalytics.offWhite}
                    _hover={{
                      borderColor: colorsAnalytics.greenOutline,
                      bg: "rgba(255, 255, 255, 0.03)",
                    }}
                    minW="auto"
                    h="28px"
                    px="10px"
                  >
                    {copiedAddress ? <FiCheck size={14} /> : <FiCopy size={14} />}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      window.open(
                        `https://etherscan.io/address/${selectedThread?.user_eth_address}`,
                        "_blank"
                      )
                    }
                    bg="transparent"
                    border={`1px solid ${colorsAnalytics.borderGray}`}
                    color={colorsAnalytics.offWhite}
                    _hover={{
                      borderColor: colorsAnalytics.greenOutline,
                      bg: "rgba(255, 255, 255, 0.03)",
                    }}
                    minW="auto"
                    h="28px"
                    px="10px"
                  >
                    <FiExternalLink size={14} />
                  </Button>
                </Flex>
                <Text
                  fontFamily={FONT_FAMILIES.SF_PRO}
                  fontSize="12px"
                  color={colorsAnalytics.textGray}
                >
                  {userSwaps.length} swap{userSwaps.length !== 1 ? "s" : ""}
                </Text>
              </Flex>

              {/* Main Content Area with Messages and Swap History */}
              <Flex flex="1" overflow="hidden" minWidth={0}>
                {/* Messages Column */}
                <Box
                  flex="1"
                  minWidth={0}
                  overflowY="auto"
                  p="20px"
                  css={{
                    "&::-webkit-scrollbar": {
                      width: "8px",
                    },
                    "&::-webkit-scrollbar-track": {
                      background: "transparent",
                    },
                    "&::-webkit-scrollbar-thumb": {
                      background: "#333",
                      borderRadius: "4px",
                    },
                    "&::-webkit-scrollbar-thumb:hover": {
                      background: "#444",
                    },
                  }}
                >
                  {selectedThread?.messages && selectedThread.messages.length > 0 ? (
                    <Flex direction="column" gap="16px">
                      {selectedThread.messages.map((msg, idx) => (
                        <Flex key={idx} justify={msg.role === "admin" ? "flex-end" : "flex-start"}>
                          <Box maxW="70%">
                            <Flex align="center" gap="8px" mb="4px">
                              <Text
                                fontFamily={FONT_FAMILIES.SF_PRO}
                                fontSize="10px"
                                color={colorsAnalytics.textGray}
                                fontWeight="600"
                              >
                                {msg.role === "admin" ? "ADMIN" : "USER"}
                              </Text>
                              <Text
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                fontSize="9px"
                                color={colorsAnalytics.textGray}
                              >
                                {new Date(msg.ts).toLocaleString()}
                              </Text>
                            </Flex>
                            <Box
                              bg={
                                msg.role === "admin"
                                  ? colorsAnalytics.greenBackground
                                  : "rgba(255, 255, 255, 0.05)"
                              }
                              border={`1px solid ${msg.role === "admin" ? colorsAnalytics.greenOutline : colorsAnalytics.borderGray}`}
                              borderRadius="12px"
                              p="12px"
                            >
                              <Text
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                fontSize="12px"
                                color={colorsAnalytics.offWhite}
                                whiteSpace="pre-wrap"
                                lineHeight="1.5"
                              >
                                {msg.message}
                              </Text>
                            </Box>
                          </Box>
                        </Flex>
                      ))}
                      <div ref={messagesEndRef} />
                    </Flex>
                  ) : (
                    <Flex justify="center" align="center" h="100%">
                      <Text
                        fontFamily={FONT_FAMILIES.SF_PRO}
                        fontSize="14px"
                        color={colorsAnalytics.textGray}
                      >
                        No messages yet
                      </Text>
                    </Flex>
                  )}
                </Box>

                {/* Swap History Sidebar */}
                <Box
                  minWidth="280px"
                  width="280px"
                  flexShrink={0}
                  borderLeft={`1px solid ${colorsAnalytics.borderGray}`}
                  bg="rgba(0, 0, 0, 0.3)"
                  overflowY="auto"
                  css={{
                    "&::-webkit-scrollbar": {
                      width: "6px",
                    },
                    "&::-webkit-scrollbar-track": {
                      background: "transparent",
                    },
                    "&::-webkit-scrollbar-thumb": {
                      background: "#333",
                      borderRadius: "4px",
                    },
                    "&::-webkit-scrollbar-thumb:hover": {
                      background: "#444",
                    },
                  }}
                >
                  <Flex
                    px="16px"
                    py="12px"
                    borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
                    bg="rgba(0, 0, 0, 0.5)"
                  >
                    <Text
                      fontFamily={FONT_FAMILIES.NOSTROMO}
                      fontSize="12px"
                      color={colorsAnalytics.offWhite}
                      letterSpacing="0.5px"
                    >
                      SWAP HISTORY
                    </Text>
                  </Flex>

                  {loadingSwaps ? (
                    <Flex justify="center" align="center" py="40px">
                      <Spinner size="md" color={colorsAnalytics.offWhite} />
                    </Flex>
                  ) : userSwaps.length === 0 ? (
                    <Flex justify="center" align="center" py="40px" px="20px">
                      <Text
                        fontFamily={FONT_FAMILIES.SF_PRO}
                        fontSize="13px"
                        color={colorsAnalytics.textGray}
                        textAlign="center"
                      >
                        No swaps found
                      </Text>
                    </Flex>
                  ) : (
                    <Flex direction="column">
                      {userSwaps.map((swap) => {
                        const currentStep =
                          swap.flow.find((s) => s.state === "inProgress") ||
                          swap.flow[swap.flow.length - 1];
                        const isCompleted = currentStep?.status === "settled";
                        const isRefunded =
                          currentStep?.status === "refunding_user" ||
                          currentStep?.status === "refunding_mm" ||
                          currentStep?.status === "user_refunded_detected";
                        const isFailed =
                          (swap.rawData as any)?.isRefundAvailable ||
                          (swap.rawData as any)?.is_refund_available;

                        // Get asset names based on direction
                        const startAsset =
                          swap.direction === "BTC_TO_EVM"
                            ? "BTC"
                            : swap.startAssetMetadata?.ticker || "cbBTC";
                        const endAsset = swap.direction === "BTC_TO_EVM" ? "cbBTC" : "BTC";

                        return (
                          <Box
                            key={swap.id}
                            p="12px"
                            borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
                            cursor="pointer"
                            _hover={{ bg: "rgba(255, 255, 255, 0.05)" }}
                            transition="background 0.15s"
                            onClick={() => window.open(`/swap/${swap.id}`, "_blank")}
                          >
                            <Flex align="center" justify="space-between" mb="8px">
                              <Flex align="center" gap="6px">
                                <AssetIcon
                                  asset={startAsset}
                                  iconUrl={swap.startAssetMetadata?.icon}
                                  size={20}
                                />
                                <Text
                                  fontFamily={FONT_FAMILIES.SF_PRO}
                                  fontSize="12px"
                                  color={colorsAnalytics.offWhite}
                                  fontWeight="600"
                                >
                                  {startAsset}
                                </Text>
                                <Text
                                  fontFamily={FONT_FAMILIES.SF_PRO}
                                  fontSize="11px"
                                  color={colorsAnalytics.textGray}
                                >
                                  →
                                </Text>
                                <AssetIcon asset={endAsset} size={20} />
                                <Text
                                  fontFamily={FONT_FAMILIES.SF_PRO}
                                  fontSize="12px"
                                  color={colorsAnalytics.offWhite}
                                  fontWeight="600"
                                >
                                  {endAsset}
                                </Text>
                              </Flex>
                            </Flex>

                            {/* Amount */}
                            <Flex align="center" gap="4px" mb="6px">
                              <Text
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                fontSize="11px"
                                color={colorsAnalytics.offWhite}
                                fontWeight="500"
                              >
                                {swap.swapInitialAmountBtc.toFixed(6)} BTC
                              </Text>
                            </Flex>
                            <Flex align="center" gap="4px" mb="6px">
                              <Text
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                fontSize="10px"
                                color={colorsAnalytics.textGray}
                              >
                                ~$
                                {swap.swapInitialAmountUsd.toLocaleString(undefined, {
                                  maximumFractionDigits: 2,
                                  minimumFractionDigits: 2,
                                })}
                              </Text>
                            </Flex>

                            <Flex justify="space-between" align="center" mb="4px">
                              <Text
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                fontSize="11px"
                                color={colorsAnalytics.textGray}
                              >
                                {swap.id.slice(0, 12)}...
                              </Text>
                              <Box
                                bg={
                                  isRefunded
                                    ? "rgba(251, 191, 36, 0.15)"
                                    : isCompleted
                                      ? "rgba(34, 197, 94, 0.15)"
                                      : isFailed
                                        ? "rgba(239, 68, 68, 0.15)"
                                        : "rgba(251, 191, 36, 0.15)"
                                }
                                border={`1px solid ${
                                  isRefunded
                                    ? "rgba(251, 191, 36, 0.4)"
                                    : isCompleted
                                      ? "rgba(34, 197, 94, 0.4)"
                                      : isFailed
                                        ? "rgba(239, 68, 68, 0.4)"
                                        : "rgba(251, 191, 36, 0.4)"
                                }`}
                                borderRadius="8px"
                                px="6px"
                                py="2px"
                              >
                                <Text
                                  fontSize="10px"
                                  color={
                                    isRefunded
                                      ? "#fbbf24"
                                      : isCompleted
                                        ? "#22c55e"
                                        : isFailed
                                          ? "#ef4444"
                                          : "#fbbf24"
                                  }
                                  fontWeight="500"
                                  fontFamily={FONT_FAMILIES.AUX_MONO}
                                >
                                  {isRefunded
                                    ? "Refunded"
                                    : isCompleted
                                      ? "Complete"
                                      : isFailed
                                        ? "Failed"
                                        : "Pending"}
                                </Text>
                              </Box>
                            </Flex>

                            <Text
                              fontFamily={FONT_FAMILIES.AUX_MONO}
                              fontSize="10px"
                              color={colorsAnalytics.textGray}
                            >
                              {new Date(swap.swapCreationTimestamp).toLocaleString()}
                            </Text>
                          </Box>
                        );
                      })}
                    </Flex>
                  )}
                </Box>
              </Flex>

              {/* Input */}
              <Flex
                p="20px"
                borderTop={`1px solid ${colorsAnalytics.borderGray}`}
                gap="12px"
                bg="rgba(0, 0, 0, 0.3)"
              >
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your response..."
                  bg="rgba(255, 255, 255, 0.05)"
                  border={`1px solid ${colorsAnalytics.borderGray}`}
                  borderRadius="12px"
                  color={colorsAnalytics.offWhite}
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  fontSize="13px"
                  px="16px"
                  _placeholder={{ color: colorsAnalytics.textGray }}
                  _focus={{
                    borderColor: colorsAnalytics.greenOutline,
                    boxShadow: "none",
                  }}
                />
                <Button
                  onClick={sendMessage}
                  bg={colorsAnalytics.greenBackground}
                  border={`2px solid ${colorsAnalytics.greenOutline}`}
                  color={colorsAnalytics.offWhite}
                  _hover={{
                    opacity: 0.8,
                  }}
                  _active={{
                    bg: colorsAnalytics.greenBackground,
                  }}
                  disabled={!messageInput.trim() || isSending}
                  minW="auto"
                  px="20px"
                >
                  {isSending ? <Spinner size="sm" /> : <IoSend size={18} />}
                </Button>
              </Flex>
            </Flex>
          </>
        )}
      </Flex>
    </GridFlex>
  );
};
