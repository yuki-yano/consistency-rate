import type { MultiValue } from "chakra-react-select"
import type { FC, FocusEvent } from "react"

import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Card,
  CardBody,
  ChakraProvider,
  Container,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Input,
  Link,
  ListItem,
  Show,
  Text,
  Textarea,
  UnorderedList,
  useClipboard,
} from "@chakra-ui/react"
import { Select as MultiSelect } from "chakra-react-select"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useAtomCallback } from "jotai/utils"
import { DevTools } from "jotai-devtools"
import "jotai-devtools/styles.css"
import { focusAtom } from "jotai-optics"
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { LuCalculator, LuCheckCircle2, LuCircle, LuCopy, LuCopyCheck } from "react-icons/lu"
import { VscArrowCircleDown, VscArrowCircleUp, VscClose, VscCopy } from "react-icons/vsc"
import { v4 as uuidv4 } from "uuid"

import type { CardData, Condition, Label, Pattern, PatternMode } from "./state"
import type { CalculationResultState, CardsState, DeckState, LabelState, PatternState, PotState } from "./state"

import { calculateProbability } from "./calc"
import { fetchShortUrl } from "./fetch"
import { calculationResultAtom, cardsAtom, deckAtom, labelAtom, locAtom, patternAtom, potAtom } from "./state"
import { multiSelectStyles, theme } from "./theme"

const useCard = (uid: string) => {
  const cardItemAtom = useMemo(
    () => focusAtom(cardsAtom, (optic) => optic.prop("cards").find((card) => card.uid === uid)),
    [uid],
  )
  return useAtom(cardItemAtom) as [CardData, (card: CardData) => void]
}

const usePattern = (index: number) => {
  const patternItemAtom = useMemo(() => focusAtom(patternAtom, (optic) => optic.prop("patterns").at(index)), [index])
  return useAtom(patternItemAtom) as [Pattern, (pattern: Pattern) => void]
}

type StateMap = {
  calculationResult?: CalculationResultState | null
  cards?: CardsState
  deck?: DeckState
  label?: LabelState
  pattern?: PatternState
  pot?: PotState
}

declare global {
  interface Window {
    getStateObject: () => StateMap
    injectFromState: (states: StateMap) => void
  }
}

const Root = () => {
  const [deck, setDeck] = useAtom(deckAtom)
  const [cards, setCards] = useAtom(cardsAtom)
  const [pattern, setPattern] = useAtom(patternAtom)
  const [pot, setPot] = useAtom(potAtom)
  const [label, setLabel] = useAtom(labelAtom)
  const [calculationResult, setCalculationResult] = useAtom(calculationResultAtom)

  useEffect(() => {
    window.injectFromState = (states: StateMap) => {
      if (states.deck) setDeck(states.deck)
      if (states.cards) setCards(states.cards)
      if (states.pattern) setPattern(states.pattern)
      if (states.pot) setPot(states.pot)
      if (states.label) setLabel(states.label)
      if (states.calculationResult) setCalculationResult(states.calculationResult)
    }

    window.getStateObject = () => {
      return {
        calculationResult,
        cards,
        deck,
        label,
        pattern,
        pot,
      }
    }
  }, [
    calculationResult,
    cards,
    deck,
    label,
    pattern,
    pot,
    setCalculationResult,
    setCards,
    setDeck,
    setLabel,
    setPattern,
    setPot,
  ])

  return (
    <ChakraProvider theme={theme}>
      {import.meta.env.DEV && <DevTools />}
      <App />
    </ChakraProvider>
  )
}

