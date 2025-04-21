import { Card, CardBody, Heading, ListItem, Text, UnorderedList } from "@chakra-ui/react";
import { useAtomValue } from "jotai";
import { forwardRef } from "react";

import { calculationResultAtom, labelAtom, patternAtom } from "../../state";

export const SuccessRates = forwardRef<HTMLDivElement>((_, ref) => {
  const calculationResult = useAtomValue(calculationResultAtom);
  const labels = useAtomValue(labelAtom);
  const pattern = useAtomValue(patternAtom);

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
                </Text>
              </ListItem>
              {Object.entries(calculationResult.patternSuccessRates).map(
                ([patternId, rate]) => (
                  <ListItem key={patternId} ml={2}>
                    <Text fontSize="md">
                      {pattern.patterns.find((p) => p.uid === patternId)?.name}:
                      {" "}
                      {rate}%
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