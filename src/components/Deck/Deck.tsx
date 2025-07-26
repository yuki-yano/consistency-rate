import type { FC } from "react";

import { Box, Card, CardBody, FormControl, FormLabel, Heading, Text } from "@chakra-ui/react";
import { Select as MultiSelect } from "chakra-react-select";
import { useAtom, useAtomValue } from "jotai";

import { deckAtom, calculationSettingsAtom, potAtom } from "../../state";
import { multiSelectStyles } from "../../theme";
import { DeckName } from "./DeckName";

export const Deck: FC = () => {
  const [deck, setDeck] = useAtom(deckAtom);
  const [settings, setSettings] = useAtom(calculationSettingsAtom);
  const pot = useAtomValue(potAtom);
  
  const isSimulationForced = pot.prosperity.count > 0;
  const effectiveMode = isSimulationForced ? "simulation" : settings.mode;

  return (
    <Card>
      <CardBody>
        <Heading as="h2" fontSize="lg" py={2}>
          デッキ情報
        </Heading>

        <DeckName />

        <Box my={2}>
          <FormControl>
            <FormLabel>枚数</FormLabel>
            <MultiSelect
              chakraStyles={multiSelectStyles}
              menuPortalTarget={document.body}
              onChange={(selectedValue) => {
                setDeck({
                  ...deck,
                  cardCount: Number(
                    (selectedValue as { label: string; value: string }).value
                  ),
                });
              }}
              options={Array.from({ length: 41 }, (_, i) => i + 20).map((i) => ({
                label: i.toString(),
                value: i.toString(),
              }))}
              value={[
                {
                  label: deck.cardCount.toString(),
                  value: deck.cardCount.toString(),
                },
              ]}
            />
          </FormControl>
        </Box>

        <Box my={2}>
          <FormControl>
            <FormLabel>初手枚数</FormLabel>
            <MultiSelect
              chakraStyles={multiSelectStyles}
              menuPortalTarget={document.body}
              onChange={(selectedValue) => {
                setDeck({
                  ...deck,
                  firstHand: Number(
                    (selectedValue as { label: string; value: string }).value
                  ),
                });
              }}
              options={Array.from({ length: 9 }, (_, i) => i + 1).map((i) => ({
                label: i.toString(),
                value: i.toString(),
              }))}
              value={[
                {
                  label: deck.firstHand.toString(),
                  value: deck.firstHand.toString(),
                },
              ]}
            />
          </FormControl>
        </Box>

        <Box my={2}>
          <FormControl>
            <FormLabel>計算モード</FormLabel>
            <MultiSelect
              chakraStyles={multiSelectStyles}
              menuPortalTarget={document.body}
              onChange={(selectedValue) => {
                setSettings({
                  ...settings,
                  mode: (selectedValue as { label: string; value: string }).value as "exact" | "simulation"
                });
              }}
              options={[
                { label: "厳密計算", value: "exact" },
                { label: "シミュレーション", value: "simulation" }
              ]}
              value={[
                {
                  label: effectiveMode === "exact" ? "厳密計算" : "シミュレーション",
                  value: effectiveMode,
                },
              ]}
              isDisabled={isSimulationForced}
            />
            {isSimulationForced && (
              <Text fontSize="xs" color="gray.600" mt={1}>
                ※ 金謙が有効なため、自動的にシミュレーションモードになります
              </Text>
            )}
          </FormControl>
        </Box>

        {effectiveMode === "simulation" && (
          <Box my={2}>
            <FormControl>
              <FormLabel>試行回数</FormLabel>
              <MultiSelect
                chakraStyles={multiSelectStyles}
                menuPortalTarget={document.body}
                onChange={(selectedValue) => {
                  setSettings({
                    ...settings,
                    simulationTrials: Number(
                      (selectedValue as { label: string; value: string }).value
                    ),
                  });
                }}
                options={[
                  { label: "1,000", value: "1000" },
                  { label: "10,000", value: "10000" },
                  { label: "100,000", value: "100000" },
                  { label: "1,000,000", value: "1000000" },
                ]}
                value={[
                  {
                    label: settings.simulationTrials.toLocaleString(),
                    value: settings.simulationTrials.toString(),
                  },
                ]}
              />
            </FormControl>
          </Box>
        )}
      </CardBody>
    </Card>
  );
}; 