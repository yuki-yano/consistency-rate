import type { FC } from "react";

import { Button, HStack, Text } from "@chakra-ui/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";

import { calculateProbability } from "../../calc";
import {
  calculationResultAtom,
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
  const setCalculationResult = useSetAtom(calculationResultAtom);

  // 初回レンダリング時に計算を実行 (パターンが存在する場合)
  useEffect(() => {
    if (pattern.patterns.length === 0) {
      return;
    }
    const result = calculateProbability(deck, card, pattern, pot, label);
    setCalculationResult(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCalculate = () => {
    if (pattern.patterns.length === 0) {
      return;
    }
    const result = calculateProbability(deck, card, pattern, pot, label);
    setCalculationResult(result);
  };

  const isInvalid = pattern.patterns.some((p) => p.conditions.some((c) => c.invalid));

  return (
    <HStack>
      <Button disabled={isInvalid} onClick={handleCalculate}>
        計算
      </Button>
      <Text as="b" color="red.400" fontSize="sm">
        {isInvalid ? "条件が不正です" : ""}
      </Text>
    </HStack>
  );
}; 
