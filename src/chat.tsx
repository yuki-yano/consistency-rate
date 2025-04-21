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
  HStack,
  Input,
} from "@chakra-ui/react"
import { useSetAtom, useAtomValue, useAtom } from "jotai"
import { VscClose } from "react-icons/vsc"
import { FiCopy } from "react-icons/fi"
import TextareaAutosize from 'react-textarea-autosize';
import { useChat } from "@ai-sdk/react"
import { useChatContext, ChatContext } from "./chatContext"

import { isChatOpenAtom, aiProviderAtom, systemPromptAtom, chatMessagesAtom, deckAtom, cardsAtom, patternAtom, potAtom, labelAtom } from "./state";
import { SYSTEM_PROMPT_MESSAGE } from "./const";
import type { CardsState, PatternState, LabelState } from "./state"
import { CoreMessage } from "ai";
import { v4 as uuidv4 } from "uuid";

interface SaveHistorySuccessResponse {
  key: string;
}
interface SaveHistoryErrorResponse {
  error: string;
}

interface RestoreHistorySuccessResponse {
  messages: CoreMessage[];
}
interface RestoreHistoryErrorResponse {
  error: string;
}

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
  const [lastSentState, setLastSentState] = useState<object | null>(null);
  const [savedHistoryKey, setSavedHistoryKey] = useState<string | null>(null);
  const [isSavingHistory, setIsSavingHistory] = useState(false);
  const [showRestoreInput, setShowRestoreInput] = useState(false);
  const [historyIdToRestore, setHistoryIdToRestore] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [historyJustRestored, setHistoryJustRestored] = useState(false);

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
    setMessages,
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

  const nonSystemMessages = useMemo(() => messages.filter(m => m.role !== 'system'), [messages]);

  const lastAssistantMessageContent = useMemo(() => {
    const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];
    if (lastMessage?.role === 'assistant') {
      const codeBlockRegex = /```json\n?([\s\S]*?)\n?```/;
      const match = lastMessage.content.match(codeBlockRegex);

      if (match && match[1]) {
        const potentialJson = match[1].trim();
        try {
          JSON.parse(potentialJson);
          return potentialJson;
        } catch {
          return null;
        }
      }
    }
    return null;
  }, [nonSystemMessages]);

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
          if (item && (typeof item.name !== 'string' || item.name.trim() === '')) {
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
        setSavedHistoryKey(null);
        setHistoryJustRestored(false);
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

    const currentStateString = JSON.stringify(currentState, null, 2);
    const lastSentStateString = lastSentState ? JSON.stringify(lastSentState, null, 2) : null;
    let contentToSend = input;
    let shouldSendState = false;

    if (lastSentStateString === null || currentStateString !== lastSentStateString) {
        contentToSend = `${input}\n\n--- Current State ---\n\`\`\`json\n${currentStateString}\n\`\`\``;
        shouldSendState = true;
    } else {
        contentToSend = input;
    }

    void append({ role: "user", content: contentToSend });
    setInput("");
    setShouldAutoScroll(true);
    setSavedHistoryKey(null);
    setHistoryJustRestored(false);

    if (shouldSendState) {
      setLastSentState(currentState);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleFormSubmit(e);
    }
  };

  const handleProviderChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newProvider = event.target.value as "google" | "openai" | "xai";
    setAiProvider(newProvider);
    if (newProvider !== 'google') {
      setThinkingBudget(0);
    }
    setSavedHistoryKey(null);
  };

  const handleThinkingBudgetChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setThinkingBudget(parseInt(event.target.value, 10));
    setSavedHistoryKey(null);
  };

  const handleSaveHistory = async () => {
    if (nonSystemMessages.length === 0 || isSavingHistory) return;

    setIsSavingHistory(true);
    setSavedHistoryKey(null);

    try {
      const response = await fetch('/api/chat/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: nonSystemMessages }),
      });

      if (!response.ok) {
        const errorData = await response.json() as SaveHistoryErrorResponse;
        const errorMessage = typeof errorData === 'object' && errorData !== null && typeof errorData.error === 'string'
          ? errorData.error
          : `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json() as SaveHistorySuccessResponse;
      if (typeof data === 'object' && data !== null && typeof data.key === 'string' && data.key.trim() !== '') {
        setSavedHistoryKey(data.key);
        toast({
          title: "履歴保存成功",
          description: `キー: ${data.key}`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } else {
        console.error("Invalid response format from /api/chat/history:", data);
        throw new Error("サーバーから有効なキーが返されませんでした。");
      }
    } catch (error) {
      console.error("Failed to save chat history:", error);
      const description = error instanceof Error ? error.message : "履歴の保存中に不明なエラーが発生しました。";
      toast({ title: "履歴保存エラー", description, status: "error", duration: 5000, isClosable: true });
    } finally {
      setIsSavingHistory(false);
    }
  };

  const handleCopyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key)
      .then(() => {
        toast({
          title: "コピーしました",
          description: `キー "${key}" をクリップボードにコピーしました。`,
          status: "info",
          duration: 2000,
          isClosable: true,
        });
      })
      .catch((err) => {
        console.error("Failed to copy key:", err);
        toast({
          title: "コピー失敗",
          description: "クリップボードへのコピーに失敗しました。",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      });
  };

  const isHistoryIdValid = useMemo(() => {
    const regex = /^[0-9a-z]{8}$/;
    return regex.test(historyIdToRestore);
  }, [historyIdToRestore]);

  const handleRestoreHistory = async () => {
    if (!historyIdToRestore.trim() || isRestoring) return;
    setIsRestoring(true);

    try {
      const response = await fetch(`/api/chat/history/${historyIdToRestore}`);

      if (!response.ok) {
        const errorData = await response.json() as RestoreHistoryErrorResponse;
        const errorMessage = errorData?.error || `復元エラー (${response.status}): ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json() as RestoreHistorySuccessResponse;

      if (data?.messages != null && Array.isArray(data.messages)) {
        const formattedMessages = data.messages
          .filter(msg => msg.role !== 'tool' && typeof msg.content === 'string')
          .map(msg => ({
              id: uuidv4(),
              role: msg.role as 'system' | 'user' | 'assistant',
              content: msg.content as string,
          }));
        setMessages(formattedMessages);
        toast({
          title: "成功",
          description: "履歴を復元しました。",
          status: "success",
          duration: 3000,
          isClosable: true
        });
        setShowRestoreInput(false);
        setHistoryIdToRestore("");
        setHistoryJustRestored(true);
      } else {
        console.error("Invalid response format from /api/chat/history/KEY:", data);
        throw new Error("サーバーから無効な履歴データ形式が返されました。");
      }
    } catch (err) {
      console.error("Failed to restore history:", err);
      const description = err instanceof Error ? err.message : "履歴の復元に失敗しました。";
      toast({
        title: "復元エラー",
        description: description,
        status: "error",
        duration: 5000,
        isClosable: true
      });
    } finally {
      setIsRestoring(false);
    }
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
             <VStack spacing={3} align="stretch" width={{ base: "80%", sm: "250px" }}>
               <Button
                 onClick={onOpen}
                 size="sm"
                 variant="outline"
                 colorScheme="gray"
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

               {!showRestoreInput ? (
                 <Button
                   onClick={() => setShowRestoreInput(true)}
                   size="sm"
                   variant="outline"
                   colorScheme="gray"
                 >
                   履歴を復元
                 </Button>
               ) : (
                 <VStack spacing={2} align="stretch">
                   <Input
                     placeholder="履歴ID (英数字8桁)"
                     size="sm"
                     value={historyIdToRestore}
                     onChange={(e) => setHistoryIdToRestore(e.target.value)}
                     disabled={isRestoring}
                     focusBorderColor="teal.500"
                     isInvalid={historyIdToRestore.length > 0 && !isHistoryIdValid}
                     errorBorderColor="red.300"
                   />
                   <HStack spacing={2}>
                     <Button
                       onClick={handleRestoreHistory}
                       isLoading={isRestoring}
                       loadingText="復元中"
                       size="sm"
                       colorScheme="teal"
                       bg="teal.500"
                       color="white"
                       _hover={{ bg: 'teal.600' }}
                       flex={1}
                       isDisabled={!isHistoryIdValid || isRestoring}
                       _disabled={{
                         bg: 'teal.400',
                         color: 'white',
                         cursor: 'not-allowed',
                         opacity: 0.7,
                       }}
                     >
                       復元
                     </Button>
                     <Button
                       onClick={() => {
                         setShowRestoreInput(false);
                         setHistoryIdToRestore("");
                       }}
                       size="sm"
                       variant="outline"
                       colorScheme="gray"
                       disabled={isRestoring}
                       flex={1}
                     >
                       キャンセル
                     </Button>
                   </HStack>
                 </VStack>
               )}
             </VStack>
           </Flex>
        )}
        {nonSystemMessages
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
                <option value="xai">Grok (xAI)</option>
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

        <HStack width="full" mb={3} spacing={2}>
          {nonSystemMessages.length > 0 && !isLoading && !historyJustRestored && (
            savedHistoryKey !== null ? (
              <Flex
                align="center"
                justify="space-between"
                bg="gray.100"
                borderRadius="md"
                px={3}
                py={1.5}
                width="auto"
                flexGrow={1}
              >
                <Text fontSize="xs" fontWeight="medium" mr={2} whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                  履歴キー: {savedHistoryKey}
                </Text>
                <Button
                  aria-label="キーをコピー"
                  size="xs"
                  variant="ghost"
                  onClick={() => handleCopyToClipboard(savedHistoryKey)}
                  colorScheme="gray"
                  leftIcon={<Icon as={FiCopy} />}
                  px={2}
                  minW="auto"
                >
                  コピー
                </Button>
              </Flex>
            ) : (
              <Button
                onClick={handleSaveHistory}
                isLoading={isSavingHistory}
                loadingText="保存中"
                size="sm"
                colorScheme="gray"
                flexShrink={0}
                flexGrow={1}
              >
                履歴を保存
              </Button>
            )
          )}

          {lastAssistantMessageContent != null && !isLoading && (
            <Button
              onClick={handleApplyState}
              size="sm"
              colorScheme="green"
              bg="green.500"
              color="white"
              _hover={{ bg: 'green.600' }}
              flexShrink={0}
              flexGrow={1}
            >
              データを適用
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
        </HStack>

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