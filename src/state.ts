import type { Message } from "@ai-sdk/react"

import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import { atomWithHash, atomWithLocation } from "jotai-location"
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
  memo: string
  name: string
  uid: string
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
  memo: string
  name: string
  uid: string
}

export type LabelState = {
  labels: Array<Label>
}

export type CalculationResultState = {
  labelSuccessRates: { [label: string]: string }
  overallProbability: string
  patternSuccessRates: { [patternId: string]: string }
}

export type CalculationMode = "exact" | "simulation"

export type CalculationSettings = {
  mode: CalculationMode
  simulationTrials: number
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

const defaultCalculationSettings: CalculationSettings = {
  mode: "exact",
  simulationTrials: 10000,
}

// urlSerializeOptions を生成する関数に変更
const createUrlSerializeOptions = <T>(defaultValue: T, key?: string) => ({
  delay: 0,
  deserialize: (value: string): T => {
    try {
      const decompressed = lzstring.decompressFromBase64(value)
      if (decompressed == null || decompressed.trim() === "") {
        return defaultValue
      }
      const parsedValue: unknown = JSON.parse(decompressed)

      // patternAtom の場合のみ expanded を false に設定
      if (
        key === "pattern" &&
        typeof parsedValue === 'object' &&
        parsedValue !== null &&
        Object.prototype.hasOwnProperty.call(parsedValue, 'length') &&
        typeof (parsedValue as { length: unknown }).length === 'number' &&
        Object.prototype.hasOwnProperty.call(parsedValue, 'patterns') &&
        Array.isArray((parsedValue as { patterns: unknown }).patterns)
      ) {
        const patternState = parsedValue as PatternState
        patternState.patterns = patternState.patterns.map(
          (pattern) => ({
            ...pattern,
            expanded: false,
          })
        )
        return patternState as T
      }

      return parsedValue as T
    } catch (e) {
      console.error(`Error deserializing ${key} from URL hash, returning default value:`, e)
      return defaultValue
    }
  },
  serialize: (value: T) => lzstring.compressToBase64(JSON.stringify(value)),
})

export const locAtom = atomWithLocation()

// 各 atomWithHash で createUrlSerializeOptions を使用し、デフォルト値を渡す
// key 引数を追加して、どの atom かを deserialize 内で判別できるようにする
export const deckAtom = atomWithHash<DeckState>("deck", defaultDeckState, createUrlSerializeOptions(defaultDeckState, "deck"))

export const cardsAtom = atomWithHash<CardsState>(
  "cards",
  defaultCardsState,
  createUrlSerializeOptions(defaultCardsState, "cards"),
)

export const patternAtom = atomWithHash<PatternState>(
  "pattern",
  defaultPatternState,
  createUrlSerializeOptions(defaultPatternState, "pattern"),
)

export const labelAtom = atomWithHash<LabelState>(
  "label",
  defaultLabelState,
  createUrlSerializeOptions(defaultLabelState, "label"),
)

export const potAtom = atomWithHash<PotState>("pot", defaultPotState, createUrlSerializeOptions(defaultPotState, "pot"))

export const calculationSettingsAtom = atomWithStorage<CalculationSettings>("calculationSettings", defaultCalculationSettings)

export const calculationResultAtom = atom<CalculationResultState | null>(null)

export const isChatOpenAtom = atom(false)

const defaultChatMessages: Array<Message> = [SYSTEM_PROMPT_MESSAGE]
export const chatMessagesAtom = atom<Array<Message>>(defaultChatMessages)

export type AiProvider = "google"
export const aiProviderAtom = atomWithStorage<AiProvider>("aiProvider", "google")

// メモの一括開閉状態を管理するatom
export const isCardMemoExpandedAtom = atom(false)
export const isLabelMemoExpandedAtom = atom(false)

// システムプロンプト用の Atom を追加
export const systemPromptAtom = atomWithStorage<string>("systemPrompt", SYSTEM_PROMPT_MESSAGE.content)
