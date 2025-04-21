import { sprintf } from "sprintf-js"

import {
  CalculationResultState,
  CardsState,
  DeckState,
  Label,
  LabelState,
  Pattern,
  PatternState,
  PotState,
} from "./state"

type Composition = Record<string, number>
type BigIntComposition = Record<string, bigint>

type CheckResult = {
  isSuccess: boolean
  labelUids: Array<string>
  patternUids: Array<string>
}

/**
 * BigInt を使用して組み合わせ (nCr) の数を計算します。
 *
 * @param n - アイテムの総数。
 * @param k - 選択するアイテムの数。
 * @returns 組み合わせの数。入力が無効な場合は 0n。
 */
function combinations(n: number, k: number): bigint {
  if (k < 0 || k > n) {
    return 0n
  }
  if (k === 0 || k === n) {
    return 1n
  }
  // 対称性の性質を使用: C(n, k) = C(n, n-k)
  if (k > n / 2) {
    k = n - k
  }

  let result = 1n
  for (let i = 1; i <= k; i++) {
    // (n - i + 1) / i を段階的に計算
    // オーバーフローを防ぐために全ての中間計算で BigInt を使用
    result = (result * BigInt(n - i + 1)) / BigInt(i)
  }

  return result
}

/**
 * バックトラッキングチェックのための再帰ヘルパー関数
 * @param conditionIndex - 現在の条件のインデックス
 * @param slotIndex - 現在のスロットのインデックス
 * @param availableResources - 条件を満たすために利用可能なリソース
 * @param conditions - 満たすべき条件
 * @returns 条件を満たせる場合は true、そうでない場合は false
 */
const canSatisfyConditions = (
  conditionIndex: number,
  slotIndex: number,
  availableResources: Composition,
  conditions: ReadonlyArray<Pattern["conditions"][number]>, // Pattern から実際の Condition 型を使用
): boolean => {
  // ベースケース 1: 全ての条件が正常に処理された
  if (conditionIndex >= conditions.length) {
    return true
  }

  const currentCondition = conditions[conditionIndex]

  // ベースケース 2: 現在の条件の全てのスロットが埋まった、次の条件へ進む
  if (slotIndex > currentCondition.count) {
    return canSatisfyConditions(conditionIndex + 1, 1, availableResources, conditions)
  }

  // 再帰ステップ: 現在の条件 (conditionIndex) の現在のスロット (slotIndex) を埋めようとする
  for (const uid of currentCondition.uids) {
    // この uid のカードが利用可能かチェック
    if ((availableResources[uid] || 0) > 0) {
      // カードを消費する (このスロットに割り当ててみる)
      availableResources[uid] = (availableResources[uid] || 0) - 1

      // 再帰: *同じ*条件の次のスロットを埋めようとする
      if (canSatisfyConditions(conditionIndex, slotIndex + 1, availableResources, conditions)) {
        // 成功パスが見つかった場合、直ちに true を返す
        return true
      }

      // バックトラック: 再帰呼び出しが失敗した場合、消費したカードを元に戻す
      availableResources[uid] = (availableResources[uid] || 0) + 1
    }
  }

  // この条件の現在のスロットを満たす uid が見つからなかった場合、このパスは失敗
  return false
}

/**
 * 手札/デッキの状態が単一のパターンを満たすかチェックするヘルパー関数
 * 正確な異なるカードのカウントのためにバックトラッキングを使用します。
 * @param handComposition - 手札の構成
 * @param remainingDeckComposition - 残りのデッキの構成
 * @param pattern - チェックするパターン
 * @returns パターンを満たせる場合は true、そうでない場合は false
 */
