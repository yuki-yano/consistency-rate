import { Card, CardBody, Heading, ListItem, Text, UnorderedList, useBreakpointValue } from "@chakra-ui/react";
import { useAtomValue } from "jotai";
import { forwardRef } from "react";

import {
  calculationResultAtom,
  calculationSettingsAtom,
  labelAtom,
  patternAtom,
  potAtom,
  previousCalculationResultAtom,
  showDeltaAtom,
} from "../../state";

export const SuccessRates = forwardRef<HTMLDivElement>((_, ref) => {
  const calculationResult = useAtomValue(calculationResultAtom);
  const previousCalculationResult = useAtomValue(previousCalculationResultAtom);
  const labels = useAtomValue(labelAtom);
  const pattern = useAtomValue(patternAtom);
  const showDelta = useAtomValue(showDeltaAtom);
  const settings = useAtomValue(calculationSettingsAtom);
  const pot = useAtomValue(potAtom);
  const isExact = settings.mode !== "simulation" && pot.prosperity.count === 0;
  const isDesktop = useBreakpointValue({ base: false, md: true }) ?? false;

  const toNum = (s?: string | null) => {
    if (s == null) return null;
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : null;
  };

  // 前回が未定義、もしくは差分が実質ゼロのときは表示しない
  const renderDelta = (nowStr?: string, prevStr?: string) => {
    if (previousCalculationResult?.mode !== "exact") return null; // 前回が厳密以外なら非表示
    if (!showDelta || !isExact || !isDesktop) return null; // 厳密計算かつPC表示のみ
    const now = toNum(nowStr);
    const prev = toNum(prevStr);
    if (now == null || prev == null) return null;
    const diff = now - prev;
    const eps = 0.005; // 小数第2位丸め誤差吸収
    if (Math.abs(diff) < eps) return null;
    const sign = diff > 0 ? "+" : diff < 0 ? "-" : ""; // マイナスも明示
    const color = diff > 0 ? "green.500" : "red.500";
    return (
      <Text as="span" color={color} ml={2}>
        ({sign}{Math.abs(diff).toFixed(2)}%)
      </Text>
    );
  };

  return (
    <>
      <Card ref={ref}>
        <CardBody>
          <Heading as="h2" fontSize="lg" py={2}>
            初動・パターン成立率
          </Heading>

          {calculationResult != null && (
            <UnorderedList>
              <ListItem ml={2}>
                <Text fontSize="md">
                  全体初動率: {calculationResult.overallProbability}%
                  {renderDelta(
                    calculationResult.overallProbability,
                    previousCalculationResult?.overallProbability
                  )}
                </Text>
              </ListItem>
              {Object.entries(calculationResult.patternSuccessRates).map(
                ([patternId, rate]) => (
                  <ListItem key={patternId} ml={2}>
                    <Text fontSize="md">
                      {pattern.patterns.find((p) => p.uid === patternId)?.name}:
                      {" "}
                      {rate}%
                      {renderDelta(
                        rate,
                        previousCalculationResult?.patternSuccessRates?.[patternId]
                      )}
                    </Text>
                  </ListItem>
                )
              )}
            </UnorderedList>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Heading as="h2" fontSize="lg" py={2}>
            ラベル別成立率
          </Heading>

          {calculationResult != null && (
            <UnorderedList>
              {Object.entries(calculationResult.labelSuccessRates).map(
                ([label, rate]) => {
                  const l = labels.labels.find((l) => l.uid === label);

                  return (
                    <ListItem key={label} ml={2}>
                      <Text fontSize="md">
                        {l?.name}: {rate}%
                        {renderDelta(
                          rate,
                          previousCalculationResult?.labelSuccessRates?.[label]
                        )}
                      </Text>
                    </ListItem>
                  );
                }
              )}
            </UnorderedList>
          )}
        </CardBody>
      </Card>
    </>
  );
}); 
