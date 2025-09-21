import { sprintf } from "sprintf-js"

import { CardsState, DeckState, Pattern, PatternState, PotState, CalculationResultState, LabelState } from "./state"

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

export const calculateProbabilityBySimulation = (
  deck: DeckState,
  card: CardsState,
  pattern: PatternState,
  pot: PotState,
  labelState: LabelState,
  trials: number,
): CalculationResultState | null => {
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

  let totalDeckCards = cards.reduce((total, c) => total + c.count, 0)
  const fullDeck: Array<{ name: string; uid: string }> = []

  // ポットカードをデッキに追加
  for (let i = 0; i < pot.prosperity.count; i++) {
    const prosperityCard = { name: "prosperity", uid: "prosperity_card" }
    fullDeck.push(prosperityCard)
    totalDeckCards++
  }

  for (let i = 0; i < pot.desiresOrExtravagance.count; i++) {
    const desiresCard = { name: "desires", uid: "desires_card" }
    fullDeck.push(desiresCard)
    totalDeckCards++
  }

  // 通常のカードをデッキに追加
  for (const c of cards) {
    for (let i = 0; i < c.count; i++) {
      fullDeck.push({ name: c.name, uid: c.uid })
    }
  }

  // 不明なカードを追加
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

  // シミュレーションを実行
  for (let i = 0; i < trials; i++) {
    let shuffledDeck = fullDeck.slice()
    // Fisher-Yatesシャッフル
    for (let j = shuffledDeck.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1))
      ;[shuffledDeck[j], shuffledDeck[k]] = [shuffledDeck[k], shuffledDeck[j]]
    }

    const drawnCards = shuffledDeck.slice(0, firstHand)
    shuffledDeck = shuffledDeck.slice(firstHand)

    // 実際の手札を管理（Prosperityの効果を正しく処理するため）
    let effectiveHand = [...drawnCards]
    let effectiveDeck = [...shuffledDeck]

    // Desiresの処理（Prosperityがない場合のみ）
    if (
      !drawnCards.some((card) => card.uid === "prosperity_card") &&
      drawnCards.some((card) => card.uid === "desires_card") &&
      pot.desiresOrExtravagance.count > 0
    ) {
      const drawnCount = 2
      const additionalDrawnCards = effectiveDeck.slice(0, drawnCount)
      effectiveHand.push(...additionalDrawnCards)
      effectiveDeck = effectiveDeck.slice(drawnCount)
    }

    // Prosperityの処理
    if (drawnCards.some((card) => card.uid === "prosperity_card") && pot.prosperity.count > 0) {
      const cost = pot.prosperity.cost
      
      // Prosperityカードを手札から除外
      effectiveHand = effectiveHand.filter(card => card.uid !== "prosperity_card")
      
      // コスト分のカードを見る
      const revealedCards = effectiveDeck.slice(0, cost)
      
      if (revealedCards.length >= cost) {
        // 各カードを加えた場合をチェックし、最も優先度の高いパターンを満たすカードを選ぶ
        let bestCardIndex = -1
        let bestPattern: Pattern | null = null
        let bestLabels: Set<string> = new Set()

        for (let cardIndex = 0; cardIndex < revealedCards.length; cardIndex++) {
          const testHand = [...effectiveHand, revealedCards[cardIndex]]
          const testDeck = [
            ...effectiveDeck.slice(cost), // 見たカードを除いたデッキ
            ...revealedCards.filter((_, idx) => idx !== cardIndex) // 選ばなかったカード
          ]

          // このカードを選んだ場合の成功パターンをチェック
          const matches = sortedPatterns.filter((pattern) => 
            checkPatternConditions(testHand, testDeck, pattern)
          )

          if (matches.length > 0) {
            const topMatch = matches[0] // 既にソート済みなので最初が最優先
            if (!bestPattern || topMatch.priority < bestPattern.priority) {
              bestCardIndex = cardIndex
              bestPattern = topMatch
              bestLabels = new Set()
              
              // ラベルを収集
              for (const match of matches) {
                if (match.labels?.length > 0) {
                  for (const label of match.labels) {
                    bestLabels.add(label.uid)
                  }
                }
              }
            }
          }
        }

        // 最適なカードを選択（見つからなければ最初のカード）
        const selectedIndex = bestCardIndex >= 0 ? bestCardIndex : 0
        effectiveHand.push(revealedCards[selectedIndex])
        
        // 選ばなかったカードをデッキの底に戻す
        effectiveDeck = [
          ...effectiveDeck.slice(cost),
          ...revealedCards.filter((_, idx) => idx !== selectedIndex)
        ]
      }
    }

    // 最終的な手札とデッキで成功判定
    const matches = sortedPatterns.filter((pattern) => 
      checkPatternConditions(effectiveHand, effectiveDeck, pattern)
    )

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

  const overallProbability = (successCount / trials) * 100

  const labelSuccessRates: { [label: string]: string } = {}
  // 全てのラベルに対して初期値を設定
  labels.forEach(l => {
    labelSuccessRates[l.uid] = "0.00"
  })
  // 計算結果で更新
  for (const label in labelSuccessCount) {
    labelSuccessRates[label] = sprintf("%.2f", (labelSuccessCount[label] / trials) * 100)
  }

  const patternSuccessRates: { [patternId: string]: string } = {}
  // 全てのアクティブパターンに対して初期値を設定
  const activePatterns = patterns.filter(p => p.active)
  activePatterns.forEach(p => {
    patternSuccessRates[p.uid] = "0.00"
  })
  // 計算結果で更新
  for (const patternId in patternSuccessCount) {
    patternSuccessRates[patternId] = sprintf("%.2f", (patternSuccessCount[patternId] / trials) * 100)
  }

  return {
    overallProbability: sprintf("%.2f", overallProbability),
    labelSuccessRates,
    patternSuccessRates,
    mode: "simulation",
  }
}