const App: FC = () => {
  const successRatesRef = useRef<HTMLDivElement>(null)

  const scrollToSuccessRates = () => {
    if (successRatesRef.current) {
      successRatesRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }

  return (
    <>
      <Container maxW="container.xl" mb={4}>
        <Heading as="h1" py={4} size="lg">
          <Link href="/">初動率計算機</Link>
        </Heading>

        <Show above="md">
          <Box my={2}>
            <CalculateButton />
          </Box>
        </Show>

        <ShortUrlGenerator />

        <Grid gap={4} templateColumns="repeat(auto-fill, minmax(300px, 1fr))">
          <Deck />
          <Pot />
          <SuccessRates ref={successRatesRef} />
        </Grid>

        <Divider my={4} />

        <CardList />

        <Divider my={4} />

        <LabelManagement />

        <Divider my={4} />

        <PatternList />
      </Container>

      <Show below="md">
        <SpCalcButton onClick={scrollToSuccessRates} />
      </Show>
    </>
  )
}

const ShortUrlGenerator: FC = () => {
  const { hasCopied, onCopy, setValue: setShortUrl, value: shortUrl } = useClipboard("")
  const [loadingShortUrl, setLoadingShortUrl] = useState(false)

  return (
    <Flex gap={2} mb={2}>
      <Button
        disabled={loadingShortUrl}
        onClick={async () => {
          setLoadingShortUrl(true)
          const shortUrl = await fetchShortUrl(location.href)
          setShortUrl(shortUrl)
          setLoadingShortUrl(false)
        }}
      >
        短縮URLを生成
      </Button>

      <Input
        maxW="150px"
        onChange={(e) => {
          setShortUrl(e.target.value)
        }}
        placeholder="短縮URL"
        readOnly
        value={shortUrl}
      />

      <Button disabled={loadingShortUrl || shortUrl === ""} onClick={onCopy}>
        <Icon as={hasCopied ? LuCopyCheck : LuCopy} h={4} w={4} />
      </Button>
    </Flex>
  )
}

const CalculateButton: FC = () => {
  const deck = useAtomValue(deckAtom)
  const card = useAtomValue(cardsAtom)
  const pattern = useAtomValue(patternAtom)
  const pot = useAtomValue(potAtom)
  const label = useAtomValue(labelAtom)
  const setCalculationResult = useSetAtom(calculationResultAtom)

  useEffect(() => {
    if (pattern.patterns.length === 0) {
      return
    }
    const result = calculateProbability(deck, card, pattern, pot, label)
    setCalculationResult(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCalculate = () => {
    if (pattern.patterns.length === 0) {
      return
    }
    const result = calculateProbability(deck, card, pattern, pot, label)
    setCalculationResult(result)
  }

  const isInvalid = pattern.patterns.some((p) => p.conditions.some((c) => c.invalid))

  return (
    <HStack>
      <Button disabled={isInvalid} onClick={handleCalculate}>
        計算
      </Button>
      <Text as="b" color="red.400" fontSize="sm">
        {isInvalid ? "条件が不正です" : ""}
      </Text>
    </HStack>
  )
}

const SpCalcButton: FC<{
  onClick: () => void
}> = ({ onClick }) => {
  const deck = useAtomValue(deckAtom)
  const card = useAtomValue(cardsAtom)
  const pattern = useAtomValue(patternAtom)
  const pot = useAtomValue(potAtom)
  const label = useAtomValue(labelAtom)
  const setCalculationResult = useSetAtom(calculationResultAtom)

  const isInvalid = pattern.patterns.some((p) => p.conditions.some((c) => c.invalid))

  const handleCalculate = () => {
    if (isInvalid) {
      return
    }
    const result = calculateProbability(deck, card, pattern, pot, label)
    setCalculationResult(result)
    onClick()
  }

  useEffect(() => {
    if (isInvalid || pattern.patterns.length === 0) {
      return
    }

    const result = calculateProbability(deck, card, pattern, pot, label)
    setCalculationResult(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Icon
      as={LuCalculator}
      bgColor="gray.300"
      bottom={6}
      boxShadow="md"
      color={isInvalid ? "gray.400" : "gray.600"}
      cursor="pointer"
      h={14}
      onClick={handleCalculate}
      p={2}
      position="fixed"
      right={6}
      rounded="full"
      shadow="none"
      w={14}
    />
  )
}

const Deck: FC = () => {
  const [deck, setDeck] = useAtom(deckAtom)

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
                setDeck({ ...deck, cardCount: Number((selectedValue as { label: string; value: string }).value) })
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
                setDeck({ ...deck, firstHand: Number((selectedValue as { label: string; value: string }).value) })
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
  )
}

const DeckName: FC = () => {
  const [loc, setLoc] = useAtom(locAtom)

  return (
    <Box my={2}>
      <FormControl>
        <FormLabel>デッキ名</FormLabel>
        <Input
          onChange={(e) => {
            setLoc((prev) => ({
              ...prev,
              searchParams: new URLSearchParams([["deckName", encodeURIComponent(e.target.value)]]),
            }))
          }}
          value={decodeURIComponent(loc.searchParams?.get("deckName") ?? "")}
        />
      </FormControl>
    </Box>
  )
}

const Pot: FC = () => {
  const [potState, setPotState] = useAtom(potAtom)
  const prosperity = potState.prosperity
  const desiresOrExtravagance = potState.desiresOrExtravagance

  return (
    <Card>
      <CardBody>
        <Heading as="h2" fontSize="lg" py={2}>
          各種壺
        </Heading>

        <Box gap={2}>
          <Flex direction="column" gap={2}>
            <Card shadow="xs">
              <CardBody>
                <Heading as="h3" fontSize="md" pb={2}>
                  金満で謙虚な壺
                </Heading>

                <Flex gap={2}>
                  <FormControl>
                    <FormLabel>枚数</FormLabel>
                    <MultiSelect
                      chakraStyles={multiSelectStyles}
                      isClearable={false}
                      menuPortalTarget={document.body}
                      onChange={(selectedValue) => {
                        setPotState({
                          ...potState,
                          prosperity: {
                            ...prosperity,
                            count: Number((selectedValue as { label: string; value: string }).value),
                          },
                        })
                      }}
                      options={[
                        { label: "0", value: "0" },
                        { label: "1", value: "1" },
                        { label: "2", value: "2" },
                        { label: "3", value: "3" },
                      ]}
                      value={[
                        {
                          label: prosperity.count.toString(),
                          value: prosperity.count.toString(),
                        },
                      ]}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>コスト</FormLabel>
                    <MultiSelect
                      chakraStyles={multiSelectStyles}
                      isClearable={false}
                      menuPortalTarget={document.body}
                      onChange={(selectedValue) => {
                        setPotState({
                          ...potState,
                          prosperity: {
                            ...prosperity,
                            cost: Number((selectedValue as { label: string; value: string }).value) as 3 | 6,
                          },
                        })
                      }}
                      options={[
                        { label: "3", value: "3" },
                        { label: "6", value: "6" },
                      ]}
                      value={[
                        {
                          label: prosperity.cost.toString(),
                          value: prosperity.cost.toString(),
                        },
                      ]}
                    />
                  </FormControl>
                </Flex>
              </CardBody>
            </Card>

            <Card shadow="xs">
              <CardBody>
                <Heading as="h3" fontSize="md" pb={2}>
                  強欲で貪欲な壺, 強欲で金満な壺
                </Heading>

                <Flex gap={2}>
                  <FormControl>
                    <FormLabel>枚数</FormLabel>
                    <MultiSelect
                      chakraStyles={multiSelectStyles}
                      isClearable={false}
                      menuPortalTarget={document.body}
                      onChange={(selectedValue) => {
                        setPotState({
                          ...potState,
                          desiresOrExtravagance: {
                            ...desiresOrExtravagance,
                            count: Number((selectedValue as { label: string; value: string }).value),
                          },
                        })
                      }}
                      options={[
                        { label: "0", value: "0" },
                        { label: "1", value: "1" },
                        { label: "2", value: "2" },
                        { label: "3", value: "3" },
                        { label: "4", value: "4" },
                        { label: "5", value: "5" },
                        { label: "6", value: "6" },
                      ]}
                      value={[
                        {
                          label: desiresOrExtravagance.count.toString(),
                          value: desiresOrExtravagance.count.toString(),
                        },
                      ]}
                    />
                  </FormControl>
                </Flex>
              </CardBody>
            </Card>
          </Flex>
        </Box>
      </CardBody>
    </Card>
  )
}

const SuccessRates = forwardRef<HTMLDivElement>((_, ref) => {
  const calculationResult = useAtomValue(calculationResultAtom)
  const labels = useAtomValue(labelAtom)
  const pattern = useAtomValue(patternAtom)

  return (
    <>
      <Card ref={ref}>
        <CardBody>
          <Heading as="h2" fontSize="lg" py={2}>
            初動・パターン成立率
          </Heading>

          {calculationResult != null && (
            <UnorderedList>
              <ListItem ml={2}>
                <Text fontSize="md">全体初動率: {calculationResult.overallProbability}%</Text>
              </ListItem>
              {Object.entries(calculationResult.patternSuccessRates).map(([patternId, rate]) => (
                <ListItem key={patternId} ml={2}>
                  <Text fontSize="md">
                    {pattern.patterns.find((p) => p.uid === patternId)?.name}: {rate}%
                  </Text>
                </ListItem>
              ))}
            </UnorderedList>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Heading as="h2" fontSize="lg" py={2}>
            ラベル別成立率
          </Heading>

          {calculationResult != null && (
            <UnorderedList>
              {Object.entries(calculationResult.labelSuccessRates).map(([label, rate]) => {
                const l = labels.labels.find((l) => l.uid === label)

                return (
                  <ListItem key={label} ml={2}>
                    <Text fontSize="md">
                      {l?.name}: {rate}%
                    </Text>
                  </ListItem>
                )
              })}
            </UnorderedList>
          )}
        </CardBody>
      </Card>
    </>
  )
})

const CardList: FC = () => {
  const cards = useAtomValue(cardsAtom).cards

  const addCard = useAtomCallback(
    useCallback((get, set) => {
      const cards = get(cardsAtom).cards
      const newCards = cards.concat({
        count: 1,
        name: `カード${cards.length + 1}`,
        uid: uuidv4(),
      })
      set(cardsAtom, {
        cards: newCards,
        length: newCards.length,
      })
    }, []),
  )

  return (
    <Box>
      <Button mb={4} onClick={() => addCard()}>
        カードを追加
      </Button>

      <Grid gap={4} templateColumns="repeat(auto-fill, minmax(300px, 1fr))">
        {cards.map((card, index) => (
          <CardItem index={index} key={card.uid} uid={card.uid} />
        ))}
      </Grid>
    </Box>
  )
}

const CardItem: FC<{ index: number; uid: string }> = memo(({ index, uid }) => {
  const [card, setCard] = useCard(uid)
  const [tmpName, setTmpName] = useState(card.name)

  const updateCardName = useCallback(
    (name: string) => {
      setCard({ ...card, name })
    },
    [card, setCard],
  )

  const updateCardCount = useCallback(
    (count: number) => {
      setCard({ ...card, count })
    },
    [card, setCard],
  )

  const handleDeleteCard = useAtomCallback(
    useCallback((get, set, uid: string) => {
      const cards = get(cardsAtom).cards
      const newCards = cards.filter((c) => c.uid !== uid)
      set(cardsAtom, {
        cards: newCards,
        length: newCards.length,
      })

      const patterns = get(patternAtom).patterns
      const updatedPatterns = patterns.map((pattern) => {
        const updatedConditions = pattern.conditions.map((condition) => ({
          ...condition,
          uids: condition.uids.filter((id) => id !== uid),
        }))
        return { ...pattern, conditions: updatedConditions }
      })
      set(patternAtom, {
        length: updatedPatterns.length,
        patterns: updatedPatterns,
      })
    }, []),
  )

  const moveCardUp = useAtomCallback(
    useCallback((get, set, index: number) => {
      const cards = get(cardsAtom).cards
      if (index > 0) {
        const newCards = [...cards]
        const [movedCard] = newCards.splice(index, 1)
        newCards.splice(index - 1, 0, movedCard)
        set(cardsAtom, {
          cards: newCards,
          length: newCards.length,
        })
      }
    }, []),
  )

  const moveCardDown = useAtomCallback(
    useCallback((get, set, index: number) => {
      const cards = get(cardsAtom).cards
      if (index < cards.length - 1) {
        const newCards = [...cards]
        const [movedCard] = newCards.splice(index, 1)
        newCards.splice(index + 1, 0, movedCard)
        set(cardsAtom, {
          cards: newCards,
          length: newCards.length,
        })
      }
    }, []),
  )

  return (
    <Card py={2}>
      <CardBody>
        <Flex gap={3} mb={2}>
          <Icon as={VscClose} color="gray.600" fontSize="xl" onClick={() => handleDeleteCard(card.uid)} />
          <Icon as={VscArrowCircleUp} color="gray.600" fontSize="xl" onClick={() => moveCardUp(index)} />
          <Icon as={VscArrowCircleDown} color="gray.600" fontSize="xl" onClick={() => moveCardDown(index)} />
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
                updateCardName(tmpName)
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
                updateCardCount(Number((selectedValues as { label: string; value: string }).value))
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
      </CardBody>
    </Card>
  )
})

const ConditionInput: FC<{
  conditionIndex: number
  patternIndex: number
}> = ({ conditionIndex, patternIndex }) => {
  const condition = useAtomValue(patternAtom).patterns[patternIndex].conditions[conditionIndex]
  const [patternState, setPattern] = useAtom(patternAtom)
  const patterns = patternState.patterns

  const onChange = (updatedCondition: Condition) => {
    const newConditions = patterns[patternIndex].conditions.map((c, i) => {
      if (i === conditionIndex) {
        return updatedCondition
      }
      return c
    })
    const newPatterns = patterns.map((p, i) => {
      if (i === patternIndex) {
        return { ...p, conditions: newConditions }
      }
      return p
    })
    setPattern({
      length: newPatterns.length,
      patterns: newPatterns,
    })
  }

  const onDelete = () => {
    const newConditions = patterns[patternIndex].conditions.filter((_, i) => i !== conditionIndex)
    const newPatterns = patterns.map((p, i) => {
      if (i === patternIndex) {
        return { ...p, conditions: newConditions }
      }
      return p
    })
    setPattern({
      length: newPatterns.length,
      patterns: newPatterns,
    })
  }

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
              onChange({ ...condition, count: Number((selectedValue as { label: string; value: string }).value) })
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
                mode: (selectedValue as { label: string; value: string })?.value as PatternMode,
              })
            }}
            options={[
              { label: "以上ドロー", value: "required" },
              { label: "以上デッキに残す", value: "leave_deck" },
              { label: "ドローなし", value: "not_drawn" },
            ]}
            value={[
              {
                label:
                  condition.mode === "required"
                    ? "以上ドロー"
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
  )
}

const SelectCard: FC<{
  condition: Condition
  onChange: (updatedCondition: Condition) => void
}> = ({ condition, onChange }) => {
  const cards = useAtomValue(cardsAtom).cards
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    condition.uids.length === 0 ? "カードを選択してください" : undefined,
  )

  const handleSelectionChange = (selectedValues: MultiValue<unknown>) => {
    const uids = (selectedValues as Array<{ label: string; value: string }>).map((value) => value.value)
    let newCondition = { ...condition, uids }

    if (uids.length === 0) {
      setErrorMessage("カードを選択してください")
      newCondition = { ...newCondition, invalid: true }
    } else {
      setErrorMessage(undefined)
      newCondition = { ...newCondition, invalid: false }
    }

    onChange({ ...newCondition })
  }

  return (
    <FormControl isInvalid={condition.invalid}>
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
          label: cards.find((card) => card.uid === uid)?.name,
          value: uid,
        }))}
      />
      {errorMessage != null && <FormErrorMessage>{errorMessage}</FormErrorMessage>}
    </FormControl>
  )
}

