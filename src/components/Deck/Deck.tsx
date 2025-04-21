import type { FC } from "react";

import { Box, Card, CardBody, FormControl, FormLabel, Heading } from "@chakra-ui/react";
import { Select as MultiSelect } from "chakra-react-select";
import { useAtom } from "jotai";

import { deckAtom } from "../../state";
import { multiSelectStyles } from "../../theme";
import { DeckName } from "./DeckName";

export const Deck: FC = () => {
  const [deck, setDeck] = useAtom(deckAtom);

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
      </CardBody>
    </Card>
  );
}; 