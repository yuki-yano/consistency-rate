import type { FC } from "react";

import { Box, Button, Flex, Grid, Icon } from "@chakra-ui/react";
import { useAtom, useAtomValue } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { LuChevronsUpDown } from "react-icons/lu";
import { v4 as uuidv4 } from "uuid";

import { cardsAtom, isCardMemoExpandedAtom } from "../../state";
import { CardItem } from "./CardItem";

export const CardList: FC = () => {
  const cards = useAtomValue(cardsAtom).cards;
  const [isExpanded, setIsExpanded] = useAtom(isCardMemoExpandedAtom);

  const addCard = useAtomCallback(
    useCallback((get, set) => {
      const cards = get(cardsAtom).cards;
      const newCards = cards.concat({
        count: 1,
        memo: "",
        name: `カード${cards.length + 1}`,
        uid: uuidv4(),
      });
      set(cardsAtom, {
        cards: newCards,
        length: newCards.length,
      });
    }, []),
  );

  return (
    <Box>
      <Flex gap={2} mb={4}>
        <Button onClick={() => addCard()}>カードを追加</Button>
        <Button
          aria-label={isExpanded ? "カードのメモを閉じる" : "カードのメモを開く"}
          leftIcon={<Icon as={LuChevronsUpDown} />}
          onClick={() => setIsExpanded(!isExpanded)}
          variant={isExpanded ? "solid" : "outline"}
        >
          メモを開閉
        </Button>
      </Flex>

      <Grid gap={4} templateColumns="repeat(auto-fill, minmax(300px, 1fr))">
        {cards.map((card, index) => (
          <CardItem
            index={index}
            isExpanded={isExpanded}
            key={card.uid}
            uid={card.uid}
          />
        ))}
      </Grid>
    </Box>
  );
}; 