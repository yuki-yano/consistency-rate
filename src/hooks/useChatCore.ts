import { useAtom, useAtomValue } from "jotai"
import { useMemo, useState } from "react"

import { useChatContext } from "../contexts/ChatContext"
import { aiProviderAtom, systemPromptAtom } from "../state"

/**
 * チャットの基本機能を提供するカスタムフック
 * メッセージ、入力、ローディング状態などの基本的なチャット機能を管理する
 */
export const useChatCore = () => {
  // ChatProviderで使用されるため、ここでは不要
  // const [persistedMessages] = useAtom(chatMessagesAtom);
  const selectedProvider = useAtomValue(aiProviderAtom)
  const [systemPrompt] = useAtom(systemPromptAtom)
  const [thinkingBudget, setThinkingBudget] = useState<number>(0)

  const { append, error, handleInputChange, input, isLoading, messages, reload, setInput, setMessages, stop } =
    useChatContext()

  // システムメッセージを除いたメッセージリスト
  const nonSystemMessages = useMemo(() => messages.filter((m) => m.role !== "system"), [messages])

  // 最後のアシスタントメッセージからJSONコンテンツを抽出
  const lastAssistantMessageContent = useMemo(() => {
    const lastMessage = nonSystemMessages[nonSystemMessages.length - 1]
    if (lastMessage?.role === "assistant") {
      const codeBlockRegex = /```json\n?([\s\S]*?)\n?```/
      const match = lastMessage.content.match(codeBlockRegex)

      if (match && match[1]) {
        const potentialJson = match[1].trim()
        try {
          JSON.parse(potentialJson)
          return potentialJson
        } catch {
          return null
        }
      }
    }
    return null
  }, [nonSystemMessages])

  return {
    append,
    error,
    handleInputChange,
    input,
    isLoading,
    lastAssistantMessageContent,
    messages,
    nonSystemMessages,
    reload,
    selectedProvider,
    setInput,
    setMessages,
    setThinkingBudget,
    stop,
    systemPrompt,
    thinkingBudget,
  }
}
