import type { CreateMessage } from "@ai-sdk/react"

import { KeyboardEvent, useState } from "react"

/**
 * チャットフォームの処理ロジックを管理するカスタムフック
 */
export const useChatForm = (
  input: string,
  isLoading: boolean,
  setInput: (input: string) => void,
  append: (message: CreateMessage) => Promise<null | string | undefined>,
  currentState: object,
  setShouldAutoScroll: (value: boolean) => void,
  setSavedHistoryKey: (key: null | string) => void,
  setHistoryJustRestored: (value: boolean) => void,
) => {
  // 最後に送信した状態を保持
  const [lastSentState, setLastSentState] = useState<null | object>(null)

  /**
   * フォーム送信ハンドラ
   * 入力内容と必要に応じて現在の状態を送信する
   */
  const handleFormSubmit = (e?: KeyboardEvent<HTMLTextAreaElement> | React.FormEvent<HTMLFormElement>) => {
    if (e) {
      e.preventDefault()
    }

    // 入力が空またはローディング中の場合は何もしない
    if (!input.trim() || isLoading) {
      return
    }

    // 現在の状態と最後に送信した状態を比較
    const currentStateString = JSON.stringify(currentState, null, 2)
    const lastSentStateString = lastSentState ? JSON.stringify(lastSentState, null, 2) : null
    let contentToSend = input
    let shouldSendState = false

    // 状態が変更されている場合、または初めての送信の場合は状態も一緒に送信
    if (lastSentStateString === null || currentStateString !== lastSentStateString) {
      contentToSend = `${input}\n\n--- Current State ---\n\`\`\`json\n${currentStateString}\n\`\`\``
      shouldSendState = true
    } else {
      contentToSend = input
    }

    // メッセージを送信
    void append({ content: contentToSend, role: "user" })
    setInput("")
    setShouldAutoScroll(true)
    setSavedHistoryKey(null)
    setHistoryJustRestored(false)

    // 状態を送信した場合は最後に送信した状態を更新
    if (shouldSendState) {
      setLastSentState(currentState)
    }
  }

  /**
   * キーボードイベントハンドラ
   * Ctrl+EnterまたはCmd+Enterでフォームを送信
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleFormSubmit(e)
    }
  }

  return {
    handleFormSubmit,
    handleKeyDown,
  }
}
