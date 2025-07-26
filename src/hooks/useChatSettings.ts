import { useAtom } from "jotai"
import { ChangeEvent } from "react"

import type { AiProvider } from "../state"

import { aiProviderAtom } from "../state"

/**
 * チャットの設定（AIプロバイダーと思考予算）を管理するカスタムフック
 */
export const useChatSettings = (
  setThinkingBudget: (budget: number) => void,
  setSavedHistoryKey: (key: null | string) => void,
) => {
  // AIプロバイダーの状態
  const [aiProvider, setAiProvider] = useAtom(aiProviderAtom)

  /**
   * AIプロバイダー変更ハンドラ
   */
  const handleProviderChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newProvider = event.target.value as AiProvider
    setAiProvider(newProvider)
    setSavedHistoryKey(null)
  }

  /**
   * 思考予算変更ハンドラ
   */
  const handleThinkingBudgetChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setThinkingBudget(parseInt(event.target.value, 10))
    setSavedHistoryKey(null)
  }

  return {
    aiProvider,
    handleProviderChange,
    handleThinkingBudgetChange,
  }
}
