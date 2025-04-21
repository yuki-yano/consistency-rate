import type { Message } from "@ai-sdk/react"

import { useToast } from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { v4 as uuidv4 } from "uuid"

import { restoreChatHistory, saveChatHistory } from "../fetch"

export const useChatHistoryManagement = (
  nonSystemMessages: Array<Message>,
  setMessages: (messages: Array<Message>) => void,
) => {
  const toast = useToast()
  const [savedHistoryKey, setSavedHistoryKey] = useState<null | string>(null)
  const [isSavingHistory, setIsSavingHistory] = useState(false)
  const [showRestoreInput, setShowRestoreInput] = useState(false)
  const [historyIdToRestore, setHistoryIdToRestore] = useState("")
  const [isRestoring, setIsRestoring] = useState(false)
  const [historyJustRestored, setHistoryJustRestored] = useState(false)

  const isHistoryIdValid = useMemo(() => {
    const regex = /^[0-9a-z]{8}$/
    return regex.test(historyIdToRestore)
  }, [historyIdToRestore])

  const handleSaveHistory = async () => {
    if (nonSystemMessages.length === 0 || isSavingHistory) return

    setIsSavingHistory(true)
    setSavedHistoryKey(null)

    try {
      const key = await saveChatHistory(nonSystemMessages)
      setSavedHistoryKey(key)
      toast({
        description: `キー: ${key}`,
        duration: 3000,
        isClosable: true,
        status: "success",
        title: "履歴保存成功",
      })
    } catch (error) {
      console.error("Error in handleSaveHistory: Failed to save chat history:", error)
      const description = error instanceof Error ? error.message : "履歴の保存中に不明なエラーが発生しました。"
      toast({ description, duration: 5000, isClosable: true, status: "error", title: "履歴保存エラー" })
    } finally {
      setIsSavingHistory(false)
    }
  }

  const handleCopyToClipboard = (key: string) => {
    navigator.clipboard
      .writeText(key)
      .then(() => {
        toast({
          description: `キー "${key}" をクリップボードにコピーしました。`,
          duration: 2000,
          isClosable: true,
          status: "info",
          title: "コピーしました",
        })
      })
      .catch((err) => {
        console.error("Failed to copy key:", err)
        toast({
          description: "クリップボードへのコピーに失敗しました。",
          duration: 3000,
          isClosable: true,
          status: "error",
          title: "コピー失敗",
        })
      })
  }

  const handleRestoreHistory = async () => {
    if (!historyIdToRestore.trim() || isRestoring) return
    setIsRestoring(true)

    try {
      const restoredMessages = await restoreChatHistory(historyIdToRestore)

      const formattedMessages = restoredMessages
        .filter((msg) => typeof msg.content === "string")
        .map((msg) => ({
          content: msg.content as string,
          id: uuidv4(),
          role: msg.role as "assistant" | "system" | "user",
        }))

      setMessages(formattedMessages)
      toast({
        description: "履歴を復元しました。",
        duration: 3000,
        isClosable: true,
        status: "success",
        title: "成功",
      })
      setShowRestoreInput(false)
      setHistoryIdToRestore("")
      setHistoryJustRestored(true)
    } catch (err) {
      console.error("Error in handleRestoreHistory: Failed to restore history:", err)
      const description = err instanceof Error ? err.message : "履歴の復元に失敗しました。"
      toast({
        description: description,
        duration: 5000,
        isClosable: true,
        status: "error",
        title: "復元エラー",
      })
    } finally {
      setIsRestoring(false)
    }
  }

  return {
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
  }
}