const checkSinglePattern = (
  handComposition: Composition,
  remainingDeckComposition: Composition,
  pattern: Pattern,
): boolean => {
  if (!pattern.active) return false // パターンがアクティブでない場合は false

  // 条件をタイプ別に分離
  // 再帰関数に渡されるリストには ReadonlyArray を使用
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

  // 1. 'not_drawn' 条件を最初にチェック (シンプルで高速)
  for (const condition of notDrawnConditions) {
    for (const uid of condition.uids) {
      if ((handComposition[uid] || 0) > 0) {
        return false // 即時失敗
      }
    }
  }

  // 2. 'required_distinct' 条件をチェック (異なるカードのチェック)
  for (const condition of requiredDistinctConditions) {
    let distinctCardsFound = 0
    for (const uid of condition.uids) {
      if ((handComposition[uid] || 0) > 0) {
        distinctCardsFound++
      }
    }
    if (distinctCardsFound < condition.count) {
      return false // 必要な数の異なるカードが見つからなかった
    }
  }

  // 3. バックトラッキングを使用して 'required' 条件をチェック
  // 最初の条件 (インデックス 0)、最初のスロット (インデックス 1) からチェックを開始
  if (requiredConditions.length > 0) {
    const handCopy = { ...handComposition } // 再帰関数にコピーを渡す
    if (!canSatisfyConditions(0, 1, handCopy, requiredConditions)) {
      return false // required 条件を満たせない
    }
    // 注: このチェックの後、変更された handCopy は不要です。
  }

  // 4. バックトラッキングを使用して 'leave_deck' 条件をチェック
  // 最初の条件 (インデックス 0)、最初のスロット (インデックス 1) からチェックを開始
  if (leaveDeckConditions.length > 0) {
    const deckCopy = { ...remainingDeckComposition } // コピーを渡す
    if (!canSatisfyConditions(0, 1, deckCopy, leaveDeckConditions)) {
      return false // leave_deck 条件を満たせない
    }
    // 注: このチェックの後、変更された deckCopy は不要です。
  }

  // 全てのチェックが通過した場合
  return true
}

/**
 * 満たされた最も優先度の高いパターンと、関連付けられた全てのラベルを見つけるヘルパー関数
 * @param effectiveHand - 有効な手札の構成
 * @param effectiveDeck - 有効なデッキの構成
 * @param activePatterns - チェックするアクティブなパターン
 * @returns 満たされた最も優先度の高いパターンと、関連付けられた全てのラベル
 */
const findSatisfiedPatternsAndLabels = (
  effectiveHand: Composition,
  effectiveDeck: Composition,
  activePatterns: ReadonlyArray<Pattern>,
): { allSatisfiedLabels: Array<string>; satisfiedPatternUids: Array<string> } => {
  const satisfiedPatterns: Array<Pattern> = []
  const allLabelsSet = new Set<string>() // 全てのラベルを格納する Set
  const satisfiedPatternUidsSet = new Set<string>() // 満たされたパターンの UID を格納する Set

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
  return { allSatisfiedLabels: allSatisfiedLabels, satisfiedPatternUids: satisfiedPatternUids }
}

/**
 * ポットをチェックし、最終的な成功状態を判断するヘルパー関数
 * 新しい findSatisfiedPatternsAndLabels 関数を使用します
 * @param hand - 手札の構成
 * @param remainingDeck - 残りのデッキの構成
 * @param activePatterns - チェックするアクティブなパターン
 * @param pot - チェックするポット
 */
