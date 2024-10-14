import { atom } from "jotai"
import { atomWithHash } from "jotai-location"
import lzstring from "lz-string"

export type DeckState = {
  cardCount: number
  firstHand: number
}

export type CardsState = {
  cards: Array<CardData>
}

export type CardData = {
  count: number
  name: string
  uid: string
}

export type PatternMode = "leave_deck" | "not_drawn" | "required"

export type Condition = {
  count: number
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
  name: string
  priority: number
  uid: string
}

export type PatternState = {
  patterns: Array<Pattern>
}

export type LabelState = {
  labels: Array<{
    name: string
    uid: string
  }>
}

type CalculationResultState = {
  labelSuccessRates: { [label: string]: string }
  overallProbability: string
  patternSuccessRates: { [patternId: string]: string }
}

const defaultDeckState: DeckState = {
  cardCount: 40,
  firstHand: 5,
}

const defaultCardsState: CardsState = {
  cards: [],
}

const defaultPatternState: PatternState = {
  patterns: [],
}

const defaultLabelState: LabelState = {
  labels: [],
}

const urlSerializeOptions = {
  deserialize: (value: string) => JSON.parse(lzstring.decompressFromBase64(value)),
  serialize: (value: unknown) => lzstring.compressToBase64(JSON.stringify(value)),
}

export const deckAtom = atomWithHash<DeckState>("deck", defaultDeckState, {
  ...urlSerializeOptions,
})

export const cardsAtom = atomWithHash<CardsState>("cards", defaultCardsState, {
  ...urlSerializeOptions,
})

export const patternAtom = atomWithHash<PatternState>("pattern", defaultPatternState, {
  ...urlSerializeOptions,
})

export const labelAtom = atomWithHash<LabelState>("label", defaultLabelState, {
  ...urlSerializeOptions,
})

export const calculationResultAtom = atom<CalculationResultState | null>(null)