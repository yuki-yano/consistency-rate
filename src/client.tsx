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
  Text,
  UnorderedList,
  useClipboard,
} from "@chakra-ui/react"
import { Select } from "chakra-react-select"
import { useAtom } from "jotai"
import { useEffect, useState, type FC } from "react"
import { createRoot } from "react-dom/client"
import { LuCheckCircle2, LuCircle } from "react-icons/lu"
import { VscArrowCircleDown, VscArrowCircleUp, VscClose, VscCopy } from "react-icons/vsc"
import { sprintf } from "sprintf-js"
import { v4 as uuidv4 } from "uuid"
import { theme } from "./theme"
import {
  type CardData,
  cardsAtom,
  type CardsState,
  type Condition,
  deckAtom,
  type DeckState,
  labelAtom,
  type LabelState,
  type Pattern,
  patternAtom,
  type PatternMode,
  type PatternState,
} from "./state"

type CalculationResult = {
  overallProbability: string
  labelSuccessRates: { [label: string]: string }
  patternSuccessRates: { [patternId: string]: string }
}

const Root = () => {
  return (
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>
  )
}

const App: FC = () => {
  const [deck, setDeck] = useAtom(deckAtom)
  const [card, setCard] = useAtom(cardsAtom)
  const [pattern, setPattern] = useAtom(patternAtom)
  const [labels, setLabels] = useAtom(labelAtom)
  const [trials, setTrials] = useState<number>(100000)
  const { onCopy, value: shortUrl, setValue: setShortUrl, hasCopied } = useClipboard("")
  const [loadingShortUrl, setLoadingShortUrl] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    setPattern({
      patterns: pattern.patterns.map((p) => ({ ...p, expanded: false })),
    })

    if (pattern.patterns.length !== 0) {
      setCalculationResult(calculateProbability(deck, card, pattern, trials))
    }
  }, [])

  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null)

  return (
    <Container maxW="container.xl">
      <Heading as="h1" size="lg" py={4}>
        <Link href="/">初動率計算機</Link>
      </Heading>
      <Box my={4}>
        <Flex gap={4}>
          <Button
            onClick={() => {
              setCalculationResult(calculateProbability(deck, card, pattern, trials))
            }}
          >
            計算
          </Button>
        </Flex>
      </Box>

      <Flex gap={1} my={4}>
        <Button
          onClick={async () => {
            setLoadingShortUrl(true)
            const shortUrl = await fetchShortUrl(location.href)
            setShortUrl(shortUrl)
            setLoadingShortUrl(false)
          }}
          disabled={loadingShortUrl}
        >
          短縮URLを生成
        </Button>

        <Input
          placeholder="短縮URL"
          value={shortUrl}
          onChange={(e) => {
            setShortUrl(e.target.value)
          }}
          maxW="150px"
          readOnly
        />

        <Button onClick={onCopy} disabled={loadingShortUrl || shortUrl === ""}>
          {hasCopied ? "Copied!" : "Copy"}
        </Button>
      </Flex>

      <Grid gap={4} templateColumns="repeat(auto-fill, minmax(300px, 1fr))">
        <Deck deck={deck} setDeck={setDeck} trials={trials} setTrials={setTrials} />

        {calculationResult != null && (
          <SuccessRates calculationResult={calculationResult} pattern={pattern} labels={labels} />
        )}
      </Grid>

      <Divider my={4} />

      <CardList cards={card.cards} setCard={setCard} patterns={pattern.patterns} setPattern={setPattern} />

      <Divider my={4} />

      <LabelManagement
        labels={labels.labels}
        setLabels={setLabels}
        patterns={pattern.patterns}
        setPatterns={setPattern}
      />

      <Divider my={4} />

      <PatternList cards={card.cards} patterns={pattern.patterns} setPattern={setPattern} labels={labels.labels} />
    </Container>
  )
}

