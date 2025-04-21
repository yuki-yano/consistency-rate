import { describe, expect, it } from "vitest"

import { calculateProbability } from "./calc"
import {
  CardData,
  CardsState,
  Condition,
  DeckState,
  LabelState,
  Pattern,
  PatternMode,
  PatternState,
  PotState,
} from "./state"

// Helper to create a mock pattern
const createMockPattern = (
  uid: string,
  name: string,
  conditions: Condition[],
  partialPattern: Partial<Pattern> = {},
): Pattern => ({
  active: true, // Default to active for tests
  conditions,
  expanded: false,
  labels: [],
  memo: "",
  name,
  priority: 0,
  uid,
  ...partialPattern,
})

// Helper function to create mock state
const createMockState = (
  deckCards: { [uid: string]: number }, // Simplified input: only card UIDs and counts
  drawCount: number,
  patterns: Pattern[], // Patterns to include in the state
  overrideCardsState?: CardsState, // Optional override for CardsState
): { card: CardsState; deck: DeckState; labelState: LabelState; pattern: PatternState; pot: PotState } => {
  // If overrideCardsState is provided, use it directly. Otherwise, generate from sampleCards.
  const mockCardsState: CardsState =
    overrideCardsState ??
    (() => {
      // Correctly create cardsMap as Record<string, CardData>
      const cardsMap: Record<string, CardData> = Object.fromEntries(
        Object.entries(deckCards).map(([uid, count]) => [
          uid,
          { count, isNormal: true, label: "", memo: "", name: `Card ${uid.substring(0, 4)}`, uid }, // Add a placeholder name
        ]),
      )
      const mockCards: CardData[] = Object.values(cardsMap)
      return { cards: mockCards, length: mockCards.length }
    })()

  const totalDeckSize = Object.values(deckCards).reduce((sum, count) => sum + count, 0)

  // Define a default PotState for tests that don't specifically need it
  const defaultPotState: PotState = {
    desiresOrExtravagance: { count: 0, priority: 0 },
    prosperity: { cost: 3, count: 0, priority: 0 },
  }

  // Define a default LabelState
  const defaultLabelState: LabelState = {
    labels: [], // Added required 'labels' property
  }

  return {
    card: mockCardsState, // Use the determined mockCardsState
    deck: { cardCount: totalDeckSize, firstHand: drawCount },
    labelState: defaultLabelState,
    pattern: { length: patterns.length, patterns: patterns },
    pot: defaultPotState,
  }
}

