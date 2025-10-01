import type { FC } from "react";

import { Button, HStack, Text } from "@chakra-ui/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo } from "react";

import { calculateProbability } from "../../calc";
import { calculateProbabilityBySimulation } from "../../calcSimulation";
import {
  calculationResultAtom,
  calculationSettingsAtom,
  cardsAtom,
  deckAtom,
  labelAtom,
  patternAtom,
  potAtom,
  previousCalculationResultAtom,
  showDeltaAtom,
  showZeroPatternsAtom,
} from "../../state";

export const CalculateButton: FC = () => {
  const deck = useAtomValue(deckAtom);
  const card = useAtomValue(cardsAtom);
  const pattern = useAtomValue(patternAtom);
  const pot = useAtomValue(potAtom);
  const label = useAtomValue(labelAtom);
  const settings = useAtomValue(calculationSettingsAtom);
  const setCalculationResult = useSetAtom(calculationResultAtom);
  const setPreviousCalculationResult = useSetAtom(previousCalculationResultAtom);
  const currentResult = useAtomValue(calculationResultAtom);
  const [showDelta, setShowDelta] = useAtom(showDeltaAtom);
  const [showZeroPatterns, setShowZeroPatterns] = useAtom(showZeroPatternsAtom);

  const shouldUseSimulation = () => {
    // Prosperityカードがある場合は自動的にシミュレーション
    if (pot.prosperity.count > 0) {
      return true;
    }
    // 手動でシミュレーションモードが選択されている場合
    if (settings.mode === "simulation") {
      return true;
    }
    return false;
  };
  const isExactActive = !shouldUseSimulation();

  const performCalculation = () => {
    if (shouldUseSimulation()) {
      return calculateProbabilityBySimulation(deck, card, pattern, pot, label, settings.simulationTrials);
    } else {
      return calculateProbability(deck, card, pattern, pot, label);
    }
  };

  // 初回レンダリング時に計算を実行 (パターンが存在する場合)
  useEffect(() => {
    if (pattern.patterns.length === 0) {
      return;
    }
    const result = performCalculation();
    // 初回は前回結果なし。直前の結果が厳密な場合のみ前回として保持
    if (currentResult?.mode === "exact") {
      setPreviousCalculationResult(currentResult);
    }
    setCalculationResult(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCalculate = () => {
    if (pattern.patterns.length === 0) {
      return;
    }
    const result = performCalculation();
    // 直前の結果が厳密な場合のみ、前回として保存
    if (currentResult?.mode === "exact") {
      setPreviousCalculationResult(currentResult);
    }
    setCalculationResult(result);
  };

  const isInvalid = pattern.patterns.some((p) => p.conditions.some((c) => c.invalid));

  const hasCardCountError = useMemo(() => {
    const totalCards = card.cards.reduce((sum, c) => sum + c.count, 0) + pot.prosperity.count + pot.desiresOrExtravagance.count;
    return totalCards > deck.cardCount;
  }, [card.cards, deck.cardCount, pot.prosperity.count, pot.desiresOrExtravagance.count]);

  return (
    <HStack>
      <Button disabled={isInvalid || hasCardCountError} onClick={handleCalculate}>
        計算{shouldUseSimulation() ? " (シミュレーション)" : " (厳密計算)"}
      </Button>
      <Button
        onClick={() => setShowDelta((v) => !v)}
        size="sm"
        aria-pressed={showDelta}
        variant="solid"
        isDisabled={!isExactActive}
        colorScheme={isExactActive && showDelta ? "teal" : undefined}
        bgColor={!isExactActive ? "gray.200" : showDelta ? "teal.500" : "gray.300"}
        color={!isExactActive ? "gray.500" : showDelta ? "white" : "gray.700"}
        borderWidth={!isExactActive || !showDelta ? "1px" : undefined}
        borderColor={!isExactActive ? "gray.300" : !showDelta ? "gray.400" : undefined}
        _hover={{ bgColor: !isExactActive ? "gray.200" : showDelta ? "teal.600" : "gray.400" }}
        _active={{ bgColor: !isExactActive ? "gray.200" : showDelta ? "teal.700" : "gray.500" }}
        title={!isExactActive ? "厳密計算時のみ有効" : undefined}
      >
        差分表示: {showDelta ? "ON" : "OFF"}
      </Button>
      <Button
        onClick={() => setShowZeroPatterns((v) => !v)}
        size="sm"
        aria-pressed={showZeroPatterns}
        variant="solid"
        colorScheme={showZeroPatterns ? "blue" : undefined}
        bgColor={showZeroPatterns ? "blue.500" : "gray.300"}
        color={showZeroPatterns ? "white" : "gray.700"}
        borderWidth={!showZeroPatterns ? "1px" : undefined}
        borderColor={!showZeroPatterns ? "gray.400" : undefined}
        _hover={{ bgColor: showZeroPatterns ? "blue.600" : "gray.400" }}
        _active={{ bgColor: showZeroPatterns ? "blue.700" : "gray.500" }}
      >
        0%表示: {showZeroPatterns ? "ON" : "OFF"}
      </Button>
      <Text as="b" color="red.400" fontSize="sm">
        {isInvalid ? "条件が不正です" : hasCardCountError ? "カード枚数がデッキサイズを超えています" : ""}
      </Text>
    </HStack>
  );
};