const PatternItem: FC<{ index: number }> = ({ index }) => {
  const [pattern] = usePattern(index)
  const [active, setActive] = useState(pattern?.active)

  const [expanded, setExpanded] = useState(false)

  const addCondition = useAtomCallback(
    useCallback(
      (get, set) => {
        const newCondition = {
          count: 1,
          invalid: true,
          mode: "required",
          uids: [],
        }
        const patterns = get(patternAtom)
        const newPatterns = patterns.patterns.map((p, i) => {
          if (i === index) {
            return { ...p, conditions: [...p.conditions, newCondition] }
          }
          return p
        }) as Array<Pattern>
        console.log(newPatterns)
        set(patternAtom, {
          length: newPatterns.length,
          patterns: newPatterns,
        })
      },
      [index],
    ),
  )

  const deletePattern = useAtomCallback(
    useCallback(
      (get, set) => {
        const patterns = get(patternAtom).patterns
        set(patternAtom, {
          length: patterns.length - 1,
          patterns: patterns.filter((_, i) => i !== index),
        })
      },
      [index],
    ),
  )

  const duplicatePattern = useAtomCallback(
    useCallback(
      (get, set) => {
        const patterns = get(patternAtom).patterns
        const newPattern = {
          ...pattern!,
          active: true,
          expanded: true,
          name: `${pattern!.name} - コピー`,
          uid: uuidv4(),
        }
        set(patternAtom, {
          length: patterns.length + 1,
          patterns: [...patterns, newPattern],
        })
      },
      [pattern],
    ),
  )

  const handleToggleActive = useAtomCallback(
    useCallback(
      (get, set, index: number) => {
        const patterns = get(patternAtom).patterns
        const newPatterns = patterns.map((p, i) => {
          if (i === index) {
            return { ...p, active: active != null ? !active : true }
          }
          return p
        })
        set(patternAtom, {
          length: newPatterns.length,
          patterns: newPatterns,
        })
        setActive((prev) => (prev != null ? !prev : true))
      },
      [active],
    ),
  )

  const movePatternUp = useAtomCallback(
    useCallback((get, set, index: number) => {
      const patterns = get(patternAtom).patterns
      if (index > 0) {
        const newPatterns = [...patterns]
        const [movedPattern] = newPatterns.splice(index, 1)
        newPatterns.splice(index - 1, 0, movedPattern)
        set(patternAtom, {
          length: newPatterns.length,
          patterns: newPatterns,
        })
      }
    }, []),
  )

  const movePatternDown = useAtomCallback(
    useCallback((get, set, index: number) => {
      const patterns = get(patternAtom).patterns
      if (index < patterns.length - 1) {
        const newPatterns = [...patterns]
        const [movedPattern] = newPatterns.splice(index, 1)
        newPatterns.splice(index + 1, 0, movedPattern)
        set(patternAtom, {
          length: newPatterns.length,
          patterns: newPatterns,
        })
      }
    }, []),
  )

  const isInvalid = pattern?.conditions.some((condition) => condition.invalid)

  return (
    <Card my={4}>
      <CardBody>
        <Flex gap={3} mb={2}>
          <Icon as={VscClose} color="gray.600" fontSize="xl" onClick={() => deletePattern()} />
          <Icon as={VscCopy} color="gray.600" fontSize="xl" onClick={duplicatePattern} />
          <Icon
            as={VscArrowCircleUp}
            color="gray.600"
            fontSize="xl"
            onClick={() => {
              movePatternUp(index)
            }}
          />
          <Icon
            as={VscArrowCircleDown}
            color="gray.600"
            fontSize="xl"
            onClick={() => {
              movePatternDown(index)
            }}
          />
        </Flex>

        <Flex align="center" gap={1}>
          <Icon
            as={active ? LuCheckCircle2 : LuCircle}
            fontSize="xl"
            onClick={() => {
              handleToggleActive(index)
            }}
          />

          <Accordion allowToggle index={expanded ? 0 : -1} onChange={() => setExpanded(!expanded)} w="full">
            <AccordionItem border="none">
              <h2>
                <AccordionButton
                  _hover={{
                    bg: "white",
                  }}
                >
                  <Flex alignItems="flex-end" as="span" flex="1" gap={2} textAlign="left">
                    <Text
                      as="b"
                      color={active ? "gray.800" : "gray.500"}
                      fontSize="lg"
                      textDecoration={isInvalid ? "line-through" : "none"}
                    >
                      {pattern.name}
                    </Text>
                    {isInvalid && (
                      <Text as="b" color="red.400">
                        条件が不正です
                      </Text>
                    )}
                  </Flex>
                  <AccordionIcon />
                </AccordionButton>
              </h2>

              <Box ml={4}>
                <PatternItemLabels patternIndex={index} />
                <Text color="gray.600" fontSize="md">
                  優先度: {pattern.priority}
                </Text>
              </Box>

              <AccordionPanel>
                {expanded && (
                  <>
                    <Grid gap={4} templateColumns="repeat(auto-fill, minmax(250px, 1fr))">
                      <GridItem rowSpan={3}>
                        <PatternInput patternIndex={index} />
                      </GridItem>
                      {pattern.conditions.map((_, conditionIndex) => (
                        <GridItem colSpan={1} key={conditionIndex}>
                          <ConditionInput conditionIndex={conditionIndex} patternIndex={index} />
                        </GridItem>
                      ))}
                    </Grid>

                    <Button mt={4} onClick={addCondition}>
                      条件を追加
                    </Button>
                  </>
                )}
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </Flex>
      </CardBody>
    </Card>
  )
}

