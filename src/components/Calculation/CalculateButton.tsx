import type { FC } from "react";

import { Button, HStack, Text } from "@chakra-ui/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";

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
} from "../../state";

export const CalculateButton: FC = () => {
  const deck = useAtomValue(deckAtom);
  const card = useAtomValue(cardsAtom);
  const pattern = useAtomValue(patternAtom);
  const pot = useAtomValue(potAtom);
  const label = useAtomValue(labelAtom);
  const settings = useAtomValue(calculationSettingsAtom);
  const setCalculationResult = useSetAtom(calculationResultAtom);

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
    setCalculationResult(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCalculate = () => {
    if (pattern.patterns.length === 0) {
      return;
    }
    const result = performCalculation();
    setCalculationResult(result);
  };

  const isInvalid = pattern.patterns.some((p) => p.conditions.some((c) => c.invalid));

  return (
    <HStack>
      <Button disabled={isInvalid} onClick={handleCalculate}>
        計算{shouldUseSimulation() ? " (シミュレーション)" : " (厳密計算)"}
      </Button>
      <Text as="b" color="red.400" fontSize="sm">
        {isInvalid ? "条件が不正です" : ""}
      </Text>
    </HStack>
  );
}; 
