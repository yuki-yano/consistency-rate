import type { FC } from "react";

import { Icon } from "@chakra-ui/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { LuCalculator } from "react-icons/lu";

import { calculateProbability } from "../../calc";
import {
  calculationResultAtom,
  cardsAtom,
  deckAtom,
  labelAtom,
  patternAtom,
  potAtom,
} from "../../state";

type Props = {
  onClick: () => void;
};

export const SpCalcButton: FC<Props> = ({ onClick }) => {
  const deck = useAtomValue(deckAtom);
  const card = useAtomValue(cardsAtom);
  const pattern = useAtomValue(patternAtom);
  const pot = useAtomValue(potAtom);
  const label = useAtomValue(labelAtom);
  const setCalculationResult = useSetAtom(calculationResultAtom);

  const isInvalid = pattern.patterns.some((p) =>
    p.conditions.some((c) => c.invalid)
  );

  const handleCalculate = () => {
    if (isInvalid) {
      return;
    }
    const result = calculateProbability(deck, card, pattern, pot, label);
    setCalculationResult(result);
    onClick();
  };

  // 初回レンダリング時に計算を実行 (パターンが存在し、不正でない場合)
  useEffect(() => {
    if (isInvalid || pattern.patterns.length === 0) {
      return;
    }

    const result = calculateProbability(deck, card, pattern, pot, label);
    setCalculationResult(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回のみ実行

  return (
    <Icon
      as={LuCalculator}
      bgColor="gray.300"
      bottom={6}
      boxShadow="md"
      color={isInvalid ? "gray.400" : "gray.600"}
      cursor="pointer"
      h={14}
      onClick={handleCalculate}
      p={2}
      position="fixed"
      right={6}
      rounded="full"
      shadow="none"
      w={14}
    />
  );
}; 
