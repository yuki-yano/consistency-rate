import { sprintf } from "sprintf-js"

import { CardsState, DeckState, Pattern, PatternState, PotState } from "./state"

const checkPatternConditions = (
  drawnCards: Array<{ name: string; uid: string }>,
  shuffledDeck: Array<{ name: string; uid: string }>,
  pattern: Pattern,
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
      const remainingCountInDeck = shuffledDeck.filter((card) => condition.uids.includes(card.uid)).length
      return remainingCountInDeck >= condition.count
    }

    if (condition.mode === "not_drawn") {
      const notDrawnCount = condition.uids.filter((uid) => !drawnCards.some((drawn) => drawn.uid === uid)).length
      return notDrawnCount === condition.uids.length
    }

    return false
  })
}

export const calculateProbability = (
  deck: DeckState,
  card: CardsState,
  pattern: PatternState,
  trials: number,
  pot: PotState,
) => {
  const { cardCount, firstHand } = deck
  const { cards } = card
  const { patterns } = pattern

  const sortedPatterns = patterns
    .filter((pattern) => pattern.active)
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      return patterns.indexOf(a) - patterns.indexOf(b)
    })

  const totalDeckCards = cards.reduce((total, c) => total + c.count, 0)
  const fullDeck: Array<{ name: string; uid: string }> = []

  for (let i = 0; i < pot.prosperity.count; i++) {
    const prosperityCard = { name: "prosperity", uid: "prosperity_card" }
    fullDeck.push(prosperityCard)
  }

  for (let i = 0; i < pot.desiresOrExtravagance.count; i++) {
    const desiresCard = { name: "desires", uid: "desires_card" }
    fullDeck.push(desiresCard)
  }

  for (const c of cards) {
    for (let i = 0; i < c.count; i++) {
      fullDeck.push({ name: c.name, uid: c.uid })
    }
  }

  const unknownCardCount = cardCount - totalDeckCards - 1
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
    let shuffledDeck = fullDeck.slice()
    for (let j = shuffledDeck.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1))
      ;[shuffledDeck[j], shuffledDeck[k]] = [shuffledDeck[k], shuffledDeck[j]]
    }

    const drawnCards = shuffledDeck.slice(0, firstHand)

    shuffledDeck = shuffledDeck.slice(firstHand)

    if (
      !drawnCards.some((card) => card.uid === "prosperity_card") &&
      drawnCards.some((card) => card.uid === "desires_card") &&
      pot.desiresOrExtravagance.count > 0
    ) {
      const drawnCount = 2
      const additionalDrawnCards = shuffledDeck.slice(0, drawnCount)
      drawnCards.push(...additionalDrawnCards)

      shuffledDeck = shuffledDeck.slice(drawnCount)
    }

    if (drawnCards.some((card) => card.uid === "prosperity_card")) {
      const cost = pot.prosperity.cost
      const extraCards = shuffledDeck.slice(firstHand, firstHand + cost)
      let matches: Array<Pattern> = []
      const isPatternCounted: {
        [uid: string]: boolean
        overAll: boolean
      } = {
        overAll: false,
      }

      for (const cardToAdd of extraCards) {
        const newDrawnCards = [...drawnCards, cardToAdd]
        matches = sortedPatterns.filter((pattern) => checkPatternConditions(newDrawnCards, shuffledDeck, pattern))

        if (matches.length > 0) {
          if (!isPatternCounted["overAll"]) {
            successCount++
            isPatternCounted["overAll"] = true
          }

          const matchedLabels = new Set<string>()

          for (const match of matches) {
            const patternId = match.uid
            if (patternSuccessCount[patternId] == null) {
              patternSuccessCount[patternId] = 0
            }
            if (!isPatternCounted[patternId]) {
              patternSuccessCount[patternId]++
              isPatternCounted[patternId] = true
            }

            if (match.labels?.length > 0) {
              for (const label of match.labels) {
                if (!matchedLabels.has(label.uid)) {
                  matchedLabels.add(label.uid)
                  if (!labelSuccessCount[label.uid]) {
                    labelSuccessCount[label.uid] = 0
                  }
                  labelSuccessCount[label.uid]++
                }
              }
            }
          }
        }
      }
    } else {
      const matches = sortedPatterns.filter((pattern) => checkPatternConditions(drawnCards, shuffledDeck, pattern))

      if (matches.length > 0) {
        successCount++

        const matchedLabels = new Set<string>()

        for (const match of matches) {
          const patternId = match.uid
          if (patternSuccessCount[patternId] == null) {
            patternSuccessCount[patternId] = 0
          }
          patternSuccessCount[patternId]++

          if (match.labels?.length > 0) {
            for (const label of match.labels) {
              if (!matchedLabels.has(label.uid)) {
                matchedLabels.add(label.uid)
                if (!labelSuccessCount[label.uid]) {
                  labelSuccessCount[label.uid] = 0
                }
                labelSuccessCount[label.uid]++
              }
            }
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
