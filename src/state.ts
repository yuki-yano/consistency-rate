import type { Message } from "@ai-sdk/react"
import { atom } from "jotai"
import { atomWithHash, atomWithLocation } from "jotai-location"
import { atomWithStorage } from "jotai/utils"
import lzstring from "lz-string"
import { SYSTEM_PROMPT_MESSAGE } from "./const"

export type DeckState = {
  cardCount: number
  firstHand: number
}

export type CardsState = {
  cards: Array<CardData>
  length: number
}

export type CardData = {
  count: number
  name: string
  uid: string
  memo: string
}

export type PatternMode = "leave_deck" | "not_drawn" | "required" | "required_distinct"

export type Condition = {
  count: number
  invalid: boolean
  mode: PatternMode
  uids: Array<string>
}

export type Pattern = {
  active: boolean
  conditions: Array<Condition>
  expanded: boolean
  labels: Array<{
    uid: string
  }>
  memo: string
  name: string
  priority: number
  uid: string
}

export type PatternState = {
  length: number
  patterns: Array<Pattern>
}

export type Label = {
  name: string
  uid: string
  memo: string
}

export type LabelState = {
  labels: Array<Label>
}

export type CalculationResultState = {
  labelSuccessRates: { [label: string]: string }
  overallProbability: string
  patternSuccessRates: { [patternId: string]: string }
}

export type PotState = {
  desiresOrExtravagance: {
    count: number
    priority: number
  }
  prosperity: {
    cost: 3 | 6
    count: number
    priority: number
  }
}

const defaultDeckState: DeckState = {
  cardCount: 40,
  firstHand: 5,
}

const defaultCardsState: CardsState = {
  cards: [],
  length: 0,
}

const defaultPatternState: PatternState = {
  length: 0,
  patterns: [],
}

const defaultLabelState: LabelState = {
  labels: [],
}

const defaultPotState: PotState = {
  desiresOrExtravagance: {
    count: 0,
    priority: 2,
  },
  prosperity: {
    cost: 6,
    count: 0,
    priority: 1,
  },
}

// urlSerializeOptions を生成する関数に変更
const createUrlSerializeOptions = <T>(defaultValue: T) => ({
  deserialize: (value: string): T => {
    try {
      const decompressed = lzstring.decompressFromBase64(value)
      // null または空文字列チェック
      if (decompressed == null || decompressed.trim() === "") {
        // console.warn("Decompressed value is null or empty, returning default.");
        return defaultValue
      }
      return JSON.parse(decompressed) as T
    } catch (e) {
      // パースエラー時もデフォルト値を返す
      console.error("Failed to parse URL hash, returning default value:", e)
      return defaultValue
    }
  },
  serialize: (value: T) => lzstring.compressToBase64(JSON.stringify(value)),
  delay: 0,
})

export const locAtom = atomWithLocation()

// 各 atomWithHash で createUrlSerializeOptions を使用し、デフォルト値を渡す
export const deckAtom = atomWithHash<DeckState>("deck", defaultDeckState, createUrlSerializeOptions(defaultDeckState))

export const cardsAtom = atomWithHash<CardsState>(
  "cards",
  defaultCardsState,
  createUrlSerializeOptions(defaultCardsState),
)

export const patternAtom = atomWithHash<PatternState>(
  "pattern",
  defaultPatternState,
  createUrlSerializeOptions(defaultPatternState),
)

export const labelAtom = atomWithHash<LabelState>(
  "label",
  defaultLabelState,
  createUrlSerializeOptions(defaultLabelState),
)

export const potAtom = atomWithHash<PotState>("pot", defaultPotState, createUrlSerializeOptions(defaultPotState))

export const calculationResultAtom = atom<CalculationResultState | null>(null)

export const isChatOpenAtom = atom(false)

const defaultChatMessages: Array<Message> = [SYSTEM_PROMPT_MESSAGE]
export const chatMessagesAtom = atom<Array<Message>>(defaultChatMessages)

export type AiProvider = "google" | "openai" | "xai"
export const aiProviderAtom = atomWithStorage<AiProvider>("aiProvider", "google")

// メモの一括開閉状態を管理するatom
export const isCardMemoExpandedAtom = atom(false)
export const isLabelMemoExpandedAtom = atom(false)

// システムプロンプト用の Atom を追加
export const systemPromptAtom = atomWithStorage<string>("systemPrompt", SYSTEM_PROMPT_MESSAGE.content)
