import React, { FC, ChangeEvent, useMemo, useRef, useEffect, useState, KeyboardEvent } from "react"

import {
  Box,
  Flex,
  Heading,
  Icon,
  IconButton,
  Button,
  VStack,
  Text,
  useToast,
  Textarea,
  Spinner,
  Select,
  FormControl,
  FormLabel,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
} from "@chakra-ui/react"
import { useSetAtom, useAtomValue, useAtom } from "jotai"
import { VscClose } from "react-icons/vsc"
import TextareaAutosize from 'react-textarea-autosize';
import { useChat } from "@ai-sdk/react"
import { ChatContext, useChatContext } from "./chatContext"

import { isChatOpenAtom, aiProviderAtom, systemPromptAtom, chatMessagesAtom, deckAtom, cardsAtom, patternAtom, potAtom, labelAtom } from "./state";
import { SYSTEM_PROMPT_MESSAGE } from "./const";
import type { CardsState, PatternState, LabelState } from "./state"

export const ChatProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
  const [persistedMessages] = useAtom(chatMessagesAtom);
  const selectedProvider = useAtomValue(aiProviderAtom);
  const toast = useToast();
  const [thinkingBudget, setThinkingBudget] = useState<number>(0);
  const [systemPrompt] = useAtom(systemPromptAtom);

  const chatHelpers = useChat({
    api: "/api/chat",
    initialMessages: persistedMessages,
    body: {
      provider: selectedProvider,
      thinkingBudget: selectedProvider === 'google' ? thinkingBudget : undefined,
      systemPrompt: systemPrompt,
    },
    onError: (err) => {
      console.error("Chat error:", err);
      toast({ title: "チャットエラー", description: err.message, status: "error", duration: 5000, isClosable: true });
    },
  });

  return (
    <ChatContext.Provider value={{ ...chatHelpers, thinkingBudget, setThinkingBudget }}>
      {children}
    </ChatContext.Provider>
  );
};

