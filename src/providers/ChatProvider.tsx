import { useChat } from "@ai-sdk/react"
import { useToast } from "@chakra-ui/react"
import { useAtom, useAtomValue } from "jotai"
import { FC, useState } from "react"

import { ChatContext } from "../contexts/ChatContext"
import { aiProviderAtom, chatMessagesAtom, systemPromptAtom } from "../state"

type ChatProviderProps = {
  children: React.ReactNode
}

export const ChatProvider: FC<ChatProviderProps> = ({ children }) => {
  const [persistedMessages] = useAtom(chatMessagesAtom)
  const selectedProvider = useAtomValue(aiProviderAtom)
  const toast = useToast()
  const [thinkingBudget, setThinkingBudget] = useState<number>(0)
  const [systemPrompt] = useAtom(systemPromptAtom)

  const chatHelpers = useChat({
    api: "/api/chat",
    body: {
      provider: selectedProvider,
      systemPrompt: systemPrompt,
      thinkingBudget: selectedProvider === "google" ? thinkingBudget : undefined,
    },
    initialMessages: persistedMessages,
    onError: (err) => {
      console.error("Chat error:", err)
      toast({ description: err.message, duration: 5000, isClosable: true, status: "error", title: "チャットエラー" })
    },
  })

  return (
    <ChatContext.Provider value={{ ...chatHelpers, setThinkingBudget, thinkingBudget }}>
      {children}
    </ChatContext.Provider>
  )
}
