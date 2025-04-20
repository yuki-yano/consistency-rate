import { UseChatHelpers } from "@ai-sdk/react"
import { createContext, useContext } from "react"

export type ChatContextValue = UseChatHelpers & {
  thinkingBudget: number
  setThinkingBudget: React.Dispatch<React.SetStateAction<number>>
}

export const ChatContext = createContext<ChatContextValue | undefined>(undefined)

export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider")
  }
  return context
}