const SystemPromptModal: FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [systemPrompt, setSystemPrompt] = useAtom(systemPromptAtom);
  const [localPrompt, setLocalPrompt] = useState(systemPrompt);
  const toast = useToast();
  const defaultPromptContent = SYSTEM_PROMPT_MESSAGE.content;

  useEffect(() => {
    if (isOpen) {
      setLocalPrompt(systemPrompt);
    }
  }, [isOpen, systemPrompt]);

  const handleSave = () => {
    setSystemPrompt(localPrompt);
    toast({
      title: "保存しました",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
    onClose();
  };

  const handleResetToDefault = () => {
    setLocalPrompt(defaultPromptContent);
    toast({
      title: "デフォルトに戻しました",
      status: "info",
      duration: 2000,
      isClosable: true,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" blockScrollOnMount={false}>
      <ModalOverlay />
      <ModalContent mx={8}>
        <ModalHeader>システムプロンプト編集</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            placeholder="システムプロンプトを入力..."
            minHeight="300px"
            size="sm"
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" colorScheme="gray" mr="auto" onClick={handleResetToDefault} size="sm">
            デフォルトに戻す
          </Button>
          <Button variant="ghost" mr={3} onClick={onClose} size="sm">
            キャンセル
          </Button>
          <Button 
            colorScheme="blue" 
            bg="blue.500"
            color="white"
            _hover={{
              bg: 'blue.600',
            }}
            onClick={handleSave} 
            size="sm"
          >
            保存
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const ChatUIInternal: FC = () => {
  const setIsChatOpen = useSetAtom(isChatOpenAtom)
  const toast = useToast()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const [aiProvider, setAiProvider] = useAtom(aiProviderAtom);
  const { thinkingBudget, setThinkingBudget } = useChatContext();
  const { isOpen, onOpen, onClose } = useDisclosure();

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

  const handleFormSubmit = (e?: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e) {
      e.preventDefault();
    }
    if (!input.trim() || isLoading) {
      return;
    }
    const stateString = JSON.stringify(currentState, null, 2);
    const combinedContent = `${input}\n\n--- Current State ---\n\`\`\`json\n${stateString}\n\`\`\``;
    void append({ role: "user", content: combinedContent });
    setInput("");
    setShouldAutoScroll(true);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleFormSubmit(e);
    }
  };

  const handleProviderChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setAiProvider(event.target.value as "google" | "openai");
    if (event.target.value !== 'google') {
      setThinkingBudget(0);
    }
  };

  const handleThinkingBudgetChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setThinkingBudget(parseInt(event.target.value, 10));
  };

  const nonSystemMessages = useMemo(() => messages.filter(m => m.role !== 'system'), [messages]);

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
      zIndex={1300}
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
        {nonSystemMessages.length === 0 && !isLoading && (
           <Flex direction="column" align="center" justify="center" height="100%" p={4}>
             <Text color="gray.500" textAlign="center" mb={4}>
               メッセージを送信してください。
             </Text>
             <Button 
               onClick={onOpen} 
               size="sm" 
               colorScheme="blue"
               bg="blue.500"
               color="white"
               _hover={{
                 bg: 'blue.600',
               }}
               disabled={isLoading}
               _disabled={{
                 bg: 'blue.300',
                 color: 'white',
                 cursor: 'not-allowed',
                 opacity: 0.7,
               }}
             >
               システムプロンプトを編集
             </Button>
           </Flex>
        )}
        {messages
          .filter(m => m.role !== 'system')
          .map((m, index) => {
            const isAiAssistant = m.role === 'assistant';
            const isUser = m.role === 'user';
            const isLastMessage = index === nonSystemMessages.length - 1;

            let displayElement: React.ReactNode;
            let justify: "flex-start" | "flex-end";
            let bgColor: string;
            let textColor: string;

            if (isUser) {
              justify = "flex-end";
              bgColor = "blue.500";
              textColor = "white";
              const stateMarker = '\n\n--- Current State ---';
              const markerIndex = m.content.indexOf(stateMarker);
              let userText = m.content;
              if (markerIndex !== -1) {
                userText = m.content.substring(0, markerIndex).trim();
              }
              displayElement = (
                <Text whiteSpace="pre-wrap" fontSize="sm">
                  {userText}
                </Text>
              );
            } else if (isAiAssistant) {
              justify = "flex-start";
              bgColor = "gray.100";
              textColor = "black";

              const jsonStartIndex = m.content.lastIndexOf('```json');
              const isStreamingIncompleteJson = 
                  isLastMessage && 
                  isLoading && 
                  jsonStartIndex !== -1 && 
                  !m.content.substring(jsonStartIndex).trim().endsWith('```');

              if (isStreamingIncompleteJson) {
                const textBeforeJson = m.content.substring(0, jsonStartIndex).trim();

                displayElement = (
                  <VStack align="stretch" spacing={1}> 
                    {textBeforeJson && ( 
                      <Text whiteSpace="pre-wrap" fontSize="sm">
                        {textBeforeJson}
                      </Text>
                    )}
                    <Flex align="center"> 
                      <Spinner size="sm" mr={2} speed="0.65s" />
                      <Text fontSize="sm" fontStyle="italic" color="gray.600">データ生成中...</Text>
                    </Flex>
                  </VStack>
                );
              } else {
                let assistantText = m.content;
                let useMonospace = false;
                const codeBlockRegex = /^```json\n?([\s\S]*?)\n?```$/; 
                const match = m.content.match(codeBlockRegex);
                if (match && match[1]) {
                  assistantText = match[1].trim();
                  useMonospace = true;
                } else {
                  useMonospace = false;
                }
                displayElement = (
                  <Text
                    whiteSpace="pre-wrap"
                    fontSize="sm"
                    fontFamily={useMonospace ? "monospace" : "inherit"}
                  >
                    {assistantText}
                  </Text>
                );
              }
            } else {
              return null;
            }

            return (
              <Flex key={m.id} w="full" justify={justify}>
                <Box
                  bg={bgColor}
                  color={textColor}
                  px={3}
                  py={1.5}
                  borderRadius="lg"
                  maxW="85%"
                >
                  {displayElement}
                </Box>
              </Flex>
            );
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
        {nonSystemMessages.length === 0 && (
          <Flex justify="space-between" align="flex-end" mb={2}>
            <FormControl flex="1" mr={2}>
              <FormLabel htmlFor="ai-provider" fontSize="xs" mb={0} mr={2} whiteSpace="nowrap">AI Provider:</FormLabel>
              <Select
                id="ai-provider"
                size="sm"
                value={aiProvider}
                onChange={handleProviderChange}
                disabled={isLoading}
                focusBorderColor="blue.500"
                borderRadius="md"
              >
                <option value="google">Google</option>
                <option value="openai">OpenAI</option>
              </Select>
            </FormControl>

            <FormControl
              flex="1"
              mr={3}
              isDisabled={aiProvider !== 'google' || isLoading}
            >
              <FormLabel htmlFor="thinking-budget" fontSize="xs" mb={0} mr={2} whiteSpace="nowrap">Thinking Budget:</FormLabel>
              <Select
                id="thinking-budget"
                size="sm"
                value={thinkingBudget}
                onChange={handleThinkingBudgetChange}
                disabled={aiProvider !== 'google' || isLoading}
                focusBorderColor="blue.500"
                borderRadius="md"
              >
                <option value={0}>0</option>
                <option value={1024}>1024</option>
                <option value={8192}>8192</option>
              </Select>
            </FormControl>
          </Flex>
        )}

        <Flex justify="flex-end" mb={3}>
          {lastAssistantMessageContent != null && !isLoading && (
            <Button
              onClick={handleApplyState}
              size="sm"
              width="full"
              colorScheme="green"
              bg="green.500"
              color="white"
              _hover={{ bg: 'green.600' }}
            >
              最後のメッセージのデータを適用
            </Button>
          )}
          {isLoading && (
            <Button 
              onClick={stop} 
              size="sm" 
              width="full"
              variant="outline" 
              colorScheme="red"
            >
              停止
            </Button>
          )}
        </Flex>

        <form onSubmit={handleFormSubmit}>
          <Flex align="flex-end">
            <Textarea
              as={TextareaAutosize}
              value={input}
              onChange={handleInputChange as (e: ChangeEvent<HTMLTextAreaElement>) => void}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力 (Ctrl+Enter or Cmd+Enter で送信)"
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

      <SystemPromptModal isOpen={isOpen} onClose={onClose} />
    </Box>
  )
}

export const ChatUI: FC = () => {
  const isChatOpen = useAtomValue(isChatOpenAtom);
  return isChatOpen ? <ChatUIInternal /> : null;
}; 