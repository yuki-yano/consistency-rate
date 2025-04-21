import type { FC, FocusEvent } from "react";

import { Box, FormControl, FormLabel, Input, Textarea } from "@chakra-ui/react";
import { Select as MultiSelect } from "chakra-react-select";
import { useAtom, useAtomValue } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { focusAtom } from "jotai-optics";
import { useCallback, useMemo, useState } from "react";

import type { Pattern } from "../../state";

import { labelAtom, patternAtom } from "../../state";
import { multiSelectStyles } from "../../theme";

// usePattern フック
export const usePattern = (index: number) => {
  const patternItemAtom = useMemo(
    () => focusAtom(patternAtom, (optic) => optic.prop("patterns").at(index)),
    [index]
  );
  return useAtom(patternItemAtom) as [
    Pattern | undefined,
    (pattern: Pattern) => void,
  ];
};

// PatternNameInput コンポーネント
const PatternNameInput: FC<{ patternIndex: number }> = ({ patternIndex }) => {
  const [pattern] = usePattern(patternIndex);
  const [tmpName, setTmpName] = useState(pattern?.name ?? "");

  const updateName = useAtomCallback(
    useCallback(
      (get, set, name: string) => {
        const patterns = get(patternAtom);
        const newPatterns = patterns.patterns.map((p, i) => {
          if (i === patternIndex) {
            return { ...p, name };
          }
          return p;
        });

        set(patternAtom, {
          length: newPatterns.length,
          patterns: newPatterns,
        });
      },
      [patternIndex] // pattern を依存配列に含めると入力がリセットされる可能性
    )
  );

  const handleBlur = () => {
    updateName(tmpName);
  };

  // pattern が undefined の場合の早期リターン
  if (!pattern) return null;

  return (
    <Box my={2}>
      <FormControl>
        <FormLabel>パターン名</FormLabel>
        <Input
          onBlur={handleBlur}
          onChange={(e) => setTmpName(e.target.value)}
          value={tmpName}
        />
      </FormControl>
    </Box>
  );
};

// PatternLabelInput コンポーネント
const PatternLabelInput: FC<{ patternIndex: number }> = ({ patternIndex }) => {
  const [patternState] = useAtom(patternAtom);
  const labels = useAtomValue(labelAtom).labels;
  const currentLabels = patternState.patterns[patternIndex]?.labels ?? []; // Optional chaining and default value

  const updateLabels = useAtomCallback(
    useCallback(
      (_, set, selectedValues: Array<{ label: string; value: string }>) => {
        const newLabels = selectedValues.map((value) => ({
          uid: value.value,
        }));
        const currentPatterns = patternState.patterns; // Get current patterns
        const newPatterns = currentPatterns.map((p, i) => {
          if (i === patternIndex) {
            return { ...p, labels: newLabels };
          }
          return p;
        });
        set(patternAtom, {
          length: newPatterns.length,
          patterns: newPatterns,
        });
      },
      [patternIndex, patternState.patterns] // Add patternState.patterns to dependencies
    )
  );

  return (
    <Box my={2}>
      <FormControl>
        <FormLabel>ラベル</FormLabel>
        <MultiSelect
          chakraStyles={multiSelectStyles}
          closeMenuOnSelect={false}
          isClearable={false}
          isMulti
          menuPortalTarget={document.body}
          onChange={(selectedValues) => {
            updateLabels(
              selectedValues as Array<{ label: string; value: string }>
            );
          }}
          options={labels.map((label) => ({
            label: label.name,
            value: label.uid,
          }))}
          value={currentLabels.map((label) => ({
            label: labels.find((l) => l.uid === label.uid)?.name,
            value: label.uid,
          }))}
        />
      </FormControl>
    </Box>
  );
};

// PatternPriorityInput コンポーネント
const PatternPriorityInput: FC<{ patternIndex: number }> = ({ patternIndex }) => {
  const [pattern] = usePattern(patternIndex);
  const priority = pattern?.priority ?? 1; // Default priority to 1

  const updatePriority = useAtomCallback(
    useCallback(
      (get, set, priority: number) => {
        const patterns = get(patternAtom);
        const newPatterns = patterns.patterns.map((p, i) => {
          if (i === patternIndex) {
            return { ...p, priority };
          }
          return p;
        });

        set(patternAtom, {
          length: newPatterns.length,
          patterns: newPatterns,
        });
      },
      [patternIndex]
    )
  );

  // pattern が undefined の場合の早期リターン
  if (!pattern) return null;

  return (
    <Box my={2}>
      <FormControl>
        <FormLabel>優先度</FormLabel>
        <MultiSelect
          chakraStyles={multiSelectStyles}
          menuPortalTarget={document.body}
          onChange={(selectedValue) => {
            updatePriority(
              Number((selectedValue as { label: string; value: string }).value)
            );
          }}
          options={Array.from({ length: 10 }, (_, i) => i + 1).map((i) => ({
            label: i.toString(),
            value: i.toString(),
          }))}
          value={[
            {
              label: priority.toString(),
              value: priority.toString(),
            },
          ]}
        />
      </FormControl>
    </Box>
  );
};

// PatternMemoInput コンポーネント
const PatternMemoInput: FC<{ patternIndex: number }> = ({ patternIndex }) => {
  const [patternState, setPattern] = useAtom(patternAtom);
  const pattern = patternState.patterns[patternIndex];
  const [tmpMemo, setTmpMemo] = useState(pattern?.memo ?? "");

  const handleBlur = (e: FocusEvent<HTMLTextAreaElement>) => {
    const newPatterns = patternState.patterns.map((p, i) => {
      if (i === patternIndex) {
        return { ...p, memo: e.target.value };
      }
      return p;
    });
    setPattern({
      length: newPatterns.length,
      patterns: newPatterns,
    });
  };

  // pattern が undefined の場合の早期リターン
  if (pattern == null) return null;

  return (
    <Box my={2}>
      <FormControl>
        <FormLabel>メモ</FormLabel>
        <Textarea
          onBlur={handleBlur}
          onChange={(e) => setTmpMemo(e.target.value)}
          value={tmpMemo}
        />
      </FormControl>
    </Box>
  );
};

// PatternInput コンポーネント (統合)
export const PatternInput: FC<{ patternIndex: number }> = ({ patternIndex }) => {
  return (
    <Box py={2}>
      <PatternNameInput patternIndex={patternIndex} />
      <PatternLabelInput patternIndex={patternIndex} />
      <PatternPriorityInput patternIndex={patternIndex} />
      <PatternMemoInput patternIndex={patternIndex} />
    </Box>
  );
}; 