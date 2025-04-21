import type { FC } from "react";

import {
  Box,
  Card,
  CardBody,
  Collapse,
  Flex,
  FormControl,
  FormLabel,
  Icon,
  Input,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { Select as MultiSelect } from "chakra-react-select";
import { useAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { focusAtom } from "jotai-optics";
import { memo, useCallback, useMemo, useState } from "react";
import { VscArrowCircleDown, VscArrowCircleUp, VscClose } from "react-icons/vsc";

import type { CardData } from "../../state";

import { cardsAtom, patternAtom } from "../../state";
import { multiSelectStyles } from "../../theme";

// useCard フック
const useCard = (uid: string) => {
  const cardItemAtom = useMemo(
    () =>
      focusAtom(cardsAtom, (optic) =>
        optic.prop("cards").find((card) => card.uid === uid)
      ),
    [uid]
  );
  return useAtom(cardItemAtom) as [
    CardData | undefined,
    (card: CardData) => void,
  ];
};

export const CardItem: FC<{ index: number; isExpanded: boolean; uid: string }> =
  memo(({ index, isExpanded, uid }) => {
    const [card, setCard] = useCard(uid);
    // 初期値の設定を useEffect に移動するか、早期リターン前に宣言する
    const initialName = card?.name ?? "";
    const initialMemo = card?.memo ?? "";
    const [tmpName, setTmpName] = useState(initialName);
    const [tmpMemo, setTmpMemo] = useState(initialMemo);

    // フック定義を早期リターンの前に移動
    const updateCardName = useCallback(
      (name: string) => {
        if (card) setCard({ ...card, name });
      },
      [card, setCard]
    );

    const updateCardCount = useCallback(
      (count: number) => {
        if (card) setCard({ ...card, count });
      },
      [card, setCard]
    );

    const updateCardMemo = useCallback(
      (memo: string) => {
        if (card) setCard({ ...card, memo });
      },
      [card, setCard]
    );

    const handleDeleteCard = useAtomCallback(
      useCallback(
        (get, set, uid: string) => {
          const cards = get(cardsAtom).cards;
          const newCards = cards.filter((c) => c.uid !== uid);
          set(cardsAtom, {
            cards: newCards,
            length: newCards.length,
          });

          const patterns = get(patternAtom).patterns;
          const updatedPatterns = patterns.map((pattern) => {
            const updatedConditions = pattern.conditions.map((condition) => ({
              ...condition,
              uids: condition.uids.filter((id) => id !== uid),
            }));
            return { ...pattern, conditions: updatedConditions };
          });
          set(patternAtom, {
            length: updatedPatterns.length,
            patterns: updatedPatterns,
          });
        },
        []
      )
    );

    const moveCardUp = useAtomCallback(
      useCallback(
        (get, set, index: number) => {
          const cards = get(cardsAtom).cards;
          if (index > 0) {
            const newCards = [...cards];
            const [movedCard] = newCards.splice(index, 1);
            newCards.splice(index - 1, 0, movedCard);
            set(cardsAtom, {
              cards: newCards,
              length: newCards.length,
            });
          }
        },
        []
      )
    );

    const moveCardDown = useAtomCallback(
      useCallback(
        (get, set, index: number) => {
          const cards = get(cardsAtom).cards;
          if (index < cards.length - 1) {
            const newCards = [...cards];
            const [movedCard] = newCards.splice(index, 1);
            newCards.splice(index + 1, 0, movedCard);
            set(cardsAtom, {
              cards: newCards,
              length: newCards.length,
            });
          }
        },
        []
      )
    );

    // card が undefined の場合の早期リターン
    if (!card) {
      return null;
    }

    // state が card の変更に追随するように useEffect を追加
    // useEffect(() => {
    //   setTmpName(card.name);
    //   setTmpMemo(card.memo);
    // }, [card]);
    // ↑ このuseEffectを入れると入力がリセットされることがあるため、Input/TextareaのonBlurで更新する方針のままにする

    return (
      <Card py={2}>
        <CardBody>
          <Flex gap={3} mb={2}>
            <Icon
              as={VscClose}
              color="gray.600"
              fontSize="xl"
              onClick={() => handleDeleteCard(card.uid)}
            />
            <Icon
              as={VscArrowCircleUp}
              color="gray.600"
              fontSize="xl"
              onClick={() => moveCardUp(index)}
            />
            <Icon
              as={VscArrowCircleDown}
              color="gray.600"
              fontSize="xl"
              onClick={() => moveCardDown(index)}
            />
          </Flex>

          <Flex
            direction={{
              base: "row",
              md: "column",
            }}
            gap={4}
          >
            <FormControl>
              <FormLabel>カード名</FormLabel>
              <Input
                onBlur={() => {
                  updateCardName(tmpName);
                }}
                onChange={(e) => setTmpName(e.target.value)}
                placeholder="カード名"
                type="text"
                value={tmpName}
              />
            </FormControl>
            <FormControl>
              <FormLabel>枚数</FormLabel>
              <MultiSelect
                chakraStyles={multiSelectStyles}
                menuPortalTarget={document.body}
                onChange={(selectedValues) => {
                  updateCardCount(
                    Number(
                      (selectedValues as { label: string; value: string }).value
                    )
                  );
                }}
                options={Array.from({ length: 21 }, (_, i) => i).map((i) => ({
                  label: i.toString(),
                  value: i.toString(),
                }))}
                value={[
                  {
                    label: card.count.toString(),
                    value: card.count.toString(),
                  },
                ]}
              />
            </FormControl>
          </Flex>

          <Box mt={4}>
            <Collapse animateOpacity in={isExpanded}>
              <FormControl>
                <Textarea
                  onBlur={() => updateCardMemo(tmpMemo)}
                  onChange={(e) => setTmpMemo(e.target.value)}
                  placeholder="カードに関するメモ"
                  value={tmpMemo}
                />
              </FormControl>
            </Collapse>
            {!isExpanded && tmpMemo && (
              <Text color="gray.600" fontSize="md" ml={1} whiteSpace="pre-wrap">
                {tmpMemo}
              </Text>
            )}
          </Box>
        </CardBody>
      </Card>
    );
  }); 