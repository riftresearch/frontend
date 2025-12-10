import React, { useState, useEffect, useRef } from "react";
import { Box, Button, Flex, Text, Input, Spinner } from "@chakra-ui/react";
import { IoChatbubbleEllipsesOutline, IoClose, IoSend } from "react-icons/io5";
import { useAccount } from "wagmi";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import { motion, AnimatePresence } from "framer-motion";
import {
  createChat,
  listChats,
  getThread,
  appendMessage,
  markRead,
  ChatThread,
} from "@/utils/chatClient";
import { toastError, toastSuccess } from "@/utils/toast";

export const FeedbackChat: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [chatList, setChatList] = useState<ChatThread[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentThread, setCurrentThread] = useState<ChatThread | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentThread?.messages]);

  // Check for unread messages when wallet connects
  useEffect(() => {
    if (isConnected && address && !isOpen) {
      checkForUnreadMessages();
    }
  }, [isConnected, address]);

  // Load chats when opened
  useEffect(() => {
    if (isOpen && isConnected && address) {
      loadChats();
    }
  }, [isOpen, isConnected, address]);

  // Set up polling for new messages (every 10 seconds)
  useEffect(() => {
    if (isConnected && address) {
      // Initial check
      checkForUnreadMessages();

      // Poll every 10 seconds
      pollingIntervalRef.current = setInterval(() => {
        checkForUnreadMessages();
      }, 10000);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      };
    }
  }, [isConnected, address, isOpen, currentChatId]);

  const checkForUnreadMessages = async () => {
    if (!address) return;
    try {
      const result = await listChats(address);
      if (!result.ok) {
        console.error("Error checking for unread messages:", result.error);
        return;
      }
      const chats = result.data;

      if (chats.length === 0) {
        setUnreadCount(0);
        return;
      }

      // Get total unread count from server
      const totalUnread = chats.reduce(
        (sum: number, chat: ChatThread) => sum + (chat.user_unread_count || 0),
        0
      );
      setUnreadCount(totalUnread);

      // If chat is open, reload the current thread to show new messages
      if (isOpen && currentChatId) {
        const thread = await getThread(currentChatId, address);
        setCurrentThread(thread);
      }
    } catch (error) {
      console.error("Error checking for unread messages:", error);
    }
  };

  const loadChats = async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const result = await listChats(address);
      if (!result.ok) {
        console.error("Error loading chats:", result.error);
        toastError(new Error(result.error), {
          title: "Error Loading Chats",
          description: "Unable to load your chat history",
        });
        return;
      }
      const chats = result.data;
      console.log("[FEEDBACK CHAT] Loaded chats:", chats);
      setChatList(chats);

      // Update unread count from server data
      const totalUnread = chats.reduce(
        (sum: number, chat: ChatThread) => sum + (chat.user_unread_count || 0),
        0
      );
      setUnreadCount(totalUnread);

      // If user has chats, load the most recent one
      if (chats.length > 0) {
        await loadThread(chats[0].id);
      } else {
        // If no chats, create a new one
        await createNewChat();
      }
    } catch (error) {
      console.error("Error loading chats:", error);
      toastError(error, {
        title: "Error Loading Chats",
        description: "Unable to load your chat history",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createNewChat = async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const chatId = await createChat(address, { source: "feedback_button" });
      console.log("Created new chat:", chatId);
      setCurrentChatId(chatId);

      // Reload chat list
      const result = await listChats(address);
      if (result.ok) {
        setChatList(result.data);
      }

      // Load the new thread
      await loadThread(chatId);

      toastSuccess({
        title: "Chat Started",
        description: "Your feedback chat is ready",
      });
    } catch (error) {
      console.error("Error creating chat:", error);
      toastError(error, {
        title: "Error Creating Chat",
        description: "Unable to start a new chat",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadThread = async (chatId: string) => {
    if (!address) return;
    try {
      const thread = await getThread(chatId, address);
      console.log("[FEEDBACK CHAT] Loaded thread:", thread);
      console.log("[FEEDBACK CHAT] Messages:", thread.messages);
      setCurrentThread(thread);
      setCurrentChatId(chatId);

      // Mark as read when loading thread
      if (isOpen) {
        await markRead(chatId, address);
        // Refresh unread count after marking as read
        checkForUnreadMessages();
      }
    } catch (error) {
      console.error("Error loading thread:", error);
      toastError(error, {
        title: "Error Loading Thread",
        description: "Unable to load chat messages",
      });
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !currentChatId || !address || isSending) return;

    setIsSending(true);
    try {
      await appendMessage(currentChatId, address, "user", messageInput.trim());
      setMessageInput("");

      // Reload the thread to get updated messages
      const thread = await getThread(currentChatId, address);
      setCurrentThread(thread);

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

  const handleOpen = async () => {
    if (!isConnected) {
      toastSuccess({
        title: "Wallet Required",
        description: "Please connect your wallet to leave feedback",
      });
      return;
    }
    setIsOpen(true);
  };

  const handleClose = async () => {
    setIsOpen(false);

    // Mark current chat as read when closing
    if (address && currentChatId) {
      try {
        await markRead(currentChatId, address);
        checkForUnreadMessages();
      } catch (error) {
        console.error("Error marking chat as read:", error);
      }
    }
  };

  // Collapsed button
  if (!isOpen) {
    return (
      <Box position="fixed" bottom="80px" right="30px" zIndex={1000}>
        <Button
          onClick={handleOpen}
          bg={colors.swapBgColor}
          border={`2px solid ${colors.swapBorderColor}`}
          borderRadius="20px"
          color={colors.offWhite}
          fontFamily={FONT_FAMILIES.NOSTROMO}
          fontSize="10px"
          px="17px"
          py="8.5px"
          h="auto"
          letterSpacing="0.5px"
          _hover={{
            bg: colors.swapHoverColor,
            transform: "translateY(-2px)",
            boxShadow: "0 4px 12px rgba(102, 81, 179, 0.3)",
          }}
          _active={{
            bg: colors.swapBgColor,
          }}
          transition="all 0.2s"
          display="flex"
          alignItems="center"
          gap="7px"
          position="relative"
        >
          <IoChatbubbleEllipsesOutline size={14} />
          GIVE FEEDBACK
          {/* Notification Badge */}
          {unreadCount > 0 && (
            <Box
              position="absolute"
              top="-8px"
              right="-8px"
              bg="#DC2626"
              borderRadius="50%"
              w="26px"
              h="26px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              border="2px solid #000"
            >
              <Text
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="13px"
                color="white"
                fontWeight="bold"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </Box>
          )}
        </Button>
      </Box>
    );
  }

  // Expanded chat UI
  const hasSidebar = chatList.length > 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, x: 20, y: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, x: 20, y: 20 }}
        transition={{ duration: 0.2 }}
        style={{
          position: "fixed",
          bottom: "100px",
          right: "30px",
          zIndex: 1000,
        }}
      >
        <Flex
          bg="rgba(15, 15, 20, 0.95)"
          backdropFilter="blur(10px)"
          border={`2px solid ${colors.swapBorderColor}`}
          borderRadius="16px"
          overflow="hidden"
          boxShadow="0 8px 32px rgba(0, 0, 0, 0.6)"
          width={hasSidebar ? "700px" : "400px"}
          height="600px"
        >
          {/* Sidebar - only show if multiple chats */}
          {hasSidebar && (
            <Box
              width="200px"
              borderRight={`1px solid ${colors.borderGray}`}
              bg="rgba(0, 0, 0, 0.3)"
              overflowY="auto"
            >
              <Flex
                p="16px"
                borderBottom={`1px solid ${colors.borderGray}`}
                justify="space-between"
                align="center"
              >
                <Text
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  fontSize="12px"
                  color={colors.offWhite}
                  letterSpacing="0.5px"
                >
                  YOUR CHATS
                </Text>
                <Button
                  size="sm"
                  onClick={createNewChat}
                  bg="transparent"
                  color={colors.offWhite}
                  fontSize="20px"
                  p="0"
                  minW="auto"
                  h="auto"
                  _hover={{ opacity: 0.7 }}
                >
                  +
                </Button>
              </Flex>
              <Flex direction="column" gap="4px" p="8px">
                {chatList.map((chat) => (
                  <Box
                    key={chat.id}
                    p="12px"
                    bg={currentChatId === chat.id ? "rgba(255, 255, 255, 0.1)" : "transparent"}
                    borderRadius="8px"
                    cursor="pointer"
                    onClick={() => loadThread(chat.id)}
                    _hover={{ bg: "rgba(255, 255, 255, 0.05)" }}
                    transition="all 0.15s"
                  >
                    <Text
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      fontSize="11px"
                      color={colors.textGray}
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                    >
                      {new Date(chat.last_message_at).toLocaleDateString()}
                    </Text>
                  </Box>
                ))}
              </Flex>
            </Box>
          )}

          {/* Main Chat Area */}
          <Flex direction="column" flex="1">
            {/* Header */}
            <Flex
              p="16px"
              borderBottom={`1px solid ${colors.borderGray}`}
              justify="space-between"
              align="center"
              bg="rgba(0, 0, 0, 0.3)"
            >
              <Text
                fontFamily={FONT_FAMILIES.NOSTROMO}
                fontSize="14px"
                color={colors.offWhite}
                letterSpacing="0.5px"
              >
                FEEDBACK CHAT
              </Text>
              <Button
                onClick={handleClose}
                size="sm"
                bg="transparent"
                color={colors.offWhite}
                _hover={{ bg: "rgba(255, 255, 255, 0.1)" }}
                minW="auto"
                p="6px"
              >
                <IoClose size={18} />
              </Button>
            </Flex>

            {/* Messages */}
            <Box
              flex="1"
              overflowY="auto"
              p="16px"
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
              {isLoading ||
              (chatList.length > 0 && !currentThread) ||
              (unreadCount > 0 && !currentThread) ? (
                <Flex justify="center" align="center" h="100%">
                  <Spinner color={colors.offWhite} />
                </Flex>
              ) : currentThread?.messages && currentThread.messages.length > 0 ? (
                <Flex direction="column" gap="12px">
                  {currentThread.messages.map((msg, idx) => (
                    <Flex key={idx} justify={msg.role === "user" ? "flex-end" : "flex-start"}>
                      <Box
                        maxW="80%"
                        bg={
                          msg.role === "user"
                            ? "rgba(30, 60, 114, 0.5)"
                            : "rgba(255, 255, 255, 0.08)"
                        }
                        border={`1px solid ${msg.role === "user" ? "rgba(57, 97, 168, 0.6)" : colors.borderGray}`}
                        borderRadius="12px"
                        p="12px"
                      >
                        <Text
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          fontSize="13px"
                          color={colors.offWhite}
                          whiteSpace="pre-wrap"
                        >
                          {msg.message}
                        </Text>
                        <Text
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          fontSize="10px"
                          color={colors.textGray}
                          mt="4px"
                        >
                          {new Date(msg.ts).toLocaleTimeString()}
                        </Text>
                      </Box>
                    </Flex>
                  ))}
                  <div ref={messagesEndRef} />
                </Flex>
              ) : (
                <Flex
                  justify="center"
                  align="center"
                  h="100%"
                  direction="column"
                  gap="16px"
                  px="10px"
                >
                  <IoChatbubbleEllipsesOutline size={32} color={colors.textGray} />
                  <Text
                    fontFamily={FONT_FAMILIES.AUX_MONO}
                    fontSize="13px"
                    color={colors.textGray}
                    textAlign="center"
                    mb="8px"
                  >
                    Start a conversation with Rift
                  </Text>

                  {/* Starter Message Ideas */}
                  <Flex direction="column" gap="8px" w="100%">
                    {[
                      "what feature do you wish we had?",
                      "what's most confusing about rift?",
                      "what chain should we launch on next?",
                    ].map((suggestion, idx) => (
                      <Button
                        key={idx}
                        onClick={() => setMessageInput(suggestion)}
                        bg="rgba(255, 255, 255, 0.05)"
                        border={`1px solid ${colors.borderGray}`}
                        borderRadius="12px"
                        color={colors.textGray}
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        fontSize="12px"
                        py="12px"
                        h="auto"
                        textAlign="left"
                        _hover={{
                          bg: "rgba(255, 255, 255, 0.08)",
                          borderColor: colors.swapBorderColor,
                          color: colors.offWhite,
                        }}
                        transition="all 0.2s"
                        whiteSpace="normal"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </Flex>
                </Flex>
              )}
            </Box>

            {/* Input */}
            <Flex
              p="16px"
              borderTop={`1px solid ${colors.borderGray}`}
              gap="8px"
              bg="rgba(0, 0, 0, 0.3)"
            >
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your feedback..."
                bg="rgba(255, 255, 255, 0.05)"
                border={`1px solid ${colors.borderGray}`}
                borderRadius="12px"
                color={colors.offWhite}
                fontFamily={FONT_FAMILIES.AUX_MONO}
                fontSize="13px"
                px="16px"
                _placeholder={{ color: colors.textGray }}
                _focus={{
                  borderColor: colors.swapBorderColor,
                  boxShadow: "none",
                }}
              />
              <Button
                onClick={sendMessage}
                bg={colors.swapBgColor}
                border={`2px solid ${colors.swapBorderColor}`}
                color={colors.offWhite}
                _hover={{
                  bg: colors.swapHoverColor,
                }}
                _active={{
                  bg: colors.swapBgColor,
                }}
                disabled={!messageInput.trim() || isSending}
                minW="auto"
                px="16px"
              >
                {isSending ? <Spinner size="sm" /> : <IoSend size={18} />}
              </Button>
            </Flex>
          </Flex>
        </Flex>
      </motion.div>
    </AnimatePresence>
  );
};
