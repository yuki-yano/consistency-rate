import type { FC } from "react";

import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Grid,
  GridItem,
  Icon,
  Text,
} from "@chakra-ui/react";
import { useAtomValue } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback, useState } from "react";
import {
  LuCheckCircle2,
  LuCircle,
} from "react-icons/lu";
import {
  VscArrowCircleDown,
  VscArrowCircleUp,
  VscClose,
  VscCopy,
} from "react-icons/vsc";
import { v4 as uuidv4 } from "uuid";

import type { Pattern } from "../../state";

import { labelAtom, patternAtom } from "../../state";
import { ConditionInput } from "./ConditionInput";
import { PatternInput, usePattern } from "./PatternInput";

// PatternItemLabels コンポーネント
const PatternItemLabels: FC<{ patternIndex: number }> = ({ patternIndex }) => {
  const pattern = useAtomValue(patternAtom).patterns[patternIndex];
  const labels = useAtomValue(labelAtom).labels;

  // パターンが存在しない場合のガード
  if (pattern == null) return null;

  return (
    <Text color="gray.600" fontSize="md">
      ラベル:&nbsp;
      {pattern.labels
        .map((label) => labels.find((l) => l.uid === label.uid)?.name)
        .filter(Boolean)
        .join(", ")}
    </Text>
  );
};

// PatternItem コンポーネント
export const PatternItem: FC<{ index: number }> = ({ index }) => {
  const [pattern] = usePattern(index);
  // pattern.active の初期値を設定し、pattern が undefined の場合も考慮
  const [active, setActive] = useState(pattern?.active ?? true);
  const [expanded, setExpanded] = useState(pattern?.expanded ?? false);

  const addCondition = useAtomCallback(
    useCallback(
      (get, set) => {
        const newCondition = {
          count: 1,
          invalid: true, // 初期状態は不正
          mode: "required",
          uids: [],
        } as const; // as const を追加
        const patterns = get(patternAtom);
        const newPatterns = patterns.patterns.map((p, i) => {
          if (i === index) {
            return { ...p, conditions: [...p.conditions, newCondition] };
          }
          return p;
        }) as Array<Pattern>; // 型アサーションを追加
        set(patternAtom, {
          length: newPatterns.length,
          patterns: newPatterns,
        });
      },
      [index]
    )
  );

  const deletePattern = useAtomCallback(
    useCallback(
      (get, set) => {
        const patterns = get(patternAtom).patterns;
        set(patternAtom, {
          length: patterns.length - 1,
          patterns: patterns.filter((_, i) => i !== index),
        });
      },
      [index]
    )
  );

  const duplicatePattern = useAtomCallback(
    useCallback(
      (get, set) => {
        const patterns = get(patternAtom).patterns;
        if (!pattern) return; // pattern が null の場合は何もしない
        const newPattern = {
          ...pattern,
          active: true,
          expanded: true,
          name: `${pattern.name} - コピー`,
          uid: uuidv4(),
        };
        set(patternAtom, {
          length: patterns.length + 1,
          patterns: [...patterns, newPattern],
        });
      },
      [pattern] // pattern を依存配列に追加
    )
  );

  const handleToggleActive = useAtomCallback(
    useCallback(
      (get, set, index: number) => {
        const patterns = get(patternAtom).patterns;
        const newPatterns = patterns.map((p, i) => {
          if (i === index) {
            return { ...p, active: active != null ? !active : true };
          }
          return p;
        });
        set(patternAtom, {
          length: newPatterns.length,
          patterns: newPatterns,
        });
        setActive((prev) => (prev != null ? !prev : true));
      },
      [active] // active を依存配列に追加
    )
  );

  const movePatternUp = useAtomCallback(
    useCallback(
      (get, set, index: number) => {
        const patterns = get(patternAtom).patterns;
        if (index > 0) {
          const newPatterns = [...patterns];
          const [movedPattern] = newPatterns.splice(index, 1);
          newPatterns.splice(index - 1, 0, movedPattern);
          set(patternAtom, {
            length: newPatterns.length,
            patterns: newPatterns,
          });
        }
      },
      [] // index は引数なので依存配列に不要
    )
  );

  const movePatternDown = useAtomCallback(
    useCallback(
      (get, set, index: number) => {
        const patterns = get(patternAtom).patterns;
        if (index < patterns.length - 1) {
          const newPatterns = [...patterns];
          const [movedPattern] = newPatterns.splice(index, 1);
          newPatterns.splice(index + 1, 0, movedPattern);
          set(patternAtom, {
            length: newPatterns.length,
            patterns: newPatterns,
          });
        }
      },
      [] // index は引数なので依存配列に不要
    )
  );

  // pattern が undefined の場合の早期リターン
  if (pattern == null) {
    return null;
  }

  const isInvalid = pattern.conditions.some((condition) => condition.invalid);

  return (
    <Card my={4}>
      <CardBody>
        <Flex gap={3} mb={2}>
          <Icon
            as={VscClose}
            color="gray.600"
            fontSize="xl"
            onClick={() => deletePattern()}
          />
          <Icon
            as={VscCopy}
            color="gray.600"
            fontSize="xl"
            onClick={duplicatePattern}
          />
          <Icon
            as={VscArrowCircleUp}
            color="gray.600"
            fontSize="xl"
            onClick={() => {
              movePatternUp(index);
            }}
          />
          <Icon
            as={VscArrowCircleDown}
            color="gray.600"
            fontSize="xl"
            onClick={() => {
              movePatternDown(index);
            }}
          />
        </Flex>

        <Flex align="center" gap={1}>
          <Icon
            as={active ? LuCheckCircle2 : LuCircle}
            fontSize="xl"
            onClick={() => {
              handleToggleActive(index);
            }}
          />

          <Accordion
            allowToggle
            index={expanded ? 0 : -1}
            onChange={() => setExpanded(!expanded)}
            w="full"
          >
            <AccordionItem border="none">
              <h2>
                <AccordionButton
                  _hover={{
                    bg: "white",
                  }}
                >
                  <Flex
                    alignItems="flex-end"
                    as="span"
                    flex="1"
                    gap={2}
                    textAlign="left"
                  >
                    <Text
                      as="b"
                      color={active ? "gray.800" : "gray.500"}
                      fontSize="lg"
                      textDecoration={isInvalid ? "line-through" : "none"}
                    >
                      {pattern.name}
                    </Text>
                    {isInvalid && (
                      <Text as="b" color="red.400">
                        条件が不正です
                      </Text>
                    )}
                  </Flex>
                  <AccordionIcon />
                </AccordionButton>
              </h2>

              <Box ml={4}>
                <PatternItemLabels patternIndex={index} />
                <Text color="gray.600" fontSize="md">
                  優先度: {pattern.priority}
                </Text>
              </Box>

              <AccordionPanel>
                {expanded && (
                  <>
                    <Grid
                      gap={4}
                      templateColumns="repeat(auto-fill, minmax(250px, 1fr))"
                    >
                      <GridItem rowSpan={3}>
                        <PatternInput patternIndex={index} />
                      </GridItem>
                      {pattern.conditions.map((_, conditionIndex) => (
                        <GridItem colSpan={1} key={conditionIndex}>
                          <ConditionInput
                            conditionIndex={conditionIndex}
                            patternIndex={index}
                          />
                        </GridItem>
                      ))}
                    </Grid>

                    <Button mt={4} onClick={addCondition}>
                      条件を追加
                    </Button>
                  </>
                )}
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </Flex>
      </CardBody>
    </Card>
  );
}; 