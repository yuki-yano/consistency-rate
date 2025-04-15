import { createContext, useContext } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';

type ChatContextType = UseChatHelpers | null;

export const ChatContext = createContext<ChatContextType>(null);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}; 