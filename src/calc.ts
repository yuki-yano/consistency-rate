import { sprintf } from "sprintf-js"
import {
  CardsState,
  DeckState,
  Pattern,
  PatternState,
  PotState,
  CalculationResultState,
  Label,
  LabelState,
} from "./state"

// Type alias for clarity
type Composition = Record<string, number>
type BigIntComposition = Record<string, bigint>

// Result structure for the pot/pattern check
type CheckResult = {
  isSuccess: boolean
  patternUids: string[]
  labelUids: string[]
}

/**
 * Calculates the number of combinations (nCr) using BigInt.
 *
 * @param n - The total number of items.
 * @param k - The number of items to choose.
 * @returns The number of combinations, or 0n if inputs are invalid.
 */
function combinations(n: number, k: number): bigint {
  if (k < 0 || k > n) {
    return 0n
  }
  if (k === 0 || k === n) {
    return 1n
  }
  // Use the symmetry property: C(n, k) = C(n, n-k)
  if (k > n / 2) {
    k = n - k
  }

  let result = 1n
  for (let i = 1; i <= k; i++) {
    // Calculate (n - i + 1) / i incrementally
    // Use BigInt for all intermediate calculations to prevent overflow
    result = (result * BigInt(n - i + 1)) / BigInt(i)
  }

  return result
}

// Recursive helper function for backtracking check
const canSatisfyConditions = (
  conditionIndex: number,
  slotIndex: number,
  availableResources: Composition,
  conditions: ReadonlyArray<Pattern["conditions"][number]>, // Use the actual Condition type from Pattern
): boolean => {
  // Base Case 1: All conditions have been successfully processed
  if (conditionIndex >= conditions.length) {
    return true
  }

  const currentCondition = conditions[conditionIndex]

  // Base Case 2: All slots for the current condition are filled, move to the next condition
  if (slotIndex > currentCondition.count) {
    return canSatisfyConditions(conditionIndex + 1, 1, availableResources, conditions)
  }

  // Recursive Step: Try to fill the current slot (slotIndex) for the current condition (conditionIndex)
  for (const uid of currentCondition.uids) {
    // Check if a card of this uid is available
    if ((availableResources[uid] || 0) > 0) {
      // Consume the card (try assigning it to this slot)
      availableResources[uid] = (availableResources[uid] || 0) - 1

      // Recurse: try to fill the next slot for the *same* condition
      if (canSatisfyConditions(conditionIndex, slotIndex + 1, availableResources, conditions)) {
        // If successful path found, return true immediately
        return true
      }

      // Backtrack: restore the consumed card if the recursive call failed
      availableResources[uid] = (availableResources[uid] || 0) + 1
    }
  }

  // If no uid could satisfy the current slot for this condition, this path fails
  return false
}

// --- Helper function to check if a hand/deck state satisfies a single pattern ---
// Uses backtracking for accurate distinct card counting.
const checkSinglePattern = (
  handComposition: Composition,
  remainingDeckComposition: Composition,
  pattern: Pattern,
): boolean => {
  if (!pattern.active) return false

  // Separate conditions by type
  // Use ReadonlyArray for the lists passed to the recursive function
  const requiredConditions: ReadonlyArray<Pattern["conditions"][number]> = pattern.conditions.filter(
    (c) => c.mode === "required",
  )
  const requiredDistinctConditions: ReadonlyArray<Pattern["conditions"][number]> = pattern.conditions.filter(
    (c) => c.mode === "required_distinct",
  )
  const leaveDeckConditions: ReadonlyArray<Pattern["conditions"][number]> = pattern.conditions.filter(
    (c) => c.mode === "leave_deck",
  )
  const notDrawnConditions: ReadonlyArray<Pattern["conditions"][number]> = pattern.conditions.filter(
    (c) => c.mode === "not_drawn",
  )

  // 1. Check 'not_drawn' conditions first (simple and fast)
  for (const condition of notDrawnConditions) {
    for (const uid of condition.uids) {
      if ((handComposition[uid] || 0) > 0) {
        return false // Fail fast
      }
    }
  }

  // 2. Check 'required_distinct' conditions (check for distinct cards)
  for (const condition of requiredDistinctConditions) {
    let distinctCardsFound = 0
    for (const uid of condition.uids) {
      if ((handComposition[uid] || 0) > 0) {
        distinctCardsFound++
      }
    }
    if (distinctCardsFound < condition.count) {
      return false // Not enough distinct cards found
    }
  }

  // 3. Check 'required' conditions using backtracking
  // Start checking from the first condition (index 0), first slot (index 1)
  if (requiredConditions.length > 0) {
    const handCopy = { ...handComposition } // Pass a copy to the recursive function
    if (!canSatisfyConditions(0, 1, handCopy, requiredConditions)) {
      return false // Cannot satisfy required conditions
    }
    // Note: We don't need the modified handCopy after this check.
  }

  // 4. Check 'leave_deck' conditions using backtracking
  // Start checking from the first condition (index 0), first slot (index 1)
  if (leaveDeckConditions.length > 0) {
    const deckCopy = { ...remainingDeckComposition } // Pass a copy
    if (!canSatisfyConditions(0, 1, deckCopy, leaveDeckConditions)) {
      return false // Cannot satisfy leave_deck conditions
    }
    // Note: We don't need the modified deckCopy after this check.
  }

  // If all checks passed
  return true
}