const checkPotsAndPatterns = (
  hand: Composition,
  remainingDeck: Composition,
  activePatterns: ReadonlyArray<Pattern>,
  pot: PotState,
): CheckResult => {
  const prosperityUid = "prosperity_card" // 繁栄のカードの UID
  const desiresUid = "desires_card" // 欲望のカードの UID
  const handHasProsperity = (hand[prosperityUid] || 0) > 0 // 手札に繁栄のカードがあるか
  const handHasDesires = (hand[desiresUid] || 0) > 0 // 手札に欲望のカードがあるか
  const prosperityCost = pot.prosperity.cost // 繁栄のカードのコスト

  const finalPatternUidsSet = new Set<string>() // 最終的に満たされたパターンの UID を格納する Set
  const finalLabelsSet = new Set<string>() // 最終的に満たされたラベルの UID を格納する Set

  // シナリオ 1: 繁栄のカードが引かれた場合
  if (handHasProsperity && pot.prosperity.count > 0) {
    const remainingDeckSize = Object.values(remainingDeck).reduce((s, c) => s + c, 0) // 残りのデッキサイズ
    const initialHandWithoutProsperity = { ...hand } // 繁栄のカードを除いた初期手札
    initialHandWithoutProsperity[prosperityUid] = (initialHandWithoutProsperity[prosperityUid] || 0) - 1

    const { allSatisfiedLabels: initialLabels, satisfiedPatternUids: initialPatternUids } =
      findSatisfiedPatternsAndLabels(initialHandWithoutProsperity, remainingDeck, activePatterns) // 繁栄のカードを除いた手札でパターンとラベルを検索
    initialPatternUids.forEach((uid) => finalPatternUidsSet.add(uid)) // 初期結果を最終セットに追加
    initialLabels.forEach((uid) => finalLabelsSet.add(uid)) // 初期結果を最終セットに追加

    if (remainingDeckSize >= prosperityCost) {
      // 残りのデッキサイズがコスト以上の場合
      const deckUids = Object.keys(remainingDeck) // デッキにあるカードの UID
      for (const uidToAdd of deckUids) {
        // デッキから1枚引く各シナリオをシミュレーション
        if ((remainingDeck[uidToAdd] || 0) > 0) {
          // そのカードがデッキに存在する場合
          const effectiveHand = { ...initialHandWithoutProsperity } // 引いたカードを追加した有効な手札
          effectiveHand[uidToAdd] = (effectiveHand[uidToAdd] || 0) + 1
          const { allSatisfiedLabels: labels, satisfiedPatternUids: uids } = findSatisfiedPatternsAndLabels(
            effectiveHand,
            remainingDeck,
            activePatterns,
          ) // 有効な手札でパターンとラベルを検索
          uids.forEach((uid) => finalPatternUidsSet.add(uid)) // 結果を最終セットに追加
          labels.forEach((labelUid) => finalLabelsSet.add(labelUid)) // 結果を最終セットに追加
        }
      }
    }
  } else if (handHasDesires && pot.desiresOrExtravagance.count > 0) {
    // シナリオ 2: 欲望のカードが引かれた場合
    const { allSatisfiedLabels: initialLabels, satisfiedPatternUids: initialPatternUids } =
      findSatisfiedPatternsAndLabels(hand, remainingDeck, activePatterns) // 初期手札でパターンとラベルを検索
    initialPatternUids.forEach((uid) => finalPatternUidsSet.add(uid)) // 初期結果を最終セットに追加
    initialLabels.forEach((uid) => finalLabelsSet.add(uid)) // 初期結果を最終セットに追加

    const availableUids = Object.keys(remainingDeck).filter((uid) => (remainingDeck[uid] || 0) > 0) // デッキに残っているカードの UID

    for (let i = 0; i < availableUids.length; i++) {
      // デッキから異なる2枚を引くシナリオをシミュレーション
      for (let j = i + 1; j < availableUids.length; j++) {
        const uid1 = availableUids[i]
        const uid2 = availableUids[j]
        const effectiveHand = { ...hand } // 引いたカードを追加した有効な手札
        effectiveHand[uid1] = (effectiveHand[uid1] || 0) + 1
        effectiveHand[uid2] = (effectiveHand[uid2] || 0) + 1
        const { allSatisfiedLabels: labels, satisfiedPatternUids: uids } = findSatisfiedPatternsAndLabels(
          effectiveHand,
          remainingDeck,
          activePatterns,
        ) // 有効な手札でパターンとラベルを検索
        uids.forEach((uid) => finalPatternUidsSet.add(uid)) // 結果を最終セットに追加
        labels.forEach((labelUid) => finalLabelsSet.add(labelUid)) // 結果を最終セットに追加
      }
    }
    for (const uid of availableUids) {
      // デッキから同じカード2枚を引くシナリオをシミュレーション
      if ((remainingDeck[uid] || 0) >= 2) {
        // そのカードがデッキに2枚以上存在する場合
        const effectiveHand = { ...hand } // 引いたカードを追加した有効な手札
        effectiveHand[uid] = (effectiveHand[uid] || 0) + 2
        const { allSatisfiedLabels: labels, satisfiedPatternUids: uids } = findSatisfiedPatternsAndLabels(
          effectiveHand,
          remainingDeck,
          activePatterns,
        ) // 有効な手札でパターンとラベルを検索
        uids.forEach((uid) => finalPatternUidsSet.add(uid)) // 結果を最終セットに追加
        labels.forEach((labelUid) => finalLabelsSet.add(labelUid)) // 結果を最終セットに追加
      }
    }
  } else {
    // シナリオ 3: ポットカードが手札にない場合
    const { allSatisfiedLabels: labels, satisfiedPatternUids: uids } = findSatisfiedPatternsAndLabels(
      hand,
      remainingDeck,
      activePatterns,
    ) // 初期手札でパターンとラベルを検索
    uids.forEach((uid) => finalPatternUidsSet.add(uid)) // 結果を最終セットに追加
    labels.forEach((labelUid) => finalLabelsSet.add(labelUid)) // 結果を最終セットに追加
  }

  const finalPatternUidsArray = Array.from(finalPatternUidsSet).filter((uid) => uid && uid.length > 0) // 最終的なパターンの UID 配列
  const finalLabelsArray = Array.from(finalLabelsSet).filter((uid) => uid && uid.length > 0) // 最終的なラベルの UID 配列
  const isSuccess = finalPatternUidsArray.length > 0 || finalLabelsArray.length > 0 // 成功したかどうか (いずれかのパターンまたはラベルが満たされたか)

  return {
    isSuccess: isSuccess,
    labelUids: finalLabelsArray,
    patternUids: finalPatternUidsArray,
  }
}

