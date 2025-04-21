import type { FC } from "react";

import { Box, Button } from "@chakra-ui/react";
import { useAtom, useAtomValue } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { focusAtom } from "jotai-optics";
import { useCallback, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";

import { patternAtom } from "../../state";
import { PatternItem } from "./PatternItem";

// AddPatternButton コンポーネント
const AddPatternButton: FC = () => {
  const [patternState, setPatternState] = useAtom(patternAtom);
  const patterns = patternState.patterns;

  const addPattern = () => {
    const newPattern = {
      active: true,
      conditions: [],
      expanded: true,
      labels: [],
      memo: "",
      name: `パターン${patterns.length + 1}`,
      priority: 1,
      uid: uuidv4(),
    };
    setPatternState({
      length: patterns.length + 1,
      patterns: patterns.concat(newPattern),
    });
  };

  return (
    <Button
      onClick={() => {
        addPattern();
      }}
    >
      パターンを追加
    </Button>
  );
};

// PatternList コンポーネント
export const PatternList: FC = () => {
  const patternLengthAtom = useMemo(
    () => focusAtom(patternAtom, (optic) => optic.prop("length")),
    []
  );
  const patternLength = useAtomValue(patternLengthAtom);

  const initialPatternLength = useAtomCallback(
    useCallback((get, set) => {
      const patterns = get(patternAtom).patterns;
      const length = patterns.length;

      set(patternAtom, {
        length,
        patterns,
      });
    }, []),
  );

  useEffect(() => {
    initialPatternLength();
  }, [initialPatternLength]);

  return (
    <Box>
      <AddPatternButton />
      {Array.from({ length: patternLength }).map((_, index) => (
        <Box key={index} my={4}>
          <PatternItem index={index} />
        </Box>
      ))}
    </Box>
  );
}; 