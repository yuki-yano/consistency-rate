import React, { FC, ChangeEvent, useMemo, useRef, useEffect, useState } from "react"

import { Box, Flex, Heading, Icon, IconButton, Button, VStack, Text, useToast, Textarea } from "@chakra-ui/react"
import { useSetAtom, useAtomValue, useAtom } from "jotai"
import { VscClose } from "react-icons/vsc"
import TextareaAutosize from 'react-textarea-autosize';
import { useChat } from "@ai-sdk/react"
import { ChatContext, useChatContext } from "./chatContext"

import { isChatOpenAtom } from "./state"
import type { CardsState, PatternState, LabelState } from "./state"
import { deckAtom, cardsAtom, patternAtom, potAtom, labelAtom, chatMessagesAtom } from "./state";

// --- ChatProvider ---
export const ChatProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
  const [persistedMessages] = useAtom(chatMessagesAtom);
  const toast = useToast();

  const chatHelpers = useChat({
    api: "/api/chat",
    initialMessages: persistedMessages,
    onError: (err) => {
      console.error("Chat error:", err);
      toast({ title: "チャットエラー", description: err.message, status: "error", duration: 5000, isClosable: true });
    },
  });

  // アプリケーション終了時などの永続化が必要な場合は別途検討
  // useEffect(() => {...

  return (
    <ChatContext.Provider value={chatHelpers}>
      {children}
    </ChatContext.Provider>
  );
};