type RecursiveCalcResult = {
  individualPatternSuccessCombinations: BigIntComposition
  labelSuccessCombinations: BigIntComposition
  overallSuccessCombinations: bigint
  totalCombinations: bigint
}

let memo: Record<string, RecursiveCalcResult> = {} // メモ化のためのオブジェクト
const createMemoKey = (index: number, slots: number, comp: Composition): string => {
  // メモ化キーを生成
  const sortedEntries = Object.entries(comp).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // 構成をソートして文字列化
  return `${index}|${slots}|${JSON.stringify(sortedEntries)}`
}

/**
 * 再帰関数 - ベースケースは新しい CheckResult 構造体を使用
 * @param cardUids - カードの UID の配列
 * @param cardIndex - 現在考慮しているカードのインデックス
 * @param currentHandComposition - 現在の手札の構成
 * @param remainingHandSlots - 残りの手札スロット数
 * @param originalDeckComposition - 元のデッキの構成
 * @param activePatterns - チェックするアクティブなパターン
 * @param allLabels - チェックする全てのラベル
 * @param pot - チェックするポット
 */
const recursiveCalcCombinations = (
  cardUids: Array<string>,
  cardIndex: number,
  currentHandComposition: Composition,
  remainingHandSlots: number,
  originalDeckComposition: Composition,
  activePatterns: ReadonlyArray<Pattern>,
  allLabels: Array<Label>,
  pot: PotState,
): RecursiveCalcResult => {
  // ベースケース
  if (cardIndex === cardUids.length || remainingHandSlots === 0) {
    if (remainingHandSlots === 0) {
      // 手札がいっぱいになった場合
      const remainingDeckComp: Composition = {} // 残りのデッキの構成を計算
      Object.keys(originalDeckComposition).forEach((uid) => {
        // 各カードについて
        const handCount: number = currentHandComposition[uid] || 0 // 手札にある数
        const originalCount: number = originalDeckComposition[uid] || 0 // 元のデッキにある数
        const remainingCount = originalCount - handCount // 残りのデッキにある数
        if (remainingCount > 0) {
          remainingDeckComp[uid] = remainingCount
        }
      })

      const checkResult = checkPotsAndPatterns(currentHandComposition, remainingDeckComp, activePatterns, pot) // ポットとパターンをチェック

      const result: RecursiveCalcResult = {
        // 結果オブジェクトを初期化
        individualPatternSuccessCombinations: {}, // 個別のパターン成功組み合わせ数
        labelSuccessCombinations: {}, // ラベル成功組み合わせ数
        overallSuccessCombinations: checkResult.isSuccess ? 1n : 0n, // 全体の成功組み合わせ数
        totalCombinations: 1n, // この手札構成の組み合わせ数は 1
      }
      checkResult.patternUids.forEach((patternUid) => {
        if (patternUid) {
          result.individualPatternSuccessCombinations[patternUid] = 1n
        }
      })
      checkResult.labelUids.forEach((labelUid) => {
        result.labelSuccessCombinations[labelUid] = (result.labelSuccessCombinations[labelUid] || 0n) + 1n
      })
      return result
    } else {
      return {
        individualPatternSuccessCombinations: {},
        labelSuccessCombinations: {},
        overallSuccessCombinations: 0n,
        totalCombinations: 0n,
      }
    }
  }

  // メモ化と再帰ステップ
  const memoKey = createMemoKey(cardIndex, remainingHandSlots, currentHandComposition) // メモ化キーを生成
  if (memoKey in memo) {
    // メモに存在する場合は結果を返す
    return memo[memoKey]
  }
  const totalResult: RecursiveCalcResult = {
    // このステップの結果を集計するオブジェクトを初期化
    individualPatternSuccessCombinations: {},
    labelSuccessCombinations: {},
    overallSuccessCombinations: 0n,
    totalCombinations: 0n,
  }
  const currentUid = cardUids[cardIndex] // 現在考慮しているカードの UID
  const originalCountForCurrentUid: number = originalDeckComposition[currentUid] || 0 // 元のデッキにある数
  const countInHandSoFar: number = currentHandComposition[currentUid] || 0 // 現在の手札にある数
  const availableToDrawCount = originalCountForCurrentUid - countInHandSoFar // このステップで引くことができる数
  const maxDrawForThisStep = Math.min(remainingHandSlots, availableToDrawCount) // このステップで引くことができる最大数 (残りのスロット数または利用可能な数)

  for (let drawCount = 0; drawCount <= maxDrawForThisStep; drawCount++) {
    // このカードを drawCount 枚引く各シナリオをシミュレーション
    const comb = combinations(availableToDrawCount, drawCount) // このカードを drawCount 枚引く組み合わせ数
    if (comb > 0n) {
      // 組み合わせ数が 0 より大きい場合のみ処理
      const nextHandComp = { ...currentHandComposition } // 次の再帰呼び出しに渡す手札の構成
      if (drawCount > 0) {
        // drawCount が 0 より大きい場合のみ手札の構成を更新
        nextHandComp[currentUid] = countInHandSoFar + drawCount
      }
      const subResult = recursiveCalcCombinations(
        // 次のカードに進んで再帰呼び出し
        cardUids,
        cardIndex + 1,
        nextHandComp,
        remainingHandSlots - drawCount, // 残りのスロット数を減らす
        originalDeckComposition,
        activePatterns,
        allLabels,
        pot,
      )
      if (subResult.totalCombinations > 0n) {
        // サブ結果の合計組み合わせ数が 0 より大きい場合のみ集計
        const weightedCombinations = comb * subResult.totalCombinations // このステップの組み合わせ数とサブ結果の組み合わせ数を乗算
        totalResult.totalCombinations += weightedCombinations // 合計組み合わせ数を加算
        totalResult.overallSuccessCombinations += comb * subResult.overallSuccessCombinations // 全体の成功組み合わせ数を加算

        Object.entries(subResult.individualPatternSuccessCombinations).forEach(
          // 個別のパターン成功組み合わせ数を集計
          ([patternUid, subCount]: [string, bigint]) => {
            if (patternUid) {
              const weightedSubCount = comb * subCount // 重み付けされたサブカウント
              totalResult.individualPatternSuccessCombinations[patternUid] =
                (totalResult.individualPatternSuccessCombinations[patternUid] || 0n) + weightedSubCount
            }
          },
        )
        Object.entries(subResult.labelSuccessCombinations).forEach(([labelUid, subCount]: [string, bigint]) => {
          // ラベル成功組み合わせ数を集計
          if (labelUid) {
            const weightedSubCount = comb * subCount // 重み付けされたサブカウント
            totalResult.labelSuccessCombinations[labelUid] =
              (totalResult.labelSuccessCombinations[labelUid] || 0n) + weightedSubCount
          }
        })
      }
    }
  }
  memo[memoKey] = totalResult // 結果をメモに保存
  return totalResult
}

