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
  FormLabel,
  Grid,
  Heading,
  Icon,
  Input,
  Link,
  ListItem,
  Show,
  Text,
  UnorderedList,
  useClipboard,
} from "@chakra-ui/react"
import { Select as MultiSelect } from "chakra-react-select"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { DevTools } from "jotai-devtools"
import "jotai-devtools/styles.css"
import { type FC, forwardRef, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { LuCalculator, LuCheckCircle2, LuCircle } from "react-icons/lu"
import { VscArrowCircleDown, VscArrowCircleUp, VscClose, VscCopy } from "react-icons/vsc"
import { v4 as uuidv4 } from "uuid"

import { calculateProbability } from "./calc"
import { fetchShortUrl } from "./fetch"
import {
  calculationResultAtom,
  type CardData,
  cardsAtom,
  type Condition,
  deckAtom,
  labelAtom,
  locAtom,
  type Pattern,
  patternAtom,
  type PatternMode,
  potAtom,
} from "./state"
import { multiSelectStyles, theme } from "./theme"

const Root = () => {
  return (
    <ChakraProvider theme={theme}>
      {import.meta.env.DEV && <DevTools />}
      <App />
    </ChakraProvider>
  )
}

const App: FC = () => {
  const [trials, setTrials] = useState<number>(100000)
  const { hasCopied, onCopy, setValue: setShortUrl, value: shortUrl } = useClipboard("")
  const [loadingShortUrl, setLoadingShortUrl] = useState(false)
  const successRatesRef = useRef<HTMLDivElement>(null)

  const scrollToSuccessRates = () => {
    if (successRatesRef.current) {
      successRatesRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
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
            <Flex gap={4}>
              <CalculateButton trials={trials} />
            </Flex>
          </Box>
        </Show>

        <Flex gap={1} mb={4} mt={2}>
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
            {hasCopied ? "Copied!" : "Copy"}
          </Button>
        </Flex>

        <Grid gap={4} templateColumns="repeat(auto-fill, minmax(300px, 1fr))">
          <Deck setTrials={setTrials} trials={trials} />
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
        <SpCalcButton onClick={scrollToSuccessRates} trials={trials} />
      </Show>
    </>
  )
}

const SpCalcButton: FC<{
  onClick: () => void
  trials: number
}> = ({ onClick, trials }) => {
  const deck = useAtomValue(deckAtom)
  const card = useAtomValue(cardsAtom)
  const pattern = useAtomValue(patternAtom)
  const pot = useAtomValue(potAtom)
  const setCalculationResult = useSetAtom(calculationResultAtom)

  const handleCalculate = () => {
    const result = calculateProbability(deck, card, pattern, trials, pot)
    setCalculationResult(result)
    onClick()
  }

  return (
    <Icon
      as={LuCalculator}
      bgColor="gray.300"
      bottom={6}
      boxShadow="md"
      color="gray.500"
      cursor="pointer"
      h={14}
      onClick={handleCalculate}
      p={2}
      position="fixed"
      right={6}
      rounded="full"
      w={14}
    />
  )
}

const Deck: FC<{
  setTrials: (trials: number) => void
  trials: number
}> = ({ setTrials, trials }) => {
  const [deck, setDeck] = useAtom(deckAtom)
  const [loc, setLoc] = useAtom(locAtom)
  const [tmpTrials, setTmpTrials] = useState(trials)

  return (
    <Card>
      <CardBody>
        <Heading as="h2" fontSize="lg" py={2}>
          デッキ情報
        </Heading>

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

        <Box my={2}>
          <FormControl>
            <FormLabel>枚数</FormLabel>
            <Input
              onChange={(e) => setDeck({ ...deck, cardCount: Number(e.target.value) })}
              placeholder="40"
              type="text"
              value={deck.cardCount.toString()}
            />
          </FormControl>
        </Box>

        <Box my={2}>
          <FormControl>
            <FormLabel>初手枚数</FormLabel>
            <Input
              onChange={(e) => setDeck({ ...deck, firstHand: Number(e.target.value) })}
              placeholder="5"
              type="text"
              value={deck.firstHand.toString()}
            />
          </FormControl>
        </Box>

        <Box my={2}>
          <FormControl>
            <FormLabel>試行回数</FormLabel>
            <Input
              onBlur={() => setTrials(tmpTrials)}
              onChange={(e) => {
                const input = Number(e.target.value)

                if (input > 1000000) {
                  setTmpTrials(1000000)
                } else {
                  setTmpTrials(input)
                }
              }}
              type="text"
              value={tmpTrials.toString()}
            />
          </FormControl>
        </Box>
      </CardBody>
    </Card>
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

  if (calculationResult == null) {
    return <div ref={ref} />
  }

  return (
    <>
      <Card ref={ref}>
        <CardBody>
          <Heading as="h2" fontSize="lg" py={2}>
            初動・パターン成立率
          </Heading>

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
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Heading as="h2" fontSize="lg" py={2}>
            ラベル別成立率
          </Heading>

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
        </CardBody>
      </Card>
    </>
  )
})

const CardList: FC = () => {
  const [cardState, setCardState] = useAtom(cardsAtom)
  const cards = cardState.cards

  const handleClick = () => {
    const newCards = cards.concat({
      count: 1,
      name: `新規カード${cards.length + 1}`,
      uid: uuidv4(),
    })
    setCardState({ cards: newCards })
  }

  return (
    <Box>
      <Button mb={4} onClick={handleClick}>
        カードを追加
      </Button>

      <Grid gap={4} templateColumns="repeat(auto-fill, minmax(300px, 1fr))">
        {cards.map((card, index) => (
          <CardItem index={index} key={card.uid} />
        ))}
      </Grid>
    </Box>
  )
}

const CardItem: FC<{
  index: number
}> = ({ index }) => {
  const [cardState, setCardState] = useAtom(cardsAtom)
  const cards = cardState.cards
  const card = cards[index]
  const [patternState, setPatternState] = useAtom(patternAtom)
  const patterns = patternState.patterns

  const [tmpName, setTempName] = useState(card.name)

  const handleDeleteCard = (uid: string) => {
    const newCards = cards.filter((c) => c.uid !== uid)
    setCardState({ cards: newCards })

    const updatedPatterns = patterns.map((pattern) => {
      const updatedConditions = pattern.conditions.map((condition) => ({
        ...condition,
        uids: condition.uids.filter((id) => id !== uid),
      }))
      return { ...pattern, conditions: updatedConditions }
    })
    setPatternState({ patterns: updatedPatterns })
  }

  const moveCardUp = (index: number) => {
    if (index > 0) {
      const newCards = [...cards]
      const [movedCard] = newCards.splice(index, 1)
      newCards.splice(index - 1, 0, movedCard)
      setCardState({ cards: newCards })
    }
  }

  const moveCardDown = (index: number) => {
    if (index < cards.length - 1) {
      const newCards = [...cards]
      const [movedCard] = newCards.splice(index, 1)
      newCards.splice(index + 1, 0, movedCard)
      setCardState({ cards: newCards })
    }
  }

  const updateCard = (updatedCard: CardData) => {
    const newCards = cards.map((c) => {
      if (c.uid === updatedCard.uid) {
        return updatedCard
      }
      return c
    })
    setCardState({ cards: newCards })
  }

  return (
    <Card key={card.uid} py={2}>
      <CardBody>
        <Flex gap={3} mb={2}>
          <Icon as={VscClose} color="gray.600" fontSize="xl" onClick={() => handleDeleteCard(card.uid)} />
          <Icon as={VscArrowCircleUp} color="gray.600" fontSize="xl" onClick={() => moveCardUp(index)} />
          <Icon as={VscArrowCircleDown} color="gray.600" fontSize="xl" onClick={() => moveCardDown(index)} />
        </Flex>

        <Box py={2}>
          <FormControl>
            <FormLabel>カード名</FormLabel>
            <Input
              onBlur={() => {
                updateCard({ ...card, name: tmpName })
              }}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="カード名"
              type="text"
              value={tmpName}
            />
          </FormControl>
        </Box>
        <Box py={2}>
          <FormControl>
            <FormLabel>枚数</FormLabel>
            <Input
              onChange={(e) => {
                updateCard({ ...card, count: Number(e.target.value) })
              }}
              placeholder="枚数"
              type="number"
              value={card.count.toString()}
            />
          </FormControl>
        </Box>
      </CardBody>
    </Card>
  )
}

const ConditionInput: FC<{
  conditionIndex: number
  patternIndex: number
}> = ({ conditionIndex, patternIndex }) => {
  const cards = useAtomValue(cardsAtom).cards
  const condition = useAtomValue(patternAtom).patterns[patternIndex].conditions[conditionIndex]
  const [patternState, setPattern] = useAtom(patternAtom)
  const patterns = patternState.patterns
  const pattern = patternState.patterns[patternIndex]

  const onChange = (updatedCondition: Condition) => {
    const newConditions = pattern.conditions.map((c, i) => {
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
    setPattern({ patterns: newPatterns })
  }

  const onDelete = () => {
    const newConditions = pattern.conditions.filter((_, i) => i !== conditionIndex)
    const newPatterns = patterns.map((p, i) => {
      if (i === patternIndex) {
        return { ...p, conditions: newConditions }
      }
      return p
    })
    setPattern({ patterns: newPatterns })
  }

  return (
    <Card shadow="xs">
      <CardBody>
        <Icon as={VscClose} fontSize="xl" onClick={onDelete} />

        <FormControl my={2}>
          <FormLabel>カードを選択</FormLabel>
          <MultiSelect
            chakraStyles={multiSelectStyles}
            closeMenuOnSelect={false}
            isClearable={false}
            isMulti
            menuPortalTarget={document.body}
            onChange={(selectedValues) => {
              const uids = (selectedValues as Array<{ label: string; value: string }>).map((value) => value.value)
              onChange({ ...condition, uids })
            }}
            options={cards.map((card) => ({
              label: card.name,
              value: card.uid,
            }))}
            value={condition.uids.map((uid) => ({
              label: cards.find((card) => card.uid === uid)?.name,
              value: uid,
            }))}
          />
        </FormControl>

        <FormControl my={2}>
          <FormLabel>枚数</FormLabel>
          <Input
            disabled={condition.mode === "not_drawn"}
            onChange={(e) => onChange({ ...condition, count: Number(e.target.value) })}
            type="number"
            value={condition.count.toString()}
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

const PatternItem: FC<{ index: number }> = ({ index }) => {
  const labels = useAtomValue(labelAtom).labels
  const [patternState, setPattern] = useAtom(patternAtom)
  const patterns = patternState.patterns
  const pattern = patternState.patterns[index]
  const [active, setActive] = useState(pattern.active)

  const addCondition = () => {
    const newCondition = {
      count: 1,
      mode: "required",
      uids: [],
    }
    const newPatterns = patterns.map((p, i) => {
      if (i === index) {
        return { ...p, conditions: [...p.conditions, newCondition] }
      }
      return p
    }) as Array<Pattern>
    setPattern({ patterns: newPatterns })
  }

  const duplicatePattern = () => {
    const newPattern = {
      ...pattern,
      conditions: [...pattern.conditions],
      uid: uuidv4(),
    }
    setPattern({ patterns: [...patterns, newPattern] })
  }

  const handleToggleActive = () => {
    const newActiveState = !active
    setActive(newActiveState)
    const newPatterns = patterns.map((p, i) => {
      if (i === index) {
        return { ...p, active: newActiveState }
      }
      return p
    })
    setPattern({ patterns: newPatterns })
  }

  const movePatternUp = () => {
    if (index > 0) {
      const newPatterns = [...patterns]
      const [movedPattern] = newPatterns.splice(index, 1)
      newPatterns.splice(index - 1, 0, movedPattern)
      setPattern({ patterns: newPatterns })
    }
  }

  const movePatternDown = () => {
    if (index < patterns.length - 1) {
      const newPatterns = [...patterns]
      const [movedPattern] = newPatterns.splice(index, 1)
      newPatterns.splice(index + 1, 0, movedPattern)
      setPattern({ patterns: newPatterns })
    }
  }

  return (
    <Card my={4}>
      <CardBody>
        <Flex gap={3} mb={2}>
          <Icon
            as={VscClose}
            color="gray.600"
            fontSize="xl"
            onClick={() => setPattern({ patterns: patterns.filter((_, i) => i !== index) })}
          />
          <Icon as={VscCopy} color="gray.600" fontSize="xl" onClick={duplicatePattern} />
          <Icon as={VscArrowCircleUp} color="gray.600" fontSize="xl" onClick={movePatternUp} />
          <Icon as={VscArrowCircleDown} color="gray.600" fontSize="xl" onClick={movePatternDown} />
        </Flex>

        <Flex align="center" gap={1}>
          <Icon as={active ? LuCheckCircle2 : LuCircle} fontSize="xl" onClick={handleToggleActive} />

          <Accordion allowToggle w="full">
            <AccordionItem border="none">
              <h2>
                <AccordionButton
                  _hover={{
                    bg: "white",
                  }}
                >
                  <Box as="span" flex="1" textAlign="left">
                    <Text as="b" color={active ? "gray.800" : "gray.500"} fontSize="lg">
                      {pattern.name}
                    </Text>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>

              <Box ml={4}>
                <Text color="gray.600" fontSize="md">
                  ラベル:&nbsp;
                  {pattern.labels
                    .map((label) => labels.find((l) => l.uid === label.uid)?.name)
                    .filter(Boolean)
                    .join(", ")}
                </Text>
                <Text color="gray.600" fontSize="md">
                  優先度: {pattern.priority}
                </Text>
              </Box>

              <AccordionPanel>
                <Grid gap={4} templateColumns="repeat(auto-fill, minmax(300px, 1fr))">
                  <PatternInput patternIndex={index} />
                  {pattern.conditions.map((_, conditionIndex) => (
                    <Box key={conditionIndex}>
                      <ConditionInput conditionIndex={conditionIndex} patternIndex={index} />
                    </Box>
                  ))}
                </Grid>

                <Button mt={4} onClick={addCondition}>
                  条件を追加
                </Button>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </Flex>
      </CardBody>
    </Card>
  )
}

const PatternInput: FC<{
  patternIndex: number
}> = ({ patternIndex }) => {
  const [patternState, setPattern] = useAtom(patternAtom)
  const patterns = patternState.patterns
  const pattern = patternState.patterns[patternIndex]
  const labels = useAtomValue(labelAtom).labels

  const [tmpPatternName, setTempPatternName] = useState(pattern.name)

  return (
    <Box py={2}>
      <Box my={2}>
        <FormControl>
          <FormLabel>パターン名</FormLabel>
          <Input
            onBlur={(e) => {
              const newPatterns = patterns.map((p, i) => {
                if (i === patternIndex) {
                  return { ...p, name: e.target.value }
                }
                return p
              })
              setPattern({ patterns: newPatterns })
            }}
            onChange={(e) => setTempPatternName(e.target.value)}
            type="text"
            value={tmpPatternName}
          />
        </FormControl>
      </Box>

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
              const newLabels = (selectedValues as Array<{ label: string; value: string }>).map((value) => ({
                uid: value.value,
              }))
              const newPatterns = patterns.map((p, i) => {
                if (i === patternIndex) {
                  return { ...p, labels: newLabels }
                }
                return p
              })
              setPattern({ patterns: newPatterns })
            }}
            options={labels.map((label) => ({
              label: label.name,
              value: label.uid,
            }))}
            value={pattern.labels.map((label) => ({
              label: labels.find((l) => l.uid === label.uid)?.name,
              value: label.uid,
            }))}
          />
        </FormControl>
      </Box>

      <Box my={2}>
        <FormControl>
          <FormLabel>優先度</FormLabel>
          <Input
            onChange={(e) => {
              const newPatterns = patterns.map((p, i) => {
                if (i === patternIndex) {
                  return {
                    ...p,
                    priority: Number(e.target.value),
                  }
                }
                return p
              })
              setPattern({ patterns: newPatterns })
            }}
            type="number"
            value={pattern.priority.toString()}
          />
        </FormControl>
      </Box>
    </Box>
  )
}

const PatternList: FC = () => {
  const [patternState, setPatternState] = useAtom(patternAtom)
  const patterns = patternState.patterns

  useEffect(() => {
    setPatternState({
      patterns: patterns.map((p) => ({ ...p, expanded: false })),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addPattern = () => {
    const newPattern = {
      active: true,
      conditions: [],
      expanded: true,
      labels: [],
      name: `パターン${patterns.length + 1}`,
      priority: 1,
      uid: uuidv4(),
    }
    setPatternState({ patterns: [...patterns, newPattern] })
  }

  return (
    <Box>
      <Button onClick={addPattern}>パターンを追加</Button>
      {patterns.map((_, index) => (
        <Box key={index} my={4}>
          <PatternItem index={index} />
        </Box>
      ))}
    </Box>
  )
}

const LabelManagement: FC = () => {
  const [labelsState, setLabelsState] = useAtom(labelAtom)
  const labels = labelsState.labels

  const addLabel = () => {
    const labelToAdd = { name: `新規ラベル${labels.length + 1}`, uid: uuidv4() }
    setLabelsState({ labels: [...labels, labelToAdd] })
  }

  return (
    <Box mb={4}>
      <Button mb={4} onClick={addLabel}>
        ラベルを追加
      </Button>
      <Grid gap={4} templateColumns="repeat(auto-fill, minmax(300px, 1fr))">
        {labels.map((_, index) => (
          <Label key={index} labelIndex={index} />
        ))}
      </Grid>
    </Box>
  )
}

const Label: FC<{ labelIndex: number }> = ({ labelIndex }) => {
  const [labelsState, setLabelsState] = useAtom(labelAtom)
  const labels = labelsState.labels
  const label = labels[labelIndex]
  const [patternsState, setPatternsState] = useAtom(patternAtom)
  const patterns = patternsState.patterns

  const [tmpName, setTempName] = useState(label.name)

  const deleteLabel = (uid: string) => {
    const newLabels = labels.filter((label) => label.uid !== uid)
    setLabelsState({ labels: newLabels })

    const updatedPatterns = patterns.map((pattern) => ({
      ...pattern,
      labels: pattern.labels.filter((label) => label.uid !== uid),
    }))
    setPatternsState({ patterns: updatedPatterns })
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

const CalculateButton: FC<{ trials: number }> = ({ trials }) => {
  const deck = useAtomValue(deckAtom)
  const card = useAtomValue(cardsAtom)
  const pattern = useAtomValue(patternAtom)
  const pot = useAtomValue(potAtom)
  const setCalculationResult = useSetAtom(calculationResultAtom)

  const handleCalculate = () => {
    const result = calculateProbability(deck, card, pattern, trials, pot)
    setCalculationResult(result)
  }

  return <Button onClick={handleCalculate}>計算</Button>
}

const domNode = document.getElementById("root")

if (domNode != null) {
  const root = createRoot(domNode)
  root.render(<Root />)
}