// --- Helper function to find the highest priority satisfied pattern AND all associated labels ---
const findSatisfiedPatternsAndLabels = (
  effectiveHand: Composition,
  effectiveDeck: Composition,
  activePatterns: ReadonlyArray<Pattern>,
): { satisfiedPatternUids: string[]; allSatisfiedLabels: string[] } => {
  const satisfiedPatterns: Pattern[] = []
  const allLabelsSet = new Set<string>()
  const satisfiedPatternUidsSet = new Set<string>()

  for (const p of activePatterns) {
    if (checkSinglePattern(effectiveHand, effectiveDeck, p)) {
      satisfiedPatterns.push(p)
      if (p.uid && p.uid.length > 0) {
        satisfiedPatternUidsSet.add(p.uid)
      }
      p.labels?.forEach((labelRef) => {
        if (labelRef.uid && labelRef.uid.length > 0) {
          allLabelsSet.add(labelRef.uid)
        }
      })
    }
  }

  const allSatisfiedLabels = Array.from(allLabelsSet)
  const satisfiedPatternUids = Array.from(satisfiedPatternUidsSet)
  return { satisfiedPatternUids: satisfiedPatternUids, allSatisfiedLabels: allSatisfiedLabels }
}

// --- Helper function to check pots and determine final success state --- (Uses new find function)
const checkPotsAndPatterns = (
  hand: Composition,
  remainingDeck: Composition,
  activePatterns: ReadonlyArray<Pattern>,
  pot: PotState,
): CheckResult => {
  const prosperityUid = "prosperity_card"
  const desiresUid = "desires_card"
  const handHasProsperity = (hand[prosperityUid] || 0) > 0
  const handHasDesires = (hand[desiresUid] || 0) > 0
  const prosperityCost = pot.prosperity.cost

  const finalPatternUidsSet = new Set<string>()
  const finalLabelsSet = new Set<string>()

  // Scenario 1: Prosperity Drawn
  if (handHasProsperity && pot.prosperity.count > 0) {
    const remainingDeckSize = Object.values(remainingDeck).reduce((s, c) => s + c, 0)
    const initialHandWithoutProsperity = { ...hand }
    initialHandWithoutProsperity[prosperityUid] = (initialHandWithoutProsperity[prosperityUid] || 0) - 1

    const { satisfiedPatternUids: initialPatternUids, allSatisfiedLabels: initialLabels } = findSatisfiedPatternsAndLabels(
      initialHandWithoutProsperity,
      remainingDeck,
      activePatterns,
    )
    initialPatternUids.forEach(uid => finalPatternUidsSet.add(uid));
    initialLabels.forEach(uid => finalLabelsSet.add(uid));

    if (remainingDeckSize >= prosperityCost) {
      const deckUids = Object.keys(remainingDeck);
      for (const uidToAdd of deckUids) {
          if ((remainingDeck[uidToAdd] || 0) > 0) {
              const effectiveHand = { ...initialHandWithoutProsperity };
              effectiveHand[uidToAdd] = (effectiveHand[uidToAdd] || 0) + 1;
              const { satisfiedPatternUids: uids, allSatisfiedLabels: labels } = findSatisfiedPatternsAndLabels(
                  effectiveHand,
                  remainingDeck,
                  activePatterns
              );
              uids.forEach(uid => finalPatternUidsSet.add(uid));
              labels.forEach(labelUid => finalLabelsSet.add(labelUid));
          }
      }
    }
  } else if (handHasDesires && pot.desiresOrExtravagance.count > 0) {
    const { satisfiedPatternUids: initialPatternUids, allSatisfiedLabels: initialLabels } = findSatisfiedPatternsAndLabels(
      hand,
      remainingDeck,
      activePatterns,
    )
    initialPatternUids.forEach(uid => finalPatternUidsSet.add(uid));
    initialLabels.forEach(uid => finalLabelsSet.add(uid));

    const availableUids = Object.keys(remainingDeck).filter((uid) => (remainingDeck[uid] || 0) > 0)

    for (let i = 0; i < availableUids.length; i++) {
      for (let j = i + 1; j < availableUids.length; j++) {
        const uid1 = availableUids[i]
        const uid2 = availableUids[j]
        const effectiveHand = { ...hand }
        effectiveHand[uid1] = (effectiveHand[uid1] || 0) + 1
        effectiveHand[uid2] = (effectiveHand[uid2] || 0) + 1
         const { satisfiedPatternUids: uids, allSatisfiedLabels: labels } = findSatisfiedPatternsAndLabels(
          effectiveHand,
          remainingDeck,
          activePatterns,
        )
        uids.forEach(uid => finalPatternUidsSet.add(uid));
        labels.forEach(labelUid => finalLabelsSet.add(labelUid));
      }
    }
    for (const uid of availableUids) {
        if ((remainingDeck[uid] || 0) >= 2) {
            const effectiveHand = { ...hand };
            effectiveHand[uid] = (effectiveHand[uid] || 0) + 2;
            const { satisfiedPatternUids: uids, allSatisfiedLabels: labels } = findSatisfiedPatternsAndLabels(
                effectiveHand,
                remainingDeck,
                activePatterns
            );
            uids.forEach(uid => finalPatternUidsSet.add(uid));
            labels.forEach(labelUid => finalLabelsSet.add(labelUid));
        }
    }
  } else {
     const { satisfiedPatternUids: uids, allSatisfiedLabels: labels } = findSatisfiedPatternsAndLabels(
      hand,
      remainingDeck,
      activePatterns,
    )
     uids.forEach(uid => finalPatternUidsSet.add(uid));
     labels.forEach(labelUid => finalLabelsSet.add(labelUid));
  }

  const finalPatternUidsArray = Array.from(finalPatternUidsSet).filter(uid => uid && uid.length > 0);
  const finalLabelsArray = Array.from(finalLabelsSet).filter(uid => uid && uid.length > 0);
  const isSuccess = finalPatternUidsArray.length > 0 || finalLabelsArray.length > 0

  return {
    isSuccess: isSuccess,
    patternUids: finalPatternUidsArray,
    labelUids: finalLabelsArray,
  }
}