const SuccessRates: FC<{
  calculationResult: CalculationResult
  pattern: PatternState
  labels: LabelState
}> = ({ calculationResult, pattern, labels }) => {
  return (
    <>
      <Card>
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
}

const Deck: FC<{
  deck: DeckState
  setDeck: (deck: DeckState) => void
  trials: number
  setTrials: (trials: number) => void
}> = ({ deck, setDeck, trials, setTrials }) => {
  return (
    <Card>
      <CardBody>
        <Heading as="h2" fontSize="lg" py={2}>
          デッキ情報
        </Heading>

        <Box my={2}>
          <FormControl>
            <FormLabel>枚数</FormLabel>
            <Input
              type="text"
              placeholder="40"
              value={deck.cardCount.toString()}
              onChange={(e) => setDeck({ ...deck, cardCount: Number(e.target.value) ?? 0 })}
            />
          </FormControl>
        </Box>

        <Box my={2}>
          <FormControl>
            <FormLabel>初手枚数</FormLabel>
            <Input
              type="text"
              value={deck.firstHand.toString()}
              placeholder="5"
              onChange={(e) => setDeck({ ...deck, firstHand: Number(e.target.value) ?? 0 })}
            />
          </FormControl>
        </Box>

        <Box my={2}>
          <FormControl>
            <FormLabel>試行回数</FormLabel>
            <Input
              value={trials.toString()}
              type="text"
              onChange={(e) => {
                const input = Number(e.target.value) ?? 100000

                if (input > 1000000) {
                  setTrials(1000000)
                } else {
                  setTrials(input)
                }
              }}
            />
          </FormControl>
        </Box>
      </CardBody>
    </Card>
  )
}

const CardList: FC<{
  cards: Array<CardData>
  setCard: (cards: CardsState) => void
  patterns: Array<Pattern>
  setPattern: (patterns: PatternState) => void
}> = ({ cards, setCard, patterns, setPattern }) => {
  const handleDeleteCard = (uid: string) => {
    const newCards = cards.filter((c) => c.uid !== uid)
    setCard({ cards: newCards })

    const updatedPatterns = patterns.map((pattern) => {
      const updatedConditions = pattern.conditions.map((condition) => ({
        ...condition,
        uids: condition.uids.filter((id) => id !== uid),
      }))
      return { ...pattern, conditions: updatedConditions }
    })
    setPattern({ patterns: updatedPatterns })
  }

  const moveCardUp = (index: number) => {
    if (index > 0) {
      const newCards = [...cards]
      const [movedCard] = newCards.splice(index, 1)
      newCards.splice(index - 1, 0, movedCard)
      setCard({ cards: newCards })
    }
  }

  const moveCardDown = (index: number) => {
    if (index < cards.length - 1) {
      const newCards = [...cards]
      const [movedCard] = newCards.splice(index, 1)
      newCards.splice(index + 1, 0, movedCard)
      setCard({ cards: newCards })
    }
  }

  const updateCard = (updatedCard: CardData) => {
    const newCards = cards.map((c) => {
      if (c.uid === updatedCard.uid) {
        return updatedCard
      }
      return c
    })
    setCard({ cards: newCards })
  }

  return (
    <Box>
      <Button
        mb={4}
        onClick={() => {
          const newCards = cards.concat({
            name: "",
            count: 1,
            uid: uuidv4(),
          })
          setCard({ cards: newCards })
        }}
      >
        カードを追加
      </Button>

      <Grid gap={4} templateColumns="repeat(auto-fill, minmax(300px, 1fr))">
        {cards.map((card, index) => (
          <CardItem
            key={card.uid}
            card={card}
            index={index}
            handleDeleteCard={handleDeleteCard}
            moveCardUp={moveCardUp}
            moveCardDown={moveCardDown}
            updateCard={updateCard}
          />
        ))}
      </Grid>
    </Box>
  )
}

const CardItem: FC<{
  card: CardData
  index: number
  handleDeleteCard: (uid: string) => void
  moveCardUp: (index: number) => void
  moveCardDown: (index: number) => void
  updateCard: (updatedCard: CardData) => void
}> = ({ card, index, handleDeleteCard, moveCardUp, moveCardDown, updateCard }) => {
  const [tmpName, setTempName] = useState(card.name)

  return (
    <Card key={card.uid} py={2}>
      <CardBody>
        <Flex gap={3} mb={2}>
          <Icon as={VscClose} onClick={() => handleDeleteCard(card.uid)} fontSize="xl" color="gray.600" />
          <Icon as={VscArrowCircleUp} onClick={() => moveCardUp(index)} fontSize="xl" color="gray.600" />
          <Icon as={VscArrowCircleDown} onClick={() => moveCardDown(index)} fontSize="xl" color="gray.600" />
        </Flex>

        <Box py={2}>
          <FormControl>
            <FormLabel>カード名</FormLabel>
            <Input
              type="text"
              value={tmpName}
              placeholder="カード名"
              onChange={(e) => setTempName(e.target.value)}
              onBlur={() => {
                updateCard({ ...card, name: tmpName })
              }}
            />
          </FormControl>
        </Box>
        <Box py={2}>
          <FormControl>
            <FormLabel>枚数</FormLabel>
            <Input
              type="number"
              value={card.count.toString()}
              placeholder="枚数"
              onChange={(e) => {
                updateCard({ ...card, count: Number(e.target.value) ?? 1 })
              }}
            />
          </FormControl>
        </Box>
      </CardBody>
    </Card>
  )
}

const ConditionInput: FC<{
  condition: Condition
  cards: Array<CardData>
  onChange: (condition: Condition) => void
  onDelete: () => void
}> = ({ condition, cards, onChange, onDelete }) => {
  return (
    <Card shadow="xs">
      <CardBody>
        <Icon as={VscClose} onClick={onDelete} fontSize="xl" />

        <FormControl my={2}>
          <FormLabel>カードを選択</FormLabel>
          <Select
            menuPortalTarget={document.body}
            value={condition.uids.map((uid) => ({
              label: cards.find((card) => card.uid === uid)?.name,
              value: uid,
            }))}
            isMulti
            isClearable={false}
            closeMenuOnSelect={false}
            options={cards.map((card) => ({
              label: card.name,
              value: card.uid,
            }))}
            onChange={(selectedValues) => {
              const uids = selectedValues.map((value) => value.value)
              onChange({ ...condition, uids })
            }}
          />
        </FormControl>

        <FormControl my={2}>
          <FormLabel>枚数</FormLabel>
          <Input
            disabled={condition.mode === "not_drawn"}
            type="number"
            value={condition.count.toString()}
            onChange={(e) => onChange({ ...condition, count: Number(e.target.value) ?? 1 })}
          />
        </FormControl>

        <FormControl my={2}>
          <FormLabel>条件</FormLabel>
          <Select
            menuPortalTarget={document.body}
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
            isClearable={false}
            options={[
              { label: "以上ドロー", value: "required" },
              { label: "以上デッキに残す", value: "leave_deck" },
              { label: "ドローなし", value: "not_drawn" },
            ]}
            onChange={(selectedValue) => {
              onChange({
                ...condition,
                mode: selectedValue?.value as PatternMode,
              })
            }}
          />
        </FormControl>
      </CardBody>
    </Card>
  )
}

const PatternItem: FC<{
  pattern: Pattern
  index: number
  patterns: Array<Pattern>
  setPattern: (patterns: PatternState) => void
  cards: Array<CardData>
  labels: Array<{ name: string; uid: string }>
}> = ({ pattern, index, patterns, setPattern, cards, labels }) => {
  const [active, setActive] = useState(pattern.active)

  const addCondition = () => {
    const newCondition = {
      uids: [],
      count: 1,
      mode: "required",
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
            onClick={() => setPattern({ patterns: patterns.filter((_, i) => i !== index) })}
            fontSize="xl"
            color="gray.600"
          />
          <Icon as={VscCopy} onClick={duplicatePattern} fontSize="xl" color="gray.600" />
          <Icon as={VscArrowCircleUp} onClick={movePatternUp} fontSize="xl" color="gray.600" />
          <Icon as={VscArrowCircleDown} onClick={movePatternDown} fontSize="xl" color="gray.600" />
        </Flex>

        <Flex gap={1} align="center">
          <Icon as={active ? LuCheckCircle2 : LuCircle} onClick={handleToggleActive} fontSize="xl" />

          <Accordion allowToggle w="full">
            <AccordionItem border="none">
              <h2>
                <AccordionButton
                  _hover={{
                    bg: "white",
                  }}
                >
                  <Box as="span" flex="1" textAlign="left">
                    <Text fontSize="lg" as="b" color={active ? "gray.800" : "gray.500"}>
                      {pattern.name}
                    </Text>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>

              <Box ml={4}>
                <Text fontSize="md" color="gray.600">
                  ラベル:&nbsp;
                  {pattern.labels
                    .map((label) => labels.find((l) => l.uid === label.uid)?.name)
                    .filter(Boolean)
                    .join(", ")}
                </Text>
                <Text fontSize="md" color="gray.600">
                  優先度: {pattern.priority}
                </Text>
              </Box>

              <AccordionPanel>
                <Grid gap={4} templateColumns="repeat(auto-fill, minmax(300px, 1fr))">
                  <Box py={2}>
                    <Box my={2}>
                      <FormControl>
                        <FormLabel>パターン名</FormLabel>
                        <Input
                          type="text"
                          value={pattern.name}
                          onChange={(e) => {
                            const newPatterns = patterns.map((p, i) => {
                              if (i === index) {
                                return { ...p, name: e.target.value }
                              }
                              return p
                            })
                            setPattern({ patterns: newPatterns })
                          }}
                        />
                      </FormControl>
                    </Box>

                    <Box my={2}>
                      <FormControl>
                        <FormLabel>ラベル</FormLabel>
                        <Select
                          menuPortalTarget={document.body}
                          value={pattern.labels.map((label) => ({
                            label: labels.find((l) => l.uid === label.uid)?.name,
                            value: label.uid,
                          }))}
                          isMulti
                          isClearable={false}
                          closeMenuOnSelect={false}
                          options={labels.map((label) => ({
                            label: label.name,
                            value: label.uid,
                          }))}
                          onChange={(selectedValues) => {
                            const newLabels = selectedValues.map((value) => ({
                              uid: value.value,
                            }))
                            const newPatterns = patterns.map((p, i) => {
                              if (i === index) {
                                return { ...p, labels: newLabels }
                              }
                              return p
                            })
                            setPattern({ patterns: newPatterns })
                          }}
                        />
                      </FormControl>
                    </Box>

                    <Box my={2}>
                      <FormControl>
                        <FormLabel>優先度</FormLabel>
                        <Input
                          type="number"
                          value={pattern.priority.toString()}
                          onChange={(e) => {
                            const newPatterns = patterns.map((p, i) => {
                              if (i === index) {
                                return {
                                  ...p,
                                  priority: Number(e.target.value) ?? 1,
                                }
                              }
                              return p
                            })
                            setPattern({ patterns: newPatterns })
                          }}
                        />
                      </FormControl>
                    </Box>
                  </Box>

                  {pattern.conditions.map((condition, conditionIndex) => (
                    <Box key={conditionIndex}>
                      <ConditionInput
                        condition={condition}
                        cards={cards}
                        onChange={(updatedCondition) => {
                          const newConditions = pattern.conditions.map((c, i) => {
                            if (i === conditionIndex) {
                              return updatedCondition
                            }
                            return c
                          })
                          const newPatterns = patterns.map((p, i) => {
                            if (i === index) {
                              return { ...p, conditions: newConditions }
                            }
                            return p
                          })
                          setPattern({ patterns: newPatterns })
                        }}
                        onDelete={() => {
                          const newConditions = pattern.conditions.filter((_, i) => i !== conditionIndex)
                          const newPatterns = patterns.map((p, i) => {
                            if (i === index) {
                              return { ...p, conditions: newConditions }
                            }
                            return p
                          })
                          setPattern({ patterns: newPatterns })
                        }}
                      />
                    </Box>
                  ))}
                </Grid>

                <Button onClick={addCondition} mt={4}>
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

const PatternList: FC<{
  cards: Array<CardData>
  patterns: Array<Pattern>
  setPattern: (patterns: PatternState) => void
  labels: Array<{ name: string; uid: string }>
}> = ({ cards, patterns, setPattern, labels }) => {
  const addPattern = () => {
    const newPattern = {
      uid: uuidv4(),
      name: `パターン${patterns.length + 1}`,
      conditions: [],
      priority: 1,
      labels: [],
      active: true,
      expanded: true,
    }
    setPattern({ patterns: [...patterns, newPattern] })
  }

  return (
    <Box>
      <Button onClick={addPattern}>パターンを追加</Button>
      {patterns.map((pattern, index) => (
        <Box key={index} my={4}>
          <PatternItem
            pattern={pattern}
            index={index}
            patterns={patterns}
            setPattern={setPattern}
            cards={cards}
            labels={labels}
          />
        </Box>
      ))}
    </Box>
  )
}

const LabelManagement: FC<{
  labels: Array<{ name: string; uid: string }>
  setLabels: (labels: LabelState) => void
  patterns: Array<Pattern>
  setPatterns: (patterns: PatternState) => void
}> = ({ labels, setLabels, patterns, setPatterns }) => {
  const addLabel = () => {
    const labelToAdd = { name: "新規ラベル", uid: uuidv4() }
    setLabels({ labels: [...labels, labelToAdd] })
  }

  const deleteLabel = (uid: string) => {
    const newLabels = labels.filter((label) => label.uid !== uid)
    setLabels({ labels: newLabels })

    const updatedPatterns = patterns.map((pattern) => ({
      ...pattern,
      labels: pattern.labels.filter((label) => label.uid !== uid),
    }))
    setPatterns({ patterns: updatedPatterns })
  }

  const editLabel = (uid: string, newName: string) => {
    const newLabels = labels.map((label) => {
      if (label.uid === uid) {
        return { ...label, name: newName }
      }
      return label
    })
    setLabels({ labels: newLabels })
  }

  return (
    <Box mb={4}>
      <Button onClick={addLabel} mb={4}>
        ラベルを追加
      </Button>
      <Grid gap={4} templateColumns="repeat(auto-fill, minmax(300px, 1fr))">
        {labels.map((label) => (
          <Card key={label.uid}>
            <CardBody>
              <Flex justify="space-between" align="center" gap={2}>
                <Icon as={VscClose} onClick={() => deleteLabel(label.uid)} fontSize="xl" />
                <Input value={label.name} onChange={(e) => editLabel(label.uid, e.target.value)} />
              </Flex>
            </CardBody>
          </Card>
        ))}
      </Grid>
    </Box>
  )
}

const checkPatternConditions = (
  drawnCards: Array<{ uid: string; name: string }>,
  pattern: Pattern,
  totalDeckCount: number,
) => {
  if (!pattern.active) {
    return false
  }

  return pattern.conditions.every((condition) => {
    const drawnCount = drawnCards.filter((card) => condition.uids.includes(card.uid)).length

    if (condition.mode === "required") {
      return drawnCount >= condition.count
    }

    if (condition.mode === "leave_deck") {
      const remainingDeckCount = totalDeckCount - drawnCards.length
      return remainingDeckCount >= condition.count
    }

    if (condition.mode === "not_drawn") {
      const notDrawnCount = condition.uids.filter((uid) => !drawnCards.some((drawn) => drawn.uid === uid)).length
      return notDrawnCount === condition.uids.length
    }

    return false
  })
}

const calculateProbability = (deck: DeckState, card: CardsState, pattern: PatternState, trials: number) => {
  const { cardCount, firstHand } = deck
  const { cards } = card
  const { patterns } = pattern

  const totalDeckCards = cards.reduce((total, c) => total + c.count, 0)
  const fullDeck: Array<{ uid: string; name: string }> = []

  for (const c of cards) {
    for (let i = 0; i < c.count; i++) {
      fullDeck.push({ uid: c.uid, name: c.name })
    }
  }

  const unknownCardCount = cardCount - totalDeckCards
  if (unknownCardCount > 0) {
    const unknownCard = { uid: "unknown_card", name: "unknown" }
    for (let i = 0; i < unknownCardCount; i++) {
      fullDeck.push(unknownCard)
    }
  }

  let successCount = 0
  const labelSuccessCount: { [label: string]: number } = {}
  const patternSuccessCount: { [patternId: string]: number } = {}

  for (let i = 0; i < trials; i++) {
    const shuffledDeck = fullDeck.slice()
    for (let i = shuffledDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffledDeck[i], shuffledDeck[j]] = [shuffledDeck[j], shuffledDeck[i]]
    }

    const drawnCards = shuffledDeck.slice(0, firstHand)
    const matches = patterns.filter((pattern) => checkPatternConditions(drawnCards, pattern, totalDeckCards))

    if (matches.length > 0) {
      successCount++

      for (const match of matches) {
        if (match.labels && match.labels.length > 0) {
          for (const label of match.labels) {
            if (label.uid === "") {
              continue
            }
            if (!labelSuccessCount[label.uid]) {
              labelSuccessCount[label.uid] = 0
            }
            labelSuccessCount[label.uid]++
          }
        }

        const patternId = match.uid
        if (!patternSuccessCount[patternId]) {
          patternSuccessCount[patternId] = 0
        }
        patternSuccessCount[patternId]++
      }
    }
  }

  const overallProbability = (successCount / trials) * 100

  const labelSuccessRates: { [label: string]: string } = {}
  for (const label in labelSuccessCount) {
    labelSuccessRates[label] = sprintf("%.2f", (labelSuccessCount[label] / trials) * 100)
  }

  const patternSuccessRates: { [patternId: string]: string } = {}
  for (const patternId in patternSuccessCount) {
    patternSuccessRates[patternId] = sprintf("%.2f", (patternSuccessCount[patternId] / trials) * 100)
  }

  const sortedLabelSuccessRates = Object.entries(labelSuccessRates)
    .sort(([, a], [, b]) => Number.parseFloat(b) - Number.parseFloat(a))
    .reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {})

  const sortedPatternSuccessRates = Object.entries(patternSuccessRates)
    .sort(([, a], [, b]) => Number.parseFloat(b) - Number.parseFloat(a))
    .reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {})

  return {
    overallProbability: sprintf("%.2f", overallProbability),
    labelSuccessRates: sortedLabelSuccessRates,
    patternSuccessRates: sortedPatternSuccessRates,
  }
}

const fetchShortUrl = async (url: string) => {
  const response = await fetch("https://ur0.cc/api.php?create=true", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    body: `url=${encodeURIComponent(url)}`,
  })

  const json = (await response.json()) as { shorturl: string }

  return json.shorturl
}

const domNode = document.getElementById("root")

if (domNode != null) {
  const root = createRoot(domNode)
  root.render(<Root />)
}
