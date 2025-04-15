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
  patternUid: string | null
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

  // 2. Check 'required' conditions using backtracking
  // Start checking from the first condition (index 0), first slot (index 1)
  if (requiredConditions.length > 0) {
    const handCopy = { ...handComposition } // Pass a copy to the recursive function
    if (!canSatisfyConditions(0, 1, handCopy, requiredConditions)) {
      return false // Cannot satisfy required conditions
    }
    // Note: We don't need the modified handCopy after this check.
  }

  // 3. Check 'leave_deck' conditions using backtracking
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
): { bestPattern: Pattern | null; allSatisfiedLabels: string[] } => {
  let bestPattern: Pattern | null = null
  const satisfiedPatterns: Pattern[] = []
  const allLabelsSet = new Set<string>()

  for (const p of activePatterns) {
    if (checkSinglePattern(effectiveHand, effectiveDeck, p)) {
      satisfiedPatterns.push(p)
      // Collect labels from this satisfied pattern
      p.labels?.forEach((labelRef) => {
        if (labelRef.uid && labelRef.uid.length > 0) {
          // Ensure label uid is valid
          allLabelsSet.add(labelRef.uid)
        }
      })
    }
  }

  // Determine the best pattern among those satisfied (for pattern success rate)
  if (satisfiedPatterns.length > 0) {
    // Sort satisfied patterns by priority and original index to find the single best one
    satisfiedPatterns.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      // Tie-breaking using original index within the full patterns list (requires access or pre-calculated indices)
      // Assuming activePatterns preserves original relative order is simpler here:
      return activePatterns.findIndex((pat) => pat.uid === a.uid) - activePatterns.findIndex((pat) => pat.uid === b.uid)
    })
    bestPattern = satisfiedPatterns[0] // The first one after sorting is the best
  }

  const allSatisfiedLabels = Array.from(allLabelsSet)
  return { bestPattern: bestPattern, allSatisfiedLabels: allSatisfiedLabels }
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

  // Scenario 1: Prosperity Drawn
  if (handHasProsperity && pot.prosperity.count > 0) {
    const remainingDeckSize = Object.values(remainingDeck).reduce((s, c) => s + c, 0)
    const initialHandWithoutProsperity = { ...hand }
    initialHandWithoutProsperity[prosperityUid] = (initialHandWithoutProsperity[prosperityUid] || 0) - 1

    const { bestPattern: initialBestPattern, allSatisfiedLabels: initialLabels } = findSatisfiedPatternsAndLabels(
      initialHandWithoutProsperity,
      remainingDeck,
      activePatterns,
    )
    let finalBestPattern = initialBestPattern // This needs to be let as it can be updated
    const finalLabelsSet = new Set<string>(initialLabels)

    if (remainingDeckSize >= prosperityCost) {
      for (const uidToAdd of Object.keys(remainingDeck)) {
        if ((remainingDeck[uidToAdd] || 0) > 0) {
          const effectiveHand = { ...initialHandWithoutProsperity }
          effectiveHand[uidToAdd] = (effectiveHand[uidToAdd] || 0) + 1
          const { bestPattern: p, allSatisfiedLabels: l } = findSatisfiedPatternsAndLabels(
            effectiveHand,
            remainingDeck,
            activePatterns,
          )

          if (p) {
            const currentBestPriority = finalBestPattern?.priority ?? Infinity
            const newPatternPriority = p.priority
            if (newPatternPriority < currentBestPriority) {
              finalBestPattern = p
            } else if (newPatternPriority === currentBestPriority && finalBestPattern) {
              const currentBestIndex = activePatterns.findIndex((pat) => pat.uid === finalBestPattern!.uid)
              const newPatternIndex = activePatterns.findIndex((pat) => pat.uid === p.uid)
              if (newPatternIndex !== -1 && newPatternIndex < currentBestIndex) {
                finalBestPattern = p
              }
            }
          }
          l.forEach((labelUid) => finalLabelsSet.add(labelUid))
        }
      }
    }
    const finalLabelsArray = Array.from(finalLabelsSet)
    const finalPatternUid = finalBestPattern?.uid ?? null
    return {
      isSuccess: finalLabelsSet.size > 0 || !!finalBestPattern,
      patternUid: finalPatternUid != null && finalPatternUid.length > 0 ? finalPatternUid : null,
      labelUids: finalLabelsArray,
    }

    // Scenario 2: No Prosperity, Desires/Extravagance Drawn (Approximation for Draw 2)
  } else if (handHasDesires && pot.desiresOrExtravagance.count > 0) {
    const { bestPattern: initialPattern, allSatisfiedLabels: initialLabels } = findSatisfiedPatternsAndLabels(
      hand,
      remainingDeck,
      activePatterns,
    )

    if (initialPattern || initialLabels.length > 0) {
      const finalPatternUid = initialPattern?.uid ?? null
      return {
        isSuccess: true,
        patternUid: finalPatternUid != null && finalPatternUid.length > 0 ? finalPatternUid : null,
        labelUids: initialLabels,
      }
    }

    let finalBestPattern: Pattern | null = null // Needs to be let
    const finalLabelsSet = new Set<string>()
    const availableUids = Object.keys(remainingDeck).filter((uid) => (remainingDeck[uid] || 0) > 0)

    outerLoop: for (let i = 0; i < availableUids.length; i++) {
      for (let j = i + 1; j < availableUids.length; j++) {
        const uid1 = availableUids[i]
        const uid2 = availableUids[j]
        const effectiveHand = { ...hand }
        effectiveHand[uid1] = (effectiveHand[uid1] || 0) + 1
        effectiveHand[uid2] = (effectiveHand[uid2] || 0) + 1
        const { bestPattern: p, allSatisfiedLabels: l } = findSatisfiedPatternsAndLabels(
          effectiveHand,
          remainingDeck,
          activePatterns,
        )
        if (p || l.length > 0) {
          finalBestPattern = p
          l.forEach((labelUid) => finalLabelsSet.add(labelUid))
          break outerLoop
        }
      }
    }
    if (!finalBestPattern && finalLabelsSet.size === 0) {
      for (const uid of availableUids) {
        if ((remainingDeck[uid] || 0) >= 2) {
          const effectiveHand = { ...hand }
          effectiveHand[uid] = (effectiveHand[uid] || 0) + 2
          const { bestPattern: p, allSatisfiedLabels: l } = findSatisfiedPatternsAndLabels(
            effectiveHand,
            remainingDeck,
            activePatterns,
          )
          if (p || l.length > 0) {
            finalBestPattern = p
            l.forEach((labelUid) => finalLabelsSet.add(labelUid))
            break
          }
        }
      }
    }

    const finalLabelsArray = Array.from(finalLabelsSet)
    const finalPatternUid = finalBestPattern?.uid ?? null
    return {
      isSuccess: !!finalBestPattern || finalLabelsArray.length > 0,
      patternUid: finalPatternUid != null && finalPatternUid.length > 0 ? finalPatternUid : null,
      labelUids: finalLabelsArray,
    }

    // Scenario 3: Neither Pot effect applies
  } else {
    const { bestPattern: p, allSatisfiedLabels: l } = findSatisfiedPatternsAndLabels(
      hand,
      remainingDeck,
      activePatterns,
    )
    const finalPatternUid = p?.uid ?? null
    return {
      isSuccess: !!p || l.length > 0,
      patternUid: finalPatternUid != null && finalPatternUid.length > 0 ? finalPatternUid : null,
      labelUids: l,
    }
  }
}

