import type { MultiValue } from "chakra-react-select";
import type { FC } from "react";

import {
  Card,
  CardBody,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  HStack,
  Icon,
} from "@chakra-ui/react";
import { Select as MultiSelect } from "chakra-react-select";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import { VscClose } from "react-icons/vsc";

import type { Condition, PatternMode } from "../../state";

import { cardsAtom, patternAtom } from "../../state";
import { multiSelectStyles } from "../../theme";

const SelectCard: FC<{
  condition: Condition;
  onChange: (updatedCondition: Condition) => void;
}> = ({ condition, onChange }) => {
  const cards = useAtomValue(cardsAtom).cards;
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    condition.uids.length === 0 ? "カードを選択してください" : undefined
  );

  const handleSelectionChange = (selectedValues: MultiValue<unknown>) => {
    const uids = (selectedValues as Array<{ label: string; value: string }>).map(
      (value) => value.value
    );
    let newCondition = { ...condition, uids };

    if (uids.length === 0) {
      setErrorMessage("カードを選択してください");
      newCondition = { ...newCondition, invalid: true };
    } else {
      setErrorMessage(undefined);
      newCondition = { ...newCondition, invalid: false };
    }

    onChange({ ...newCondition });
  };

  return (
    <FormControl isInvalid={!(errorMessage == null)}>
      <FormLabel>カードを選択</FormLabel>
      <MultiSelect
        chakraStyles={multiSelectStyles}
        closeMenuOnSelect={false}
        isClearable={false}
        isMulti
        menuPortalTarget={document.body}
        onChange={handleSelectionChange}
        options={cards.map((card) => ({
          label: card.name,
          value: card.uid,
        }))}
        value={condition.uids.map((uid) => ({
          label: cards.find((card) => card.uid === uid)?.name ?? "不明なカード",
          value: uid,
        }))}
      />
      {errorMessage != null && <FormErrorMessage>{errorMessage}</FormErrorMessage>}
    </FormControl>
  );
};

export const ConditionInput: FC<{
  conditionIndex: number;
  patternIndex: number;
}> = ({ conditionIndex, patternIndex }) => {
  const [patternState, setPattern] = useAtom(patternAtom);
  const pattern = patternState.patterns[patternIndex];

  if (pattern?.conditions[conditionIndex] == null) {
    return null;
  }
  const condition = pattern.conditions[conditionIndex];

  const onChange = (updatedCondition: Condition) => {
    const newConditions = pattern.conditions.map((c, i) => {
      if (i === conditionIndex) {
        return updatedCondition;
      }
      return c;
    });
    const newPatterns = patternState.patterns.map((p, i) => {
      if (i === patternIndex) {
        return { ...p, conditions: newConditions };
      }
      return p;
    });
    setPattern({
      length: newPatterns.length,
      patterns: newPatterns,
    });
  };

  const onDelete = () => {
    const newConditions = pattern.conditions.filter(
      (_, i) => i !== conditionIndex
    );
    const newPatterns = patternState.patterns.map((p, i) => {
      if (i === patternIndex) {
        return { ...p, conditions: newConditions };
      }
      return p;
    });
    setPattern({
      length: newPatterns.length,
      patterns: newPatterns,
    });
  };

  return (
    <Card shadow="xs">
      <CardBody>
        <HStack>
          <Icon as={VscClose} fontSize="xl" onClick={onDelete} />
          <Heading as="h3" fontSize="md">
            条件{conditionIndex + 1}
          </Heading>
        </HStack>

        <SelectCard condition={condition} onChange={onChange} />

        <FormControl my={2}>
          <FormLabel>枚数</FormLabel>
          <MultiSelect
            chakraStyles={multiSelectStyles}
            menuPortalTarget={document.body}
            onChange={(selectedValue) => {
              onChange({
                ...condition,
                count: Number(
                  (selectedValue as { label: string; value: string }).value
                ),
              });
            }}
            options={Array.from({ length: 6 }, (_, i) => i).map((i) => ({
              label: i.toString(),
              value: i.toString(),
            }))}
            value={[
              {
                label: condition.count.toString(),
                value: condition.count.toString(),
              },
            ]}
          />
        </FormControl>

        <FormControl my={2}>
          <FormLabel>条件</FormLabel>
          <MultiSelect
            chakraStyles={multiSelectStyles}
            menuPortalTarget={document.body}
            onChange={(selectedValue) => {
              onChange({
                ...condition,
                mode: (selectedValue as { label: string; value: string })
                  ?.value as PatternMode,
              });
            }}
            options={[
              { label: "以上ドロー", value: "required" },
              { label: "重複なしドロー", value: "required_distinct" },
              { label: "以上デッキに残す", value: "leave_deck" },
              { label: "ドローなし", value: "not_drawn" },
            ]}
            value={[
              {
                label:
                  condition.mode === "required"
                    ? "以上ドロー"
                    : condition.mode === "required_distinct"
                    ? "重複なしドロー"
                    : condition.mode === "leave_deck"
                    ? "以上デッキに残す"
                    : "ドローなし",
                value: condition.mode,
              },
            ]}
          />
        </FormControl>
      </CardBody>
    </Card>
  );
}; 
