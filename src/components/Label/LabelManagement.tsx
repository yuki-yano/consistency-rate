import type { FC } from "react";

import { Box, Button, Flex, Grid, Icon } from "@chakra-ui/react";
import { useAtom } from "jotai";
import { LuChevronsUpDown } from "react-icons/lu";
import { v4 as uuidv4 } from "uuid";

import type { Label as LabelType } from "../../state";

import { isLabelMemoExpandedAtom, labelAtom } from "../../state";
import { Label } from "./Label";

export const LabelManagement: FC = () => {
  const [labelsState, setLabelsState] = useAtom(labelAtom);
  const labels = labelsState.labels;
  const [isExpanded, setIsExpanded] = useAtom(isLabelMemoExpandedAtom);

  const addLabel = () => {
    const labelToAdd: LabelType = {
      memo: "",
      name: `ラベル${labels.length + 1}`,
      uid: uuidv4(),
    };
    setLabelsState({ labels: [...labels, labelToAdd] });
  };

  return (
    <Box mb={4}>
      <Flex gap={2} mb={4}>
        <Button onClick={addLabel}>ラベルを追加</Button>
        <Button
          aria-label={isExpanded ? "ラベルのメモを閉じる" : "ラベルのメモを開く"}
          leftIcon={<Icon as={LuChevronsUpDown} />}
          onClick={() => setIsExpanded(!isExpanded)}
          variant={isExpanded ? "solid" : "outline"}
        >
          メモを開閉
        </Button>
      </Flex>
      <Grid gap={4} templateColumns="repeat(auto-fill, minmax(300px, 1fr))">
        {labels.map((_, index) => (
          <Label
            isExpanded={isExpanded}
            key={index}
            labelIndex={index}
            labels={labels}
            setLabelsState={setLabelsState}
          />
        ))}
      </Grid>
    </Box>
  );
};
