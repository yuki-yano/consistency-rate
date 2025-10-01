import type { FC } from "react";

import { Alert, AlertDescription, AlertIcon, Box, Button, Flex, Grid, Icon } from "@chakra-ui/react";
import { useAtom, useAtomValue } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback, useMemo } from "react";
import { LuChevronsUpDown } from "react-icons/lu";
import { v4 as uuidv4 } from "uuid";

import { cardsAtom, deckAtom, isCardMemoExpandedAtom, potAtom } from "../../state";
import { CardItem } from "./CardItem";

export const CardList: FC = () => {
  const cards = useAtomValue(cardsAtom).cards;
  const deck = useAtomValue(deckAtom);
  const pot = useAtomValue(potAtom);
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

  const cardCountError = useMemo(() => {
    const totalCards = cards.reduce((sum, card) => sum + card.count, 0) + pot.prosperity.count + pot.desiresOrExtravagance.count;
    const excess = totalCards - deck.cardCount;
    if (excess > 0) {
      return {
        deckSize: deck.cardCount,
        totalCards,
        excess,
      };
    }
    return null;
  }, [cards, deck.cardCount, pot.prosperity.count, pot.desiresOrExtravagance.count]);

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

      {cardCountError && (
        <Alert status="warning" mb={4}>
          <AlertIcon />
          <AlertDescription>
            警告: カード合計が{cardCountError.excess}枚超過しています (デッキ: {cardCountError.deckSize}枚 / 合計: {cardCountError.totalCards}枚)
          </AlertDescription>
        </Alert>
      )}

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