// --- ChatUIInternal ---
const ChatUIInternal: FC = () => {
  const setIsChatOpen = useSetAtom(isChatOpenAtom)
  const toast = useToast()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)

  const {
    messages,
    input,
    handleInputChange,
    isLoading,
    error,
    stop,
    reload,
    append,
    setInput,
  } = useChatContext();

  const deck = useAtomValue(deckAtom);
  const cards = useAtomValue(cardsAtom);
  const pattern = useAtomValue(patternAtom);
  const pot = useAtomValue(potAtom);
  const label = useAtomValue(labelAtom);
  const currentState = useMemo(() => ({
    deck,
    cards,
    pattern,
    pot,
    label,
  }), [deck, cards, pattern, pot, label]);

  const lastAssistantMessageContent = useMemo(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant') {
      const codeBlockRegex = /```json\n?([\s\S]*?)\n?```/;
      const match = lastMessage.content.match(codeBlockRegex);

      if (match && match[1]) {
        const potentialJson = match[1].trim();
        try {
          JSON.parse(potentialJson);
          return potentialJson;
        } catch (e) {
          console.error("Extracted content is not valid JSON:", potentialJson, e);
          return null;
        }
      } else {
        // console.log("No JSON code block found in last assistant message:", lastMessage.content);
      }
    }
    return null;
  }, [messages]);

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return;

    if (isLoading) {
      element.scrollTop = element.scrollHeight;
      return;
    }

    if (shouldAutoScroll) {
      const isScrolledToBottom = element.scrollHeight - element.scrollTop - element.clientHeight <= 10;
      if (isScrolledToBottom) {
        element.scrollTop = element.scrollHeight;
      }
    }
  }, [messages, isLoading, shouldAutoScroll]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget
    const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight <= 5
    const manualScrollThreshold = 50
    const isManuallyScrolledUp = element.scrollHeight - element.scrollTop - element.clientHeight > manualScrollThreshold

    if (isManuallyScrolledUp) {
      if (shouldAutoScroll) setShouldAutoScroll(false)
    } else if (isAtBottom) {
      if (!shouldAutoScroll) setShouldAutoScroll(true)
    }
  }

  const handleApplyState = () => {
    if (lastAssistantMessageContent == null) {
      toast({ title: "適用エラー", description: "適用可能な応答が見つかりません。", status: "error", duration: 3000, isClosable: true })
      return
    }
    try {
      const stateToInject = JSON.parse(lastAssistantMessageContent)

      const validateItems = (items: Array<{ name?: string } | undefined> | undefined, itemType: string): string | null => {
        if (!items) return null;
        for (const item of items) {
          if (!item || typeof item.name !== 'string' || item.name.trim() === '') {
            return `${itemType}情報に必須の'name'プロパティがないか、空です。`;
          }
        }
        return null;
      };

      const cardsError = validateItems((stateToInject.cards as CardsState | undefined)?.cards, "カード");
      const patternsError = validateItems((stateToInject.pattern as PatternState | undefined)?.patterns, "パターン");
      const labelsError = validateItems((stateToInject.label as LabelState | undefined)?.labels, "ラベル");
      const validationError = cardsError ?? patternsError ?? labelsError ?? null;

      if (validationError !== null) {
        console.warn("State validation error:", validationError);
        toast({ title: "適用エラー", description: validationError, status: "error", duration: 5000, isClosable: true })
        return; 
      }

      if (window.injectFromState != null) {
        window.injectFromState(stateToInject)
        toast({ title: "成功", description: "状態が適用されました。", status: "success", duration: 3000, isClosable: true })
      } else {
        throw new Error("injectFromState関数が見つかりません。")
      }
    } catch (error) {
      console.error("Failed to parse or inject state:", error)
      const description = error instanceof Error ? error.message : "状態の適用中に不明なエラーが発生しました。";
      toast({ title: "適用エラー", description, status: "error", duration: 5000, isClosable: true })
    }
  }

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) {
      return;
    }
    const stateString = JSON.stringify(currentState, null, 2);
    const combinedContent = `${input}\\n\\n--- Current State ---\\n\\\`\\\`\\\`json\\n${stateString}\\n\\\`\\\`\\\``;
    void append({ role: "user", content: combinedContent });
    setInput("");
    setShouldAutoScroll(true);
  };

  return (
    <Box
      position="fixed"
      bottom={{ base: 0, md: 6 }}
      right={{ base: 2, md: 6 }}
      left={{ base: 2, md: 'auto' }}
      width={{ md: '600px' }}
      height={{ base: '85vh', md: '800px' }}
      bg="white"
      boxShadow="lg"
      borderWidth="2px"
      borderColor="gray.200"
      borderTopRadius={{ base: 'md', md: 'md' }}
      borderBottomRadius={{ base: 0, md: 'md' }}
      zIndex="popover"
      display="flex"
      flexDirection="column"
    >
      <Flex justify="space-between" align="center" p={4} borderBottomWidth="1px">
        <Heading size="md">チャット</Heading>
        <IconButton
          aria-label="チャットを閉じる"
          icon={<Icon as={VscClose} />}
          size="sm"
          onClick={() => setIsChatOpen(false)}
          variant="ghost"
        />
      </Flex>

      <VStack
        ref={scrollRef}
        onScroll={handleScroll}
        flex={1}
        overflowY="auto"
        spacing={4}
        p={4}
        align="stretch"
      >
        {messages.length === 1 && messages[0].role === 'system' && !isLoading && (
          <Text color="gray.500" textAlign="center" mt="auto" mb="auto">
            メッセージを送信してください
          </Text>
        )}
        {messages
          .filter(m => m.role !== 'system')
          .map((m) => {
            const isAiAssistant = m.role === 'assistant';
            const isUser = m.role === 'user';

            let displayContent = m.content;
            let useMonospace = false;
            if (isAiAssistant) {
              const codeBlockRegex = /^```json\\n?([\\s\\S]*?)\\n?```$/;
              const match = displayContent.match(codeBlockRegex);
              if (match && match[1]) {
                displayContent = match[1].trim();
                useMonospace = true;
              } else {
                 useMonospace = false;
              }
            } else if (isUser) {
              const stateMarker = '\\n\\n--- Current State ---';
              const markerIndex = m.content.indexOf(stateMarker);
              if (markerIndex !== -1) {
                  displayContent = m.content.substring(0, markerIndex).trim();
              }
              useMonospace = false;
            }

            return (
              <Flex key={m.id} w="full" justify={m.role === "user" ? "flex-end" : "flex-start"}>
                <Box
                  bg={m.role === "user" ? "blue.500" : "gray.100"}
                  color={m.role === "user" ? "white" : "black"}
                  px={3}
                  py={1.5}
                  borderRadius="lg"
                  maxW="85%"
                >
                  <Text
                    whiteSpace="pre-wrap"
                    fontSize="sm"
                    fontFamily={useMonospace ? "monospace" : "inherit"}
                  >
                    {displayContent}
                  </Text>
                </Box>
              </Flex>
            )
          })
        }
        {error && (
          <Flex direction="column" align="center" color="red.500" mt={4}>
            <Text fontSize="sm">エラーが発生しました。</Text>
            <Button size="xs" mt={1} onClick={() => reload()}>再試行</Button>
          </Flex>
        )}
      </VStack>

      <Box p={4} borderTopWidth="1px">
        {lastAssistantMessageContent != null && !isLoading && (
          <Button
            onClick={handleApplyState}
            size="sm"
            mb={2}
            width="full"
            colorScheme="green"
            bg="green.500"
            color="white"
            _hover={{ bg: 'green.600' }}
          >
            最後の応答を状態に適用
          </Button>
        )}
        {isLoading && (
          <Button onClick={stop} size="sm" mb={2} width="full" variant="outline" colorScheme="red">
            停止
          </Button>
        )}
        <form onSubmit={handleFormSubmit}>
          <Flex align="flex-end">
            <Textarea
              as={TextareaAutosize}
              value={input}
              onChange={handleInputChange as (e: ChangeEvent<HTMLTextAreaElement>) => void}
              placeholder="メッセージを入力..."
              mr={2}
              disabled={isLoading}
              size="sm"
              minRows={1}
              maxRows={5}
              sx={{ 
                overflowY: 'auto'
              }}
              _focus={{ boxShadow: 'outline', borderColor: 'blue.500' }}
              borderWidth="1px"
              borderRadius="md"
              p={2}
            />
            <Button
              type="submit"
              colorScheme="blue"
              color="white"
              bg="blue.500"
              _hover={{
                bg: !input.trim() ? 'blue.300' : 'blue.600',
              }}
              isLoading={isLoading}
              disabled={!input.trim()}
              size="sm"
              _disabled={{
                bg: 'blue.300',
                color: 'white',
                cursor: 'not-allowed',
                opacity: 0.7,
              }}
            >
              送信
            </Button>
          </Flex>
        </form>
      </Box>
    </Box>
  )
}

// --- ChatUI (Wrapper) ---
export const ChatUI: FC = () => {
  const isChatOpen = useAtomValue(isChatOpenAtom);
  return isChatOpen ? <ChatUIInternal /> : null;
}; 