// --- Recursive function - Base case uses the new CheckResult structure ---
// ... (Type definition, memo, createMemoKey remain the same)
type RecursiveCalcResult = {
  totalCombinations: bigint
  individualPatternSuccessCombinations: BigIntComposition
  labelSuccessCombinations: BigIntComposition
  overallSuccessCombinations: bigint
}
let memo: Record<string, RecursiveCalcResult> = {}
const createMemoKey = (index: number, slots: number, comp: Composition): string => {
  const sortedEntries = Object.entries(comp).sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
  return `${index}|${slots}|${JSON.stringify(sortedEntries)}`
}

const recursiveCalcCombinations = (
  cardUids: string[],
  cardIndex: number,
  currentHandComposition: Composition,
  remainingHandSlots: number,
  originalDeckComposition: Composition,
  activePatterns: ReadonlyArray<Pattern>,
  allLabels: Label[],
  pot: PotState,
): RecursiveCalcResult => {
  // Base Case
  if (cardIndex === cardUids.length || remainingHandSlots === 0) {
    if (remainingHandSlots === 0) {
      const remainingDeckComp: Composition = {}
      Object.keys(originalDeckComposition).forEach((uid) => {
        const handCount: number = currentHandComposition[uid] || 0
        const originalCount: number = originalDeckComposition[uid] || 0
        const remainingCount = originalCount - handCount
        if (remainingCount > 0) {
          remainingDeckComp[uid] = remainingCount
        }
      })

      const checkResult = checkPotsAndPatterns(currentHandComposition, remainingDeckComp, activePatterns, pot)

      const result: RecursiveCalcResult = {
        totalCombinations: 1n,
        individualPatternSuccessCombinations: {},
        labelSuccessCombinations: {},
        overallSuccessCombinations: checkResult.isSuccess ? 1n : 0n,
      }
      checkResult.patternUids.forEach((patternUid) => {
        if (patternUid) {
           result.individualPatternSuccessCombinations[patternUid] = 1n;
        }
      });
      checkResult.labelUids.forEach((labelUid) => {
        result.labelSuccessCombinations[labelUid] = (result.labelSuccessCombinations[labelUid] || 0n) + 1n
      })
      return result
    } else {
      return { totalCombinations: 0n, individualPatternSuccessCombinations: {}, labelSuccessCombinations: {}, overallSuccessCombinations: 0n }
    }
  }

  // ... (Memoization and Recursive Step remain the same) ...
  const memoKey = createMemoKey(cardIndex, remainingHandSlots, currentHandComposition)
  if (memoKey in memo) {
    return memo[memoKey]
  }
  const totalResult: RecursiveCalcResult = {
    totalCombinations: 0n,
    individualPatternSuccessCombinations: {},
    labelSuccessCombinations: {},
    overallSuccessCombinations: 0n,
  }
  const currentUid = cardUids[cardIndex]
  const originalCountForCurrentUid: number = originalDeckComposition[currentUid] || 0
  const countInHandSoFar: number = currentHandComposition[currentUid] || 0
  const availableToDrawCount = originalCountForCurrentUid - countInHandSoFar
  const maxDrawForThisStep = Math.min(remainingHandSlots, availableToDrawCount)

  for (let drawCount = 0; drawCount <= maxDrawForThisStep; drawCount++) {
    const comb = combinations(availableToDrawCount, drawCount)
    if (comb > 0n) {
      const nextHandComp = { ...currentHandComposition }
      if (drawCount > 0) {
        nextHandComp[currentUid] = countInHandSoFar + drawCount
      }
      const subResult = recursiveCalcCombinations(
        cardUids,
        cardIndex + 1,
        nextHandComp,
        remainingHandSlots - drawCount,
        originalDeckComposition,
        activePatterns,
        allLabels,
        pot,
      )
      if (subResult.totalCombinations > 0n) {
        const weightedCombinations = comb * subResult.totalCombinations
        totalResult.totalCombinations += weightedCombinations
        totalResult.overallSuccessCombinations += comb * subResult.overallSuccessCombinations

        Object.entries(subResult.individualPatternSuccessCombinations).forEach(([patternUid, subCount]: [string, bigint]) => {
           if (patternUid) {
               const weightedSubCount = comb * subCount;
               totalResult.individualPatternSuccessCombinations[patternUid] =
                   (totalResult.individualPatternSuccessCombinations[patternUid] || 0n) + weightedSubCount;
           }
        });
        Object.entries(subResult.labelSuccessCombinations).forEach(([labelUid, subCount]: [string, bigint]) => {
          if (labelUid) {
            const weightedSubCount = comb * subCount
            totalResult.labelSuccessCombinations[labelUid] =
              (totalResult.labelSuccessCombinations[labelUid] || 0n) + weightedSubCount
          }
        })
      }
    }
  }
  memo[memoKey] = totalResult
  return totalResult
}

