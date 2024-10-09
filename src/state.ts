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
  name: string
  count: number
  uid: string
}

export type PatternMode = "required" | "leave_deck" | "not_drawn"

export type Condition = {
  uids: Array<string>
  count: number
  mode: PatternMode
}

export type Pattern = {
  uid: string
  conditions: Array<Condition>
  labels: Array<{
    uid: string
  }>
  priority: number
  name: string
  active: boolean
  expanded: boolean
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
  serialize: (value: unknown) => lzstring.compressToBase64(JSON.stringify(value)),
  deserialize: (value: string) => JSON.parse(lzstring.decompressFromBase64(value)),
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