const PatternItemLabels: FC<{ patternIndex: number }> = ({ patternIndex }) => {
  const pattern = useAtomValue(patternAtom).patterns[patternIndex]
  const labels = useAtomValue(labelAtom).labels

  return (
    <Text color="gray.600" fontSize="md">
      ラベル:&nbsp;
      {pattern.labels
        .map((label) => labels.find((l) => l.uid === label.uid)?.name)
        .filter(Boolean)
        .join(", ")}
    </Text>
  )
}

const PatternNameInput: FC<{ patternIndex: number }> = ({ patternIndex }) => {
  const [pattern] = usePattern(patternIndex)
  const [tmpName, setTmpName] = useState(pattern.name)

  const updateName = useAtomCallback(
    useCallback(
      (get, set, name: string) => {
        const patterns = get(patternAtom)
        const newPatterns = patterns.patterns.map((p, i) => {
          if (i === patternIndex) {
            return { ...p, name }
          }
          return p
        })

        set(patternAtom, {
          length: newPatterns.length,
          patterns: newPatterns,
        })
      },
      [patternIndex],
    ),
  )

  const handleBlur = () => {
    updateName(tmpName)
  }

  return (
    <Box my={2}>
      <FormControl>
        <FormLabel>パターン名</FormLabel>
        <Input onBlur={handleBlur} onChange={(e) => setTmpName(e.target.value)} value={tmpName} />
      </FormControl>
    </Box>
  )
}