/**
 * Calculates the exact probability based on combinatorics.
 * Replaces the previous simulation-based approach.
 * Pot effects are currently ignored.
 * NOTE: The logic for handling distinct card requirements across conditions
 * within a pattern in checkSinglePattern needs refinement for full accuracy.
 *
 * @param deck - Deck state.
 * @param card - Cards state.
 * @param pattern - Patterns state.
 * @param pot - Pot state (currently ignored).
 * @param labelState - Label state.
 * @returns The calculation result or null if calculation is not possible.
 */
export const calculateProbability = (
  deck: DeckState,
  card: CardsState,
  pattern: PatternState,
  pot: PotState,
  labelState: LabelState,
): CalculationResultState | null => {
  const { cardCount, firstHand } = deck
  const { cards } = card
  const { patterns } = pattern
  const { labels } = labelState

  // --- Deck Composition ---
  const originalDeckComposition: Composition = {}
  let totalExplicitCards: number = 0

  // Add Pot cards to composition if they exist
  if (pot.prosperity.count > 0) {
    originalDeckComposition["prosperity_card"] = pot.prosperity.count
    totalExplicitCards += pot.prosperity.count
  }
  if (pot.desiresOrExtravagance.count > 0) {
    originalDeckComposition["desires_card"] = pot.desiresOrExtravagance.count
    totalExplicitCards += pot.desiresOrExtravagance.count
  }

  for (const c of cards) {
    if (c.count > 0) {
      const currentCount: number = originalDeckComposition[c.uid] || 0
      originalDeckComposition[c.uid] = currentCount + c.count
      totalExplicitCards += c.count
    }
  }
  const unknownCardCount = cardCount - totalExplicitCards
  if (unknownCardCount < 0) {
    console.error("Error: Pot/Card counts exceed deck size.")
    return null
  }
  if (unknownCardCount > 0) {
    originalDeckComposition["unknown_card"] = unknownCardCount
  }

  // Verify checksum includes pot cards
  let checkSum: number = 0
  Object.values(originalDeckComposition).forEach((count: number) => (checkSum += count))
  if (checkSum !== cardCount) {
    console.error("Error: Deck composition count mismatch.")
    return null
  }
  if (cardCount < firstHand || firstHand < 0) {
    console.error("Error: Invalid hand size.")
    return null
  }

  // --- Total Combinations --- (Denominator for probabilities)
  const totalCombinations_check = combinations(cardCount, firstHand)
  if (totalCombinations_check <= 0n && !(cardCount === 0 && firstHand === 0)) {
    // Allow C(0,0) = 1
    if (cardCount >= firstHand && firstHand >= 0) {
      console.warn("Warning: Total combinations are zero, probabilities will be zero.")
      return {
        overallProbability: "0.00",
        patternSuccessRates: {},
        labelSuccessRates: {},
      }
    } else {
      console.error("Error: Total combinations calculation failed or resulted in zero/negative.")
      return null
    }
  }

  // --- Filter and Sort Active Patterns by Priority ---
  const activePatterns: ReadonlyArray<Pattern> = patterns
    .filter((p) => p.active)
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      // Use findIndex on the original patterns array for stable sort based on original order
      return patterns.findIndex((p) => p.uid === a.uid) - patterns.findIndex((p) => p.uid === b.uid)
    })

  if (activePatterns.length === 0 && pot.prosperity.count === 0 && pot.desiresOrExtravagance.count === 0) {
    // Optimization: If no patterns and no pots, probability is 0
    // However, if pots *are* present, calculation might still be needed if pot effects themselves constitute success (not currently modeled)
    return {
      overallProbability: "0.00",
      patternSuccessRates: {},
      labelSuccessRates: {},
    }
  }

  // --- Calculate Success Combinations using Recursion ---
  memo = {}
  const cardUids = Object.keys(originalDeckComposition)
  const result = recursiveCalcCombinations(
    cardUids,
    0,
    {},
    firstHand,
    originalDeckComposition,
    activePatterns,
    labels,
    pot,
  )

  const denominator = totalCombinations_check

  // Verify recursive total combinations against C(n,k)
  // Note: result.totalCombinations represents the sum of combinations for *all* possible final hands.
  if (result.totalCombinations !== denominator && denominator > 0n) {
    console.warn(
      `Recursive total combinations (${result.totalCombinations}) do not match C(n,k) (${denominator}). Using C(n,k) for probability denominator.`,
    )
  }

  // --- Aggregate Results ---
  // Use the new overallSuccessCombinations from the result
  const overallSuccessCombinations: bigint = result.overallSuccessCombinations
  // Note: Overall success is now based on *any* label being present or a pattern being met.
  // This might differ from just summing pattern successes if a hand satisfies labels but no specific pattern directly.
  // We will sum the combinations associated with each label for the label rates.
  // For overall success, we might need a different approach if the definition changes.
  // Sticking to summing pattern successes for overall probability for now.
  // Object.values(result.patternSuccessCombinations).forEach((count: bigint) => { // Remove this summation
  //   overallSuccessCombinations += count
  // })

  // --- Convert to Probabilities ---
  const overallProbability = denominator > 0n ? Number((overallSuccessCombinations * 10000n) / denominator) / 100 : 0

  const patternSuccessRates: Record<string, string> = {}
  Object.entries(result.individualPatternSuccessCombinations).forEach(([patternId, count]: [string, bigint]) => {
    const rate = denominator > 0n ? Number((count * 10000n) / denominator) / 100 : 0
    patternSuccessRates[patternId] = sprintf("%.2f", rate)
  })

  const labelSuccessRates: Record<string, string> = {}
  Object.entries(result.labelSuccessCombinations).forEach(([labelId, count]: [string, bigint]) => {
    const rate = denominator > 0n ? Number((count * 10000n) / denominator) / 100 : 0
    labelSuccessRates[labelId] = sprintf("%.2f", rate)
  })

  // Sort results
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
    overallProbability: sprintf("%.2f", overallProbability),
    patternSuccessRates: sortedPatternSuccessRates,
    labelSuccessRates: sortedLabelSuccessRates,
  }
}
