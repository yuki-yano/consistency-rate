import type { FC } from "react";

import {
  Box,
  Card,
  CardBody,
  Collapse,
  Flex,
  FormControl,
  Icon,
  Input,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { VscClose } from "react-icons/vsc";

import type { Label as LabelType } from "../../state";

import { patternAtom } from "../../state";

export const Label: FC<{
  isExpanded: boolean;
  labelIndex: number;
  labels: Array<LabelType>;
  setLabelsState: ({ labels }: { labels: Array<LabelType> }) => void;
}> = ({ isExpanded, labelIndex, labels, setLabelsState }) => {
  const [patternsState, setPatternsState] = useAtom(patternAtom);
  const patterns = patternsState.patterns;
  const label = labels[labelIndex] as LabelType | undefined;

  const [tmpName, setTempName] = useState(label?.name ?? "");
  const [tmpMemo, setTempMemo] = useState(label?.memo ?? "");

  useEffect(() => {
    if (label) {
      setTempName(label.name);
      setTempMemo(label.memo ?? "");
    }
  }, [label]);

  const deleteLabel = (uid: string) => {
    const newLabels = labels.filter((l) => l.uid !== uid);
    setLabelsState({ labels: newLabels });

    const updatedPatterns = patterns.map((pattern) => ({
      ...pattern,
      labels: pattern.labels.filter((lbl) => lbl.uid !== uid),
    }));
    setPatternsState({
      length: updatedPatterns.length,
      patterns: updatedPatterns,
    });
  };

  const editLabel = (uid: string, newName: string, newMemo: string) => {
    const editedLabels = labels.map((l) => {
      if (l.uid === uid) {
        return { ...l, memo: newMemo, name: newName };
      }
      return l;
    });
    setLabelsState({ labels: editedLabels });
  };

  return (
    <Card>
      <CardBody>
        <Flex align="center" gap={2} justify="space-between">
          <Icon
            as={VscClose}
            fontSize="xl"
            onClick={() => deleteLabel(label?.uid ?? "")}
          />
          <Input
            onBlur={(e) => editLabel(label?.uid ?? "", e.target.value, tmpMemo)}
            onChange={(e) => setTempName(e.target.value)}
            value={tmpName}
          />
        </Flex>

        <Box mt={4}>
          <Collapse animateOpacity in={isExpanded}>
            <FormControl>
              <Textarea
                onBlur={() => editLabel(label?.uid ?? "", tmpName, tmpMemo)}
                onChange={(e) => setTempMemo(e.target.value)}
                placeholder="ラベルに関するメモ"
                value={tmpMemo}
              />
            </FormControl>
          </Collapse>
          {!isExpanded && tmpMemo && (
            <Text color="gray.600" fontSize="sm" whiteSpace="pre-wrap">
              {tmpMemo}
            </Text>
          )}
        </Box>
      </CardBody>
    </Card>
  );
}; 