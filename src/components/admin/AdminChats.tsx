import React, { useState, useEffect, useRef } from "react";
import { Box, Button, Flex, Text, Input, Spinner } from "@chakra-ui/react";
import { IoSend } from "react-icons/io5";
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

export const AdminChats: React.FC = () => {
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedThread?.messages]);

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

  const loadThread = async (chatId: string) => {
    try {
      const adminPassword = getAdminPasswordFromCookie();
      if (!adminPassword) {
        throw new Error("Not authenticated as admin");
      }

      const thread = await getThreadAsAdmin(chatId, adminPassword);
      console.log("[ADMIN CHATS] Loaded thread:", thread);
      setSelectedThread(thread);
      setSelectedChatId(chatId);
    } catch (error) {
      console.error("Error loading thread:", error);
      toastError(error, {
        title: "Error Loading Thread",
        description: "Unable to load chat messages",
      });
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

      // Reload the thread to get updated messages
      await loadThread(selectedChatId);
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
                    onClick={() => loadThread(chat.id)}
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
      <Flex direction="row" w="100%" h="100%">
        {/* Sidebar */}
        <Box
          width="280px"
          borderRight={`1px solid ${colorsAnalytics.borderGray}`}
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
          {/* Header */}
          <Flex
            px="24px"
            py="20px"
            borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
            bg="rgba(0, 0, 0, 0.3)"
          >
            <Text
              fontFamily={FONT_FAMILIES.NOSTROMO}
              fontSize="16px"
              color={colorsAnalytics.offWhite}
              letterSpacing="0.5px"
            >
              {selectedThread?.user_eth_address.slice(0, 8)}...
              {selectedThread?.user_eth_address.slice(-6)}
            </Text>
          </Flex>

          {/* Messages */}
          <Box
            flex="1"
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
                          fontSize="11px"
                          color={colorsAnalytics.textGray}
                          fontWeight="600"
                        >
                          {msg.role === "admin" ? "ADMIN" : "USER"}
                        </Text>
                        <Text
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          fontSize="10px"
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
                        p="14px"
                      >
                        <Text
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          fontSize="13px"
                          color={colorsAnalytics.offWhite}
                          whiteSpace="pre-wrap"
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
      </Flex>
    </GridFlex>
  );
};
