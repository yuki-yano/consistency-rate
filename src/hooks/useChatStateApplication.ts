import { useToast } from "@chakra-ui/react"
import { useAtomValue } from "jotai"
import { useMemo } from "react"

import type { CardsState, LabelState, PatternState } from "../state"

import { cardsAtom, deckAtom, labelAtom, patternAtom, potAtom } from "../state"

/**
 * チャットの応答から状態を適用するロジックを管理するカスタムフック
 */
export const useChatStateApplication = (
  lastAssistantMessageContent: null | string,
  setSavedHistoryKey: (key: null | string) => void,
  setHistoryJustRestored: (value: boolean) => void,
) => {
  const toast = useToast()

  // 現在の状態を取得
  const deck = useAtomValue(deckAtom)
  const cards = useAtomValue(cardsAtom)
  const pattern = useAtomValue(patternAtom)
  const pot = useAtomValue(potAtom)
  const label = useAtomValue(labelAtom)

  // 現在の状態をオブジェクトとしてまとめる
  const currentState = useMemo(
    () => ({
      cards,
      deck,
      label,
      pattern,
      pot,
    }),
    [deck, cards, pattern, pot, label],
  )

  /**
   * アシスタントの応答から状態を適用する
   */
  const handleApplyState = () => {
    if (lastAssistantMessageContent == null) {
      toast({
        description: "適用可能な応答が見つかりません。",
        duration: 3000,
        isClosable: true,
        status: "error",
        title: "適用エラー",
      })
      return
    }

    try {
      const stateToInject = JSON.parse(lastAssistantMessageContent)

      // 状態の検証
      const validateItems = (
        items: Array<{ name?: string } | undefined> | undefined,
        itemType: string,
      ): null | string => {
        if (!items) return null
        for (const item of items) {
          if (item && (typeof item.name !== "string" || item.name.trim() === "")) {
            return `${itemType}情報に必須の'name'プロパティがないか、空です。`
          }
        }
        return null
      }

      const cardsError = validateItems((stateToInject.cards as CardsState | undefined)?.cards, "カード")
      const patternsError = validateItems((stateToInject.pattern as PatternState | undefined)?.patterns, "パターン")
      const labelsError = validateItems((stateToInject.label as LabelState | undefined)?.labels, "ラベル")
      const validationError = cardsError ?? patternsError ?? labelsError ?? null

      if (validationError !== null) {
        console.warn("State validation error:", validationError)
        toast({
          description: validationError,
          duration: 5000,
          isClosable: true,
          status: "error",
          title: "適用エラー",
        })
        return
      }

      // グローバルに定義された状態注入関数を呼び出す
      if (window.injectFromState != null) {
        window.injectFromState(stateToInject)
        setSavedHistoryKey(null)
        setHistoryJustRestored(false)
        toast({
          description: "状態が適用されました。",
          duration: 3000,
          isClosable: true,
          status: "success",
          title: "成功",
        })
      } else {
        throw new Error("injectFromState関数が見つかりません。")
      }
    } catch (error) {
      console.error("Failed to parse or inject state:", error)
      const description = error instanceof Error ? error.message : "状態の適用中に不明なエラーが発生しました。"
      toast({
        description,
        duration: 5000,
        isClosable: true,
        status: "error",
        title: "適用エラー",
      })
    }
  }

  return {
    currentState,
    handleApplyState,
  }
}
