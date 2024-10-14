import { sprintf } from "sprintf-js"

import { CardsState, DeckState, Pattern, PatternState } from "./state"

const checkPatternConditions = (
  drawnCards: Array<{ name: string; uid: string }>,
  pattern: Pattern,
  totalDeckCount: number,
) => {
  if (!pattern.active) {
    return false
  }

  return pattern.conditions.every((condition) => {
    const drawnCount = drawnCards.filter((card) => condition.uids.includes(card.uid)).length

    if (condition.mode === "required") {
      return drawnCount >= condition.count
    }

    if (condition.mode === "leave_deck") {
      const remainingDeckCount = totalDeckCount - drawnCards.length
      return remainingDeckCount >= condition.count
    }

    if (condition.mode === "not_drawn") {
      const notDrawnCount = condition.uids.filter((uid) => !drawnCards.some((drawn) => drawn.uid === uid)).length
      return notDrawnCount === condition.uids.length
    }

    return false
  })
}

export const calculateProbability = (deck: DeckState, card: CardsState, pattern: PatternState, trials: number) => {
  const { cardCount, firstHand } = deck
  const { cards } = card
  const { patterns } = pattern

  const totalDeckCards = cards.reduce((total, c) => total + c.count, 0)
  const fullDeck: Array<{ name: string; uid: string }> = []

  for (const c of cards) {
    for (let i = 0; i < c.count; i++) {
      fullDeck.push({ name: c.name, uid: c.uid })
    }
  }

  const unknownCardCount = cardCount - totalDeckCards
  if (unknownCardCount > 0) {
    const unknownCard = { name: "unknown", uid: "unknown_card" }
    for (let i = 0; i < unknownCardCount; i++) {
      fullDeck.push(unknownCard)
    }
  }

  let successCount = 0
  const labelSuccessCount: { [label: string]: number } = {}
  const patternSuccessCount: { [patternId: string]: number } = {}

  for (let i = 0; i < trials; i++) {
    const shuffledDeck = fullDeck.slice()
    for (let i = shuffledDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffledDeck[i], shuffledDeck[j]] = [shuffledDeck[j], shuffledDeck[i]]
    }

    const drawnCards = shuffledDeck.slice(0, firstHand)
    const matches = patterns.filter((pattern) => checkPatternConditions(drawnCards, pattern, totalDeckCards))

    if (matches.length > 0) {
      successCount++

      const countedLabels = new Set<string>()
      for (const match of matches) {
        const patternId = match.uid
        if (!patternSuccessCount[patternId]) {
          patternSuccessCount[patternId] = 0
        }
        patternSuccessCount[patternId]++

        if (match.labels?.length > 0) {
          for (const label of match.labels) {
            if (label.uid === "" || countedLabels.has(label.uid)) {
              continue
            }
            countedLabels.add(label.uid)
            if (!labelSuccessCount[label.uid]) {
              labelSuccessCount[label.uid] = 0
            }
            labelSuccessCount[label.uid]++
          }
        }
      }
    }
  }

  const overallProbability = (successCount / trials) * 100

  const labelSuccessRates: { [label: string]: string } = {}
  for (const label in labelSuccessCount) {
    labelSuccessRates[label] = sprintf("%.2f", (labelSuccessCount[label] / trials) * 100)
  }

  const patternSuccessRates: { [patternId: string]: string } = {}
  for (const patternId in patternSuccessCount) {
    patternSuccessRates[patternId] = sprintf("%.2f", (patternSuccessCount[patternId] / trials) * 100)
  }

  const sortedLabelSuccessRates = Object.entries(labelSuccessRates)
    .sort(([, a], [, b]) => Number.parseFloat(b) - Number.parseFloat(a))
    .reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {})

  const sortedPatternSuccessRates = Object.entries(patternSuccessRates)
    .sort(([, a], [, b]) => Number.parseFloat(b) - Number.parseFloat(a))
    .reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {})

  return {
    labelSuccessRates: sortedLabelSuccessRates,
    overallProbability: sprintf("%.2f", overallProbability),
    patternSuccessRates: sortedPatternSuccessRates,
  }
}