// --- Recursive function - Base case uses the new CheckResult structure ---
// ... (Type definition, memo, createMemoKey remain the same)
type RecursiveCalcResult = {
  totalCombinations: bigint
  patternSuccessCombinations: BigIntComposition
  labelSuccessCombinations: BigIntComposition
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
      // ... (remainingDeckComp calculation) ...
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
        patternSuccessCombinations: {},
        labelSuccessCombinations: {},
      }
      const validPatternUid = checkResult.patternUid // Already checked for non-empty in checkPotsAndPatterns
      if (validPatternUid != null) {
        // Only check for null/undefined now
        result.patternSuccessCombinations[validPatternUid] = 1n
      }
      // Use the possibly empty but filtered labelUids list
      checkResult.labelUids.forEach((labelUid) => {
        // Assuming labelUid is valid string here as it comes from filtered list
        result.labelSuccessCombinations[labelUid] = (result.labelSuccessCombinations[labelUid] || 0n) + 1n
      })
      return result
    } else {
      return { totalCombinations: 0n, patternSuccessCombinations: {}, labelSuccessCombinations: {} }
    }
  }

  // ... (Memoization and Recursive Step remain the same) ...
  const memoKey = createMemoKey(cardIndex, remainingHandSlots, currentHandComposition)
  if (memoKey in memo) {
    return memo[memoKey]
  }
  const totalResult: RecursiveCalcResult = {
    totalCombinations: 0n,
    patternSuccessCombinations: {},
    labelSuccessCombinations: {},
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
        Object.entries(subResult.patternSuccessCombinations).forEach(([patternUid, subCount]: [string, bigint]) => {
          if (patternUid) {
            const weightedSubCount = comb * subCount
            totalResult.patternSuccessCombinations[patternUid] =
              (totalResult.patternSuccessCombinations[patternUid] || 0n) + weightedSubCount
          }
        })
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
  let overallSuccessCombinations: bigint = 0n
  // Note: Overall success is now based on *any* label being present or a pattern being met.
  // This might differ from just summing pattern successes if a hand satisfies labels but no specific pattern directly.
  // We will sum the combinations associated with each label for the label rates.
  // For overall success, we might need a different approach if the definition changes.
  // Sticking to summing pattern successes for overall probability for now.
  Object.values(result.patternSuccessCombinations).forEach((count: bigint) => {
    overallSuccessCombinations += count
  })

  // --- Convert to Probabilities ---
  const overallProbability = denominator > 0n ? Number((overallSuccessCombinations * 10000n) / denominator) / 100 : 0

  const patternSuccessRates: Record<string, string> = {}
  Object.entries(result.patternSuccessCombinations).forEach(([patternId, count]: [string, bigint]) => {
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