const PatternLabelInput: FC<{ patternIndex: number }> = ({ patternIndex }) => {
  const [patternState] = useAtom(patternAtom)
  const labels = useAtomValue(labelAtom).labels
  const currentLabels = patternState.patterns[patternIndex].labels

  const updateLabels = useAtomCallback((_, set) => (selectedValues: Array<{ label: string; value: string }>) => {
    const newLabels = selectedValues.map((value) => ({
      uid: value.value,
    }))
    const newPatterns = patternState.patterns.map((p, i) => {
      if (i === patternIndex) {
        return { ...p, labels: newLabels }
      }
      return p
    })
    set(patternAtom, {
      length: newPatterns.length,
      patterns: newPatterns,
    })
  })

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
            updateLabels()(selectedValues as Array<{ label: string; value: string }>)
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
  )
}

const PatternPriorityInput: FC<{
  patternIndex: number
}> = ({ patternIndex }) => {
  const [pattern] = usePattern(patternIndex)
  const priority = pattern.priority
  const updatePriority = useAtomCallback(
    useCallback(
      (get, set, priority: number) => {
        const patterns = get(patternAtom)
        const newPatterns = patterns.patterns.map((p, i) => {
          if (i === patternIndex) {
            return { ...p, priority }
          }
          return p
        })

        set(patternAtom, {
          length: newPatterns.length,
          patterns: newPatterns,
        })
      },
      [patternIndex],
    ),
  )

  return (
    <Box my={2}>
      <FormControl>
        <FormLabel>優先度</FormLabel>
        <MultiSelect
          chakraStyles={multiSelectStyles}
          menuPortalTarget={document.body}
          onChange={(selectedValue) => {
            updatePriority(Number((selectedValue as { label: string; value: string }).value))
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
  )
}

const PatternMemoInput: FC<{ patternIndex: number }> = ({ patternIndex }) => {
  const [patternState, setPattern] = useAtom(patternAtom)
  const pattern = patternState.patterns[patternIndex]
  const [tmpMemo, setTmpMemo] = useState(pattern.memo)

  const handleBlur = (e: FocusEvent<HTMLTextAreaElement>) => {
    const newPatterns = patternState.patterns.map((p, i) => {
      if (i === patternIndex) {
        return { ...p, memo: e.target.value }
      }
      return p
    })
    setPattern({
      length: newPatterns.length,
      patterns: newPatterns,
    })
  }

  return (
    <Box my={2}>
      <FormControl>
        <FormLabel>メモ</FormLabel>
        <Textarea onBlur={handleBlur} onChange={(e) => setTmpMemo(e.target.value)} value={tmpMemo} />
      </FormControl>
    </Box>
  )
}

const PatternInput: FC<{ patternIndex: number }> = ({ patternIndex }) => {
  return (
    <Box py={2}>
      <PatternNameInput patternIndex={patternIndex} />
      <PatternLabelInput patternIndex={patternIndex} />
      <PatternPriorityInput patternIndex={patternIndex} />
      <PatternMemoInput patternIndex={patternIndex} />
    </Box>
  )
}

const PatternList: FC = () => {
  const patternLengthAtom = useMemo(() => focusAtom(patternAtom, (optic) => optic.prop("length")), [])
  const patternLength = useAtomValue(patternLengthAtom)

  const initialPatternLength = useAtomCallback(
    useCallback((get, set) => {
      const patterns = get(patternAtom).patterns
      const length = patterns.length

      set(patternAtom, {
        length,
        patterns,
      })
    }, []),
  )

  useEffect(() => {
    initialPatternLength()
  }, [initialPatternLength])

  return (
    <Box>
      <AddPatternButton />
      {Array.from({ length: patternLength }).map((_, index) => (
        <Box key={index} my={4}>
          <PatternItem index={index} />
        </Box>
      ))}
    </Box>
  )
}

const AddPatternButton: FC = () => {
  const [patternState, setPatternState] = useAtom(patternAtom)
  const patterns = patternState.patterns

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
    }
    setPatternState({
      length: patterns.length + 1,
      patterns: patterns.concat(newPattern),
    })
  }

  return (
    <Button
      onClick={() => {
        addPattern()
      }}
    >
      パターンを追加
    </Button>
  )
}

