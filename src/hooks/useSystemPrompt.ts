import { useToast } from "@chakra-ui/react"
import { useAtom } from "jotai"
import { useEffect, useState } from "react"

import { SYSTEM_PROMPT_MESSAGE } from "../const"
import { systemPromptAtom } from "../state"

/**
 * システムプロンプトの管理を担当するカスタムフック
 */
export const useSystemPrompt = (isOpen: boolean) => {
  // システムプロンプトの状態
  const [systemPrompt, setSystemPrompt] = useAtom(systemPromptAtom)
  // モーダル内で編集中のプロンプト
  const [localPrompt, setLocalPrompt] = useState(systemPrompt)
  const toast = useToast()
  // デフォルトのプロンプト内容
  const defaultPromptContent = SYSTEM_PROMPT_MESSAGE.content

  // モーダルが開かれたときに現在のシステムプロンプトをローカル状態に設定
  useEffect(() => {
    if (isOpen) {
      setLocalPrompt(systemPrompt)
    }
  }, [isOpen, systemPrompt])

  /**
   * システムプロンプトを保存する
   */
  const handleSave = (onClose: () => void) => {
    setSystemPrompt(localPrompt)
    toast({
      duration: 2000,
      isClosable: true,
      status: "success",
      title: "保存しました",
    })
    onClose()
  }

  /**
   * システムプロンプトをデフォルトに戻す
   */
  const handleResetToDefault = () => {
    setLocalPrompt(defaultPromptContent)
    toast({
      duration: 2000,
      isClosable: true,
      status: "info",
      title: "デフォルトに戻しました",
    })
  }

  return {
    handleResetToDefault,
    handleSave,
    localPrompt,
    setLocalPrompt,
  }
}