/**
 * 組み合わせ論に基づいて正確な確率を計算します。
 * 注: checkSinglePattern 内のパターン内の条件をまたいだ異なるカードの要件を処理するロジックは、完全な正確性のために洗練が必要です。
 *
 * @param deck - デッキの状態。
 * @param card - カードの状態。
 * @param pattern - パターンの状態。
 * @param pot - ポットの状態。
 * @param labelState - ラベルの状態。
 * @returns 計算結果。計算が不可能な場合は null。
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

  // --- デッキの構成 ---
  const originalDeckComposition: Composition = {}
  let totalExplicitCards: number = 0

  // ポットカードが存在する場合、構成に追加
  if (pot.prosperity.count > 0) {
    originalDeckComposition["prosperity_card"] = pot.prosperity.count
    totalExplicitCards += pot.prosperity.count
  }
  if (pot.desiresOrExtravagance.count > 0) {
    originalDeckComposition["desires_card"] = pot.desiresOrExtravagance.count
    totalExplicitCards += pot.desiresOrExtravagance.count
  }

  for (const c of cards) {
    // 各カードについて
    if (c.count > 0) {
      const currentCount: number = originalDeckComposition[c.uid] || 0
      originalDeckComposition[c.uid] = currentCount + c.count
      totalExplicitCards += c.count
    }
  }
  const unknownCardCount = cardCount - totalExplicitCards // 不明なカードの数
  if (unknownCardCount < 0) {
    // ポット/カードの数がデッキサイズを超えている場合のエラーチェック
    console.error("エラー: ポット/カードの数がデッキサイズを超えています。")
    return null
  }
  if (unknownCardCount > 0) {
    // 不明なカードがある場合、構成に追加
    originalDeckComposition["unknown_card"] = unknownCardCount
  }

  // チェックサムの検証 (ポットカードを含む)
  let checkSum: number = 0
  Object.values(originalDeckComposition).forEach((count: number) => (checkSum += count))
  if (checkSum !== cardCount) {
    // デッキ構成の合計がデッキサイズと一致しない場合のエラーチェック
    console.error("エラー: デッキ構成のカウントが一致しません。")
    return null
  }
  if (cardCount < firstHand || firstHand < 0) {
    // 無効な手札サイズの場合のエラーチェック
    console.error("エラー: 無効な手札サイズです。")
    return null
  }

  // --- 合計組み合わせ数 --- (確率の分母)
  const totalCombinations_check = combinations(cardCount, firstHand) // 合計組み合わせ数を計算
  if (totalCombinations_check <= 0n && !(cardCount === 0 && firstHand === 0)) {
    // 合計組み合わせ数が 0 以下の場合のチェック (C(0,0)=1 は許容)
    // C(0,0) = 1 を許容
    if (cardCount >= firstHand && firstHand >= 0) {
      console.warn("警告: 合計組み合わせ数がゼロです。確率はゼロになります。")
      return {
        labelSuccessRates: {},
        overallProbability: "0.00",
        patternSuccessRates: {},
      }
    } else {
      console.error("エラー: 合計組み合わせ数の計算に失敗したか、ゼロまたは負の値になりました。")
      return null
    }
  }

  // --- アクティブなパターンをフィルタリングし、優先度でソート ---
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
    // 最適化: パターンもポットもない場合、確率は 0
    // ただし、ポットが存在する場合、ポット効果自体が成功とみなされる場合は計算が必要になる可能性がある (現在はモデル化されていない)
    return {
      labelSuccessRates: {},
      overallProbability: "0.00",
      patternSuccessRates: {},
    }
  }

  // --- 再帰を使用して成功組み合わせ数を計算 ---
  memo = {} // メモをリセット
  const cardUids = Object.keys(originalDeckComposition) // デッキにあるカードの UID の配列
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

  const denominator = totalCombinations_check // 分母として合計組み合わせ数を使用

  // 再帰的な合計組み合わせ数を C(n,k) と比較検証
  // 注: result.totalCombinations は、考えられる *全て* の最終的な手札の組み合わせの合計を表します。
  if (result.totalCombinations !== denominator && denominator > 0n) {
    console.warn(
      `再帰的な合計組み合わせ数 (${result.totalCombinations}) が C(n,k) (${denominator}) と一致しません。確率の分母には C(n,k) を使用します。`,
    )
  }

  // --- 結果の集計 ---
  // 結果から新しい overallSuccessCombinations を使用
  const overallSuccessCombinations: bigint = result.overallSuccessCombinations

  // --- 確率への変換 ---
  const overallProbability = denominator > 0n ? Number((overallSuccessCombinations * 10000n) / denominator) / 100 : 0 // 全体の成功確率を計算

  const patternSuccessRates: Record<string, string> = {} // パターン成功率を計算
  Object.entries(result.individualPatternSuccessCombinations).forEach(([patternId, count]: [string, bigint]) => {
    const rate = denominator > 0n ? Number((count * 10000n) / denominator) / 100 : 0
    patternSuccessRates[patternId] = sprintf("%.2f", rate)
  })

  const labelSuccessRates: Record<string, string> = {} // ラベル成功率を計算
  Object.entries(result.labelSuccessCombinations).forEach(([labelId, count]: [string, bigint]) => {
    const rate = denominator > 0n ? Number((count * 10000n) / denominator) / 100 : 0
    labelSuccessRates[labelId] = sprintf("%.2f", rate)
  })

  // 結果をソート
  const sortedLabelSuccessRates = Object.entries(labelSuccessRates) // ラベル成功率を降順にソート
    .sort(([, a], [, b]) => Number.parseFloat(b) - Number.parseFloat(a))
    .reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {})

  const sortedPatternSuccessRates = Object.entries(patternSuccessRates) // パターン成功率を降順にソート
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
