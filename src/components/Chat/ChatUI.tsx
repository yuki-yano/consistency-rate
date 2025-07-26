import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  Select,
  Spinner,
  Text,
  Textarea,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import { useAtomValue, useSetAtom } from "jotai";
import { ChangeEvent, FC } from "react";
import { FiCopy } from "react-icons/fi";
import { VscClose } from "react-icons/vsc";
import TextareaAutosize from 'react-textarea-autosize';

import { useChatCore } from "../../hooks/useChatCore";
import { useChatForm } from "../../hooks/useChatForm";
import { useChatHistoryManagement } from "../../hooks/useChatHistoryManagement";
import { useChatScroll } from "../../hooks/useChatScroll";
import { useChatSettings } from "../../hooks/useChatSettings";
import { useChatStateApplication } from "../../hooks/useChatStateApplication";
import { isChatOpenAtom } from "../../state";
import { SystemPromptModal } from "./SystemPromptModal";

const ChatUIInternal: FC = () => {
  const setIsChatOpen = useSetAtom(isChatOpenAtom);
  const { isOpen, onClose, onOpen } = useDisclosure();

  const {
    append,
    error,
    handleInputChange,
    input,
    isLoading,
    lastAssistantMessageContent,
    nonSystemMessages,
    reload,
    setInput,
    setMessages, // 追加
    setThinkingBudget,
    stop,
    thinkingBudget,
  } = useChatCore();

  const {
    handleScroll,
    scrollRef,
    setShouldAutoScroll,
  } = useChatScroll();

  const {
    handleCopyToClipboard,
    handleRestoreHistory,
    handleSaveHistory,
    historyIdToRestore,
    historyJustRestored,
    isHistoryIdValid,
    isRestoring,
    isSavingHistory,
    savedHistoryKey,
    setHistoryIdToRestore,
    setHistoryJustRestored,
    setSavedHistoryKey,
    setShowRestoreInput,
    showRestoreInput,
  } = useChatHistoryManagement(nonSystemMessages, setMessages);

  const {
    currentState,
    handleApplyState,
  } = useChatStateApplication(
    lastAssistantMessageContent,
    setSavedHistoryKey,
    setHistoryJustRestored
  );

  const {
    handleFormSubmit,
    handleKeyDown,
  } = useChatForm(
    input,
    isLoading,
    setInput,
    append,
    currentState,
    setShouldAutoScroll,
    setSavedHistoryKey,
    setHistoryJustRestored
  );

  const {
    aiProvider,
    handleProviderChange,
    handleThinkingBudgetChange,
  } = useChatSettings(setThinkingBudget, setSavedHistoryKey);

  return (
    <Box
      bg="white"
      borderBottomRadius={{ base: 0, md: 'md' }}
      borderColor="gray.200"
      borderTopRadius={{ base: 'md', md: 'md' }}
      borderWidth="2px"
      bottom={{ base: 0, md: 6 }}
      boxShadow="lg"
      display="flex"
      flexDirection="column"
      height={{ base: '85vh', md: '800px' }}
      left={{ base: 2, md: 'auto' }}
      position="fixed"
      right={{ base: 2, md: 6 }}
      width={{ md: '600px' }}
      zIndex={1300}
    >
      <Flex align="center" borderBottomWidth="1px" justify="space-between" p={4}>
        <Heading size="md">チャット</Heading>
        <IconButton
          aria-label="チャットを閉じる"
          icon={<Icon as={VscClose} />}
          onClick={() => setIsChatOpen(false)}
          size="sm"
          variant="ghost"
        />
      </Flex>

      <VStack
        align="stretch"
        flex={1}
        onScroll={handleScroll}
        overflowY="auto"
        p={4}
        ref={scrollRef}
        spacing={4}
      >
        {nonSystemMessages.length === 0 && !isLoading && (
           <Flex align="center" direction="column" height="100%" justify="center" p={4}>
             <Text color="gray.500" mb={4} textAlign="center">
               メッセージを送信してください。
             </Text>
             <VStack align="stretch" spacing={3} width={{ base: "80%", sm: "250px" }}>
               <Button
                 _disabled={{
                   bg: 'blue.300',
                   color: 'white',
                   cursor: 'not-allowed',
                   opacity: 0.7,
                 }}
                 colorScheme="gray"
                 disabled={isLoading}
                 onClick={onOpen}
                 size="sm"
                 variant="outline"
               >
                 システムプロンプトを編集
               </Button>

               {!showRestoreInput ? (
                 <Button
                   colorScheme="gray"
                   onClick={() => setShowRestoreInput(true)}
                   size="sm"
                   variant="outline"
                 >
                   履歴を復元
                 </Button>
               ) : (
                 <VStack align="stretch" spacing={2}>
                   <Input
                     disabled={isRestoring}
                     errorBorderColor="red.300"
                     focusBorderColor="teal.500"
                     isInvalid={historyIdToRestore.length > 0 && !isHistoryIdValid}
                     onChange={(e) => setHistoryIdToRestore(e.target.value)}
                     placeholder="履歴ID (英数字8桁)"
                     size="sm"
                     value={historyIdToRestore}
                   />
                   <HStack spacing={2}>
                     <Button
                       _disabled={{
                         bg: 'teal.400',
                         color: 'white',
                         cursor: 'not-allowed',
                         opacity: 0.7,
                       }}
                       _hover={{ bg: 'teal.600' }}
                       bg="teal.500"
                       color="white"
                       colorScheme="teal"
                       flex={1}
                       isDisabled={!isHistoryIdValid || isRestoring}
                       isLoading={isRestoring}
                       loadingText="復元中"
                       onClick={handleRestoreHistory}
                       size="sm"
                     >
                       復元
                     </Button>
                     <Button
                       colorScheme="gray"
                       disabled={isRestoring}
                       flex={1}
                       onClick={() => {
                         setShowRestoreInput(false);
                         setHistoryIdToRestore("");
                       }}
                       size="sm"
                       variant="outline"
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
            let justify: "flex-end" | "flex-start";
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
                <Text fontSize="sm" whiteSpace="pre-wrap">
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
                      <Text fontSize="sm" whiteSpace="pre-wrap">
                        {textBeforeJson}
                      </Text>
                    )}
                    <Flex align="center">
                      <Spinner mr={2} size="sm" speed="0.65s" />
                      <Text color="gray.600" fontSize="sm" fontStyle="italic">データ生成中...</Text>
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
                    fontFamily={useMonospace ? "monospace" : "inherit"}
                    fontSize="sm"
                    whiteSpace="pre-wrap"
                  >
                    {assistantText}
                  </Text>
                );
              }
            } else {
              return null;
            }

            return (
              <Flex justify={justify} key={m.id} w="full">
                <Box
                  bg={bgColor}
                  borderRadius="lg"
                  color={textColor}
                  maxW="85%"
                  px={3}
                  py={1.5}
                >
                  {displayElement}
                </Box>
              </Flex>
            );
          })
        }
        {error && (
          <Flex align="center" color="red.500" direction="column" mt={4}>
            <Text fontSize="sm">エラーが発生しました。</Text>
            <Button mt={1} onClick={() => reload()} size="xs">再試行</Button>
          </Flex>
        )}
      </VStack>

      <Box borderTopWidth="1px" p={4}>
        {nonSystemMessages.length === 0 && (
          <Flex align="flex-end" justify="space-between" mb={2}>
            <FormControl flex="1" mr={2}>
              <FormLabel fontSize="xs" htmlFor="ai-provider" mb={0} mr={2} whiteSpace="nowrap">AI Provider:</FormLabel>
              <Select
                borderRadius="md"
                disabled={isLoading}
                focusBorderColor="blue.500"
                id="ai-provider"
                onChange={handleProviderChange}
                size="sm"
                value={aiProvider}
              >
                <option value="google">Google</option>
              </Select>
            </FormControl>

            <FormControl
              flex="1"
              isDisabled={isLoading}
              mr={3}
            >
              <FormLabel fontSize="xs" htmlFor="thinking-budget" mb={0} mr={2} whiteSpace="nowrap">Thinking Budget:</FormLabel>
              <Select
                borderRadius="md"
                disabled={isLoading}
                focusBorderColor="blue.500"
                id="thinking-budget"
                onChange={handleThinkingBudgetChange}
                size="sm"
                value={thinkingBudget}
              >
                <option value={0}>0</option>
                <option value={1024}>1024</option>
                <option value={8192}>8192</option>
              </Select>
            </FormControl>
          </Flex>
        )}

        <HStack mb={3} spacing={2} width="full">
          {nonSystemMessages.length > 0 && !isLoading && !historyJustRestored && (
            savedHistoryKey !== null ? (
              <Flex
                align="center"
                bg="gray.100"
                borderRadius="md"
                flexGrow={1}
                justify="space-between"
                px={3}
                py={1.5}
                width="auto"
              >
                <Text fontSize="xs" fontWeight="medium" mr={2} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                  履歴キー: {savedHistoryKey}
                </Text>
                <Button
                  aria-label="キーをコピー"
                  colorScheme="gray"
                  leftIcon={<Icon as={FiCopy} />}
                  minW="auto"
                  onClick={() => handleCopyToClipboard(savedHistoryKey)}
                  px={2}
                  size="xs"
                  variant="ghost"
                >
                  コピー
                </Button>
              </Flex>
            ) : (
              <Button
                colorScheme="gray"
                flexGrow={1}
                flexShrink={0}
                isLoading={isSavingHistory}
                loadingText="保存中"
                onClick={handleSaveHistory}
                size="sm"
              >
                履歴を保存
              </Button>
            )
          )}

          {lastAssistantMessageContent != null && !isLoading && (
            <Button
              _hover={{ bg: 'green.600' }}
              bg="green.500"
              color="white"
              colorScheme="green"
              flexGrow={1}
              flexShrink={0}
              onClick={handleApplyState}
              size="sm"
            >
              データを適用
            </Button>
          )}

          {isLoading && (
            <Button
              colorScheme="red"
              onClick={stop}
              size="sm"
              variant="outline"
              width="full"
            >
              停止
            </Button>
          )}
        </HStack>

        <form onSubmit={handleFormSubmit}>
          <Flex align="flex-end">
            <Textarea
              _focus={{ borderColor: 'blue.500', boxShadow: 'outline' }}
              as={TextareaAutosize}
              borderRadius="md"
              borderWidth="1px"
              disabled={isLoading}
              maxRows={5}
              minRows={1}
              mr={2}
              onChange={handleInputChange as (e: ChangeEvent<HTMLTextAreaElement>) => void}
              onKeyDown={handleKeyDown}
              p={2}
              placeholder="メッセージを入力 (Ctrl+Enter or Cmd+Enter で送信)"
              size="sm"
              sx={{
                overflowY: 'auto'
              }}
              value={input}
            />
            <Button
              _disabled={{
                bg: 'blue.300',
                color: 'white',
                cursor: 'not-allowed',
                opacity: 0.7,
              }}
              _hover={{
                bg: !input.trim() ? 'blue.300' : 'blue.600',
              }}
              bg="blue.500"
              color="white"
              colorScheme="blue"
              disabled={!input.trim()}
              isLoading={isLoading}
              size="sm"
              type="submit"
            >
              送信
            </Button>
          </Flex>
        </form>
      </Box>

      <SystemPromptModal isOpen={isOpen} onClose={onClose} />
    </Box>
  );
};

export const ChatUI: FC = () => {
  const isChatOpen = useAtomValue(isChatOpenAtom);
  return isChatOpen ? <ChatUIInternal /> : null;
};