describe("calculateProbability", () => {
  it("should calculate a basic 100% probability case", () => {
    const deckCounts = { A: 3 }
    const cardsData = [
      // Define minimal card data for this test
      { count: 3, isNormal: true, label: "", memo: "", name: "Card A", uid: "A" },
    ]
    const state = createMockState(
      deckCounts,
      3, // Hand size
      [createMockPattern("p1", "Need 3 A", [{ count: 3, invalid: false, mode: "required", uids: ["A"] }])],
      { cards: cardsData, length: cardsData.length },
    )

    const result = calculateProbability(state.deck, state.card, state.pattern, state.pot, state.labelState)
    expect(result).not.toBeNull()
    expect(result?.overallProbability).toBe("100.00")
  })

  it("should correctly calculate probability for a simple 50% case", () => {
    const deckCounts = { A: 1, B: 1 }
    const cardsData = [
      { count: 1, isNormal: true, label: "", memo: "", name: "Card A", uid: "A" },
      { count: 1, isNormal: true, label: "", memo: "", name: "Card B", uid: "B" },
    ]
    const state = createMockState(
      deckCounts,
      1, // Hand size
      // Pass the single pattern inside an array
      [createMockPattern("p_simple_a", "Need 1 A", [{ count: 1, invalid: false, mode: "required", uids: ["A"] }])],
      { cards: cardsData, length: cardsData.length },
    )

    const result = calculateProbability(state.deck, state.card, state.pattern, state.pot, state.labelState)
    expect(result).not.toBeNull()
    expect(result?.overallProbability).toBe("50.00")
    expect(result?.patternSuccessRates["p_simple_a"]).toBe("50.00")
  })

  it("should correctly calculate probability for drawing 2 specific cards from 3", () => {
    const deckCounts = { A: 2, B: 1 }
    const cardsData = [
      { count: 2, isNormal: true, label: "", memo: "", name: "Card A", uid: "A" },
      { count: 1, isNormal: true, label: "", memo: "", name: "Card B", uid: "B" },
    ]
    const state = createMockState(
      deckCounts,
      2, // Hand size
      // Pass the single pattern inside an array
      [createMockPattern("p_need_2a", "Need 2 A", [{ count: 2, invalid: false, mode: "required", uids: ["A"] }])],
      { cards: cardsData, length: cardsData.length },
    )

    const result = calculateProbability(state.deck, state.card, state.pattern, state.pot, state.labelState)
    expect(result).not.toBeNull()
    // Note: The exact value might depend on rounding in the implementation. Adjust if necessary.
    expect(result?.overallProbability).toBe("33.33")
    expect(result?.patternSuccessRates["p_need_2a"]).toBe("33.33")
  })

  it("should match the specific sample data calculation", () => {
    const sampleData = {
      calculationResult: {
        labelSuccessRates: {
          "a1f3b9e2-4c7d-4f9a-9a2e-1b2c3d4e5f60": "75.34",
          "b2e4c7d1-5f8a-4b9c-8d3f-2e4f5a6b7c81": "50.02",
        },
        overallProbability: "91.52",
        patternSuccessRates: {
          "6ce579f8-cff5-48cd-beeb-68011370ea89": "75.34",
          "49fc6e53-1d9d-4dbd-abb6-48b226c1becd": "5.93",
          "64fe9abc-6e08-4145-86ed-c23fb2a9003e": "7.37",
          "a9d7a907-a9bb-4135-846a-2011f5108c3e": "28.85",
          "b9b968f6-9060-4fdb-8fe6-fdee5b555729": "9.80",
          "d60cb6a9-6ed6-478b-848a-437ad9d472c0": "1.10",
          "dc198698-f5c8-48e8-bab8-4f2e52e282ef": "7.89",
        },
      },
      cards: {
        cards: [
          { count: 3, name: "ディアベル", uid: "f61876c1-e336-42be-aadc-9018ff725103" },
          { count: 1, name: "罪宝狩り", uid: "819c1101-8670-468b-91e1-1ba3fb92d959" },
          { count: 1, name: "エクセル", uid: "469f580b-620b-47e2-a9ae-a710630ef96e" },
          { count: 1, name: "ポプルス", uid: "d5a576ea-fe0d-4a86-9085-778d2a99f019" },
          { count: 1, name: "オーク", uid: "b439ef86-308c-4d86-a407-4dab5ec47cf4" },
          { count: 2, name: "スミス", uid: "5c7988e0-1a7e-41e9-9a49-73f5f82bffcc" },
          { count: 1, name: "ルリー", uid: "9c6cca81-f3ae-4e02-9789-4e53975d43d1" },
          { count: 1, name: "原罪宝", uid: "f4d0980b-932a-41ad-8e85-79bf6b930bdb" },
          { count: 2, name: "篝火", uid: "8b7ab78b-1c16-4d36-965c-f8091d1a562d" },
          { count: 3, name: "欺き", uid: "276d01bc-c7c0-4b35-b4ee-09673b6dc25e" },
          { count: 1, name: "聖なる", uid: "0ed04fcf-10af-4f18-881b-36e11194c4b5" },
          { count: 1, name: "トラク", uid: "d05a456e-9ea8-4db1-89b7-d9dff3779aed" },
          { count: 1, name: "ベルジュ", uid: "ee7383fb-f0e2-4cea-a79a-fc239d438f95" },
          { count: 1, name: "ポニクス", uid: "d1799df6-86cc-4310-8ede-b843afbcb4f9" },
          { count: 1, name: "ガネーシャ", uid: "343a88df-e3a6-42b2-a4af-c5d63238eb73" },
          { count: 2, name: "キリン", uid: "2de5b4f3-4306-43e6-9112-990b62a3ea43" },
          { count: 1, name: "ガルド", uid: "6d28dde2-dc93-4ebf-9704-096e207941f9" },
          { count: 1, name: "聖域", uid: "3f8f0388-9062-43c9-9acf-9ba7b61646fe" },
          { count: 1, name: "孤島", uid: "171df73f-e519-4be9-9f2b-d4051cf3b1e6" },
          { count: 3, name: "うらら", uid: "fdcd9669-37dd-425c-96c6-e6f9149dae3c" },
          { count: 2, name: "墓穴の指名者", uid: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d" },
          { count: 1, name: "抹殺の指名者", uid: "2a3b4c5d-6e7f-8a9b-0c1d-2e3f4a5b6c7e" },
          { count: 3, name: "NS", uid: "d3b919da-699e-493a-ad75-78dbc5721a6c" },
        ],
        length: 23,
      },
      deck: {
        cardCount: 43,
        firstHand: 5,
      },
      label: {
        labels: [
          { name: "1枚初動", uid: "a1f3b9e2-4c7d-4f9a-9a2e-1b2c3d4e5f60" },
          { name: "2枚初動", uid: "b2e4c7d1-5f8a-4b9c-8d3f-2e4f5a6b7c81" },
        ],
      },
      pattern: {
        length: 7,
        patterns: [
          {
            active: true,
            conditions: [
              {
                count: 1,
                invalid: false,
                mode: "required",
                uids: [
                  "819c1101-8670-468b-91e1-1ba3fb92d959",
                  "5c7988e0-1a7e-41e9-9a49-73f5f82bffcc",
                  "469f580b-620b-47e2-a9ae-a710630ef96e",
                  "d5a576ea-fe0d-4a86-9085-778d2a99f019",
                  "8b7ab78b-1c16-4d36-965c-f8091d1a562d",
                  "f61876c1-e336-42be-aadc-9018ff725103",
                ],
              },
            ],
            expanded: false,
            labels: [{ uid: "a1f3b9e2-4c7d-4f9a-9a2e-1b2c3d4e5f60" }],
            memo: "",
            name: "1枚初動",
            priority: 1,
            uid: "6ce579f8-cff5-48cd-beeb-68011370ea89",
          },
          {
            active: true,
            conditions: [
              {
                count: 1,
                invalid: false,
                mode: "required",
                uids: ["276d01bc-c7c0-4b35-b4ee-09673b6dc25e"],
              },
              {
                count: 1,
                invalid: false,
                mode: "required",
                uids: [
                  "d3b919da-699e-493a-ad75-78dbc5721a6c",
                  "0ed04fcf-10af-4f18-881b-36e11194c4b5",
                  "b439ef86-308c-4d86-a407-4dab5ec47cf4",
                  "819c1101-8670-468b-91e1-1ba3fb92d959",
                  "5c7988e0-1a7e-41e9-9a49-73f5f82bffcc",
                  "9c6cca81-f3ae-4e02-9789-4e53975d43d1",
                  "ee7383fb-f0e2-4cea-a79a-fc239d438f95",
                  "d1799df6-86cc-4310-8ede-b843afbcb4f9",
                  "343a88df-e3a6-42b2-a4af-c5d63238eb73",
                  "2de5b4f3-4306-43e6-9112-990b62a3ea43",
                  "6d28dde2-dc93-4ebf-9704-096e207941f9",
                  "fdcd9669-37dd-425c-96c6-e6f9149dae3c",
                ],
              },
            ],
            expanded: false,
            labels: [{ uid: "b2e4c7d1-5f8a-4b9c-8d3f-2e4f5a6b7c81" }],
            memo: "",
            name: "欺き＋コスト",
            priority: 1,
            uid: "a9d7a907-a9bb-4135-846a-2011f5108c3e",
          },
          {
            active: true,
            conditions: [
              {
                count: 1,
                invalid: false,
                mode: "required",
                uids: ["f4d0980b-932a-41ad-8e85-79bf6b930bdb"],
              },
              {
                count: 1,
                invalid: false,
                mode: "required",
                uids: [
                  "d3b919da-699e-493a-ad75-78dbc5721a6c",
                  "b439ef86-308c-4d86-a407-4dab5ec47cf4",
                  "9c6cca81-f3ae-4e02-9789-4e53975d43d1",
                  "276d01bc-c7c0-4b35-b4ee-09673b6dc25e",
                  "d05a456e-9ea8-4db1-89b7-d9dff3779aed",
                  "d1799df6-86cc-4310-8ede-b843afbcb4f9",
                  "343a88df-e3a6-42b2-a4af-c5d63238eb73",
                  "3f8f0388-9062-43c9-9acf-9ba7b61646fe",
                  "fdcd9669-37dd-425c-96c6-e6f9149dae3c",
                ],
              },
            ],
            expanded: false,
            labels: [{ uid: "b2e4c7d1-5f8a-4b9c-8d3f-2e4f5a6b7c81" }],
            memo: "",
            name: "原罪＋コスト",
            priority: 1,
            uid: "b9b968f6-9060-4fdb-8fe6-fdee5b555729",
          },
          {
            active: true,
            conditions: [
              {
                count: 1,
                invalid: false,
                mode: "required",
                uids: ["0ed04fcf-10af-4f18-881b-36e11194c4b5"],
              },
              {
                count: 1,
                invalid: false,
                mode: "required",
                uids: ["f4d0980b-932a-41ad-8e85-79bf6b930bdb"],
              },
            ],
            expanded: false,
            labels: [{ uid: "b2e4c7d1-5f8a-4b9c-8d3f-2e4f5a6b7c81" }],
            memo: "",
            name: "聖アザミナ＋罪宝",
            priority: 1,
            uid: "d60cb6a9-6ed6-478b-848a-437ad9d472c0",
          },
          {
            active: true,
            conditions: [
              {
                count: 1,
                invalid: false,
                mode: "required",
                uids: ["d05a456e-9ea8-4db1-89b7-d9dff3779aed"],
              },
              {
                count: 1,
                invalid: false,
                mode: "required",
                uids: [
                  "b439ef86-308c-4d86-a407-4dab5ec47cf4",
                  "f4d0980b-932a-41ad-8e85-79bf6b930bdb",
                  "d3b919da-699e-493a-ad75-78dbc5721a6c",
                  "d1799df6-86cc-4310-8ede-b843afbcb4f9",
                  "343a88df-e3a6-42b2-a4af-c5d63238eb73",
                  "fdcd9669-37dd-425c-96c6-e6f9149dae3c",
                ],
              },
            ],
            expanded: false,
            labels: [{ uid: "b2e4c7d1-5f8a-4b9c-8d3f-2e4f5a6b7c81" }],
            memo: "",
            name: "トラク+NS",
            priority: 1,
            uid: "dc198698-f5c8-48e8-bab8-4f2e52e282ef",
          },
          {
            active: true,
            conditions: [
              {
                count: 1,
                invalid: false,
                mode: "required",
                uids: ["d1799df6-86cc-4310-8ede-b843afbcb4f9"],
              },
              {
                count: 1,
                invalid: false,
                mode: "required",
                uids: [
                  "b439ef86-308c-4d86-a407-4dab5ec47cf4",
                  "ee7383fb-f0e2-4cea-a79a-fc239d438f95",
                  "343a88df-e3a6-42b2-a4af-c5d63238eb73",
                  "2de5b4f3-4306-43e6-9112-990b62a3ea43",
                  "6d28dde2-dc93-4ebf-9704-096e207941f9",
                  "fdcd9669-37dd-425c-96c6-e6f9149dae3c",
                ],
              },
            ],
            expanded: false,
            labels: [{ uid: "b2e4c7d1-5f8a-4b9c-8d3f-2e4f5a6b7c81" }],
            memo: "",
            name: "ポニ+炎",
            priority: 1,
            uid: "64fe9abc-6e08-4145-86ed-c23fb2a9003e",
          },
          {
            active: true,
            conditions: [
              {
                count: 1,
                invalid: false,
                mode: "required",
                uids: ["3f8f0388-9062-43c9-9acf-9ba7b61646fe", "171df73f-e519-4be9-9f2b-d4051cf3b1e6"],
              },
              {
                count: 1,
                invalid: false,
                mode: "required",
                uids: ["343a88df-e3a6-42b2-a4af-c5d63238eb73", "2de5b4f3-4306-43e6-9112-990b62a3ea43"],
              },
            ],
            expanded: false,
            labels: [{ uid: "b2e4c7d1-5f8a-4b9c-8d3f-2e4f5a6b7c81" }],
            memo: "",
            name: "孤島+ガネキリン",
            priority: 1,
            uid: "49fc6e53-1d9d-4dbd-abb6-48b226c1becd",
          },
        ],
      },
      pot: {
        desiresOrExtravagance: { count: 0, priority: 2 },
        prosperity: { cost: 6, count: 0, priority: 1 },
      },
    }

    // Prepare state objects for the calculateProbability function
    const deckState: DeckState = sampleData.deck
    const cardsState: CardsState = {
      cards: sampleData.cards.cards.map((c) => ({ ...c, isNormal: true, label: "", memo: "" })), // Add defaults
      length: sampleData.cards.length, // Add missing length property
    }
    const patternState: PatternState = {
      length: sampleData.pattern.length, // Add missing length property
      patterns: sampleData.pattern.patterns.map((p) => ({
        ...p,
        // Ensure conditions match the Condition[] type, especially the mode
        conditions: p.conditions.map((c) => ({ ...c, mode: c.mode as PatternMode })),
        expanded: p.expanded ?? false,
        // Ensure pattern labels only contain required fields (likely just uid)
        labels: p.labels.map((l) => ({ uid: l.uid })),
        memo: p.memo ?? "",
      })),
    }
    const labelState: LabelState = {
      // Ensure labels match the Label[] type, adding missing 'memo'
      labels: sampleData.label.labels.map((l) => ({ ...l, color: "", memo: "" })),
    }
    const potState: PotState = sampleData.pot as PotState

    // Call the function
    const result = calculateProbability(deckState, cardsState, patternState, potState, labelState)

    // Assertions
    expect(result).not.toBeNull()
    if (!result) return // Type guard

    const expectedResult = sampleData.calculationResult

    // Check overall probability
    expect(result.overallProbability).toBe(expectedResult.overallProbability)

    // Check pattern success rates
    for (const patternUid in expectedResult.patternSuccessRates) {
      expect(result.patternSuccessRates[patternUid]).toBe(
        expectedResult.patternSuccessRates[patternUid as keyof typeof expectedResult.patternSuccessRates],
      )
    }

    // Check label success rates
    for (const labelUid in expectedResult.labelSuccessRates) {
      expect(result.labelSuccessRates[labelUid]).toBe(
        expectedResult.labelSuccessRates[labelUid as keyof typeof expectedResult.labelSuccessRates],
      )
    }
  })
})
