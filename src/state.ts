import { atom } from "jotai"
import { atomWithHash, atomWithLocation } from "jotai-location"
import lzstring from "lz-string"

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
}

export type PatternMode = "leave_deck" | "not_drawn" | "required"

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
}

export type LabelState = {
  labels: Array<Label>
}

type CalculationResultState = {
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

const urlSerializeOptions = {
  deserialize: (value: string) => JSON.parse(lzstring.decompressFromBase64(value)),
  serialize: (value: unknown) => lzstring.compressToBase64(JSON.stringify(value)),
}

export const locAtom = atomWithLocation()

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

export const potAtom = atomWithHash<PotState>("pot", defaultPotState, {
  ...urlSerializeOptions,
})

export const calculationResultAtom = atom<CalculationResultState | null>(null)