const LabelManagement: FC = () => {
  const [labelsState, setLabelsState] = useAtom(labelAtom)
  const labels = labelsState.labels

  const addLabel = () => {
    const labelToAdd = { name: `ラベル${labels.length + 1}`, uid: uuidv4() }
    setLabelsState({ labels: [...labels, labelToAdd] })
  }

  return (
    <Box mb={4}>
      <Button mb={4} onClick={addLabel}>
        ラベルを追加
      </Button>
      <Grid gap={4} templateColumns="repeat(auto-fill, minmax(300px, 1fr))">
        {labels.map((_, index) => (
          <Label key={index} labelIndex={index} labels={labels} setLabelsState={setLabelsState} />
        ))}
      </Grid>
    </Box>
  )
}

const Label: FC<{
  labelIndex: number
  labels: Array<Label>
  setLabelsState: ({ labels }: { labels: Array<Label> }) => void
}> = ({ labelIndex, labels, setLabelsState }) => {
  const label = labels[labelIndex]
  const [patternsState, setPatternsState] = useAtom(patternAtom)
  const patterns = patternsState.patterns

  const [tmpName, setTempName] = useState(label.name)

  useEffect(() => {
    setTempName(label.name)
  }, [label])

  const deleteLabel = (uid: string) => {
    const newLabels = labels.filter((label) => label.uid !== uid)
    setLabelsState({ labels: newLabels })

    const updatedPatterns = patterns.map((pattern) => ({
      ...pattern,
      labels: pattern.labels.filter((label) => label.uid !== uid),
    }))
    setPatternsState({
      length: updatedPatterns.length,
      patterns: updatedPatterns,
    })
  }

  const editLabel = (uid: string, newName: string) => {
    const newLabels = labels.map((label) => {
      if (label.uid === uid) {
        return { ...label, name: newName }
      }
      return label
    })
    setLabelsState({ labels: newLabels })
  }

  return (
    <Card>
      <CardBody>
        <Flex align="center" gap={2} justify="space-between">
          <Icon as={VscClose} fontSize="xl" onClick={() => deleteLabel(label.uid)} />
          <Input
            onBlur={(e) => editLabel(label.uid, e.target.value)}
            onChange={(e) => setTempName(e.target.value)}
            value={tmpName}
          />
        </Flex>
      </CardBody>
    </Card>
  )
}

const domNode = document.getElementById("root")

if (domNode != null) {
  const root = createRoot(domNode)
  root.render(<Root />)
}
