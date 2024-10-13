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
import { type FC, useEffect, useState } from "react"
import React from "react"
import { createRoot } from "react-dom/client"
import { LuCheckCircle2, LuCircle } from "react-icons/lu"
import { VscArrowCircleDown, VscArrowCircleUp, VscClose, VscCopy } from "react-icons/vsc"
import { v4 as uuidv4 } from "uuid"

import { calculateProbability } from "./calc"
import { fetchShortUrl } from "./fetch"
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
import { theme } from "./theme"

type CalculationResult = {
  labelSuccessRates: { [label: string]: string }
  overallProbability: string
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
  const { hasCopied, onCopy, setValue: setShortUrl, value: shortUrl } = useClipboard("")
  const [loadingShortUrl, setLoadingShortUrl] = useState(false)

  useEffect(() => {
    setPattern({
      patterns: pattern.patterns.map((p) => ({ ...p, expanded: false })),
    })

    if (pattern.patterns.length !== 0) {
      setCalculationResult(calculateProbability(deck, card, pattern, trials))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null)

  return (
    <Container maxW="container.xl">
      <Heading as="h1" py={4} size="lg">
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
        <Deck deck={deck} setDeck={setDeck} setTrials={setTrials} trials={trials} />

        {calculationResult != null && (
          <SuccessRates calculationResult={calculationResult} labels={labels} pattern={pattern} />
        )}
      </Grid>

      <Divider my={4} />

      <CardList cards={card.cards} patterns={pattern.patterns} setCard={setCard} setPattern={setPattern} />

      <Divider my={4} />

      <LabelManagement
        labels={labels.labels}
        patterns={pattern.patterns}
        setLabels={setLabels}
        setPatterns={setPattern}
      />

      <Divider my={4} />

      <PatternList cards={card.cards} labels={labels.labels} patterns={pattern.patterns} setPattern={setPattern} />
    </Container>
  )
}

const SuccessRates: FC<{
  calculationResult: CalculationResult
  labels: LabelState
  pattern: PatternState
}> = ({ calculationResult, labels, pattern }) => {
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
  setTrials: (trials: number) => void
  trials: number
}> = ({ deck, setDeck, setTrials, trials }) => {
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
              onChange={(e) => {
                const input = Number(e.target.value)

                if (input > 1000000) {
                  setTrials(1000000)
                } else {
                  setTrials(input)
                }
              }}
              type="text"
              value={trials.toString()}
            />
          </FormControl>
        </Box>
      </CardBody>
    </Card>
  )
}

const CardList: FC<{
  cards: Array<CardData>
  patterns: Array<Pattern>
  setCard: (cards: CardsState) => void
  setPattern: (patterns: PatternState) => void
}> = ({ cards, patterns, setCard, setPattern }) => {
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
            count: 1,
            name: "",
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
            card={card}
            handleDeleteCard={handleDeleteCard}
            index={index}
            key={card.uid}
            moveCardDown={moveCardDown}
            moveCardUp={moveCardUp}
            updateCard={updateCard}
          />
        ))}
      </Grid>
    </Box>
  )
}

const CardItem: FC<{
  card: CardData
  handleDeleteCard: (uid: string) => void
  index: number
  moveCardDown: (index: number) => void
  moveCardUp: (index: number) => void
  updateCard: (updatedCard: CardData) => void
}> = ({ card, handleDeleteCard, index, moveCardDown, moveCardUp, updateCard }) => {
  const [tmpName, setTempName] = useState(card.name)

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
  cards: Array<CardData>
  condition: Condition
  onChange: (condition: Condition) => void
  onDelete: () => void
}> = ({ cards, condition, onChange, onDelete }) => {
  return (
    <Card shadow="xs">
      <CardBody>
        <Icon as={VscClose} fontSize="xl" onClick={onDelete} />

        <FormControl my={2}>
          <FormLabel>カードを選択</FormLabel>
          <Select
            closeMenuOnSelect={false}
            isClearable={false}
            isMulti
            menuPortalTarget={document.body}
            onChange={(selectedValues) => {
              const uids = selectedValues.map((value) => value.value)
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
          <Select
            isClearable={false}
            menuPortalTarget={document.body}
            onChange={(selectedValue) => {
              onChange({
                ...condition,
                mode: selectedValue?.value as PatternMode,
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

const PatternItem: FC<{
  cards: Array<CardData>
  index: number
  labels: Array<{ name: string; uid: string }>
  pattern: Pattern
  patterns: Array<Pattern>
  setPattern: (patterns: PatternState) => void
}> = ({ cards, index, labels, pattern, patterns, setPattern }) => {
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
                  <Box py={2}>
                    <Box my={2}>
                      <FormControl>
                        <FormLabel>パターン名</FormLabel>
                        <Input
                          onChange={(e) => {
                            const newPatterns = patterns.map((p, i) => {
                              if (i === index) {
                                return { ...p, name: e.target.value }
                              }
                              return p
                            })
                            setPattern({ patterns: newPatterns })
                          }}
                          type="text"
                          value={pattern.name}
                        />
                      </FormControl>
                    </Box>

                    <Box my={2}>
                      <FormControl>
                        <FormLabel>ラベル</FormLabel>
                        <Select
                          closeMenuOnSelect={false}
                          isClearable={false}
                          isMulti
                          menuPortalTarget={document.body}
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
                              if (i === index) {
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

                  {pattern.conditions.map((condition, conditionIndex) => (
                    <Box key={conditionIndex}>
                      <ConditionInput
                        cards={cards}
                        condition={condition}
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

const PatternList: FC<{
  cards: Array<CardData>
  labels: Array<{ name: string; uid: string }>
  patterns: Array<Pattern>
  setPattern: (patterns: PatternState) => void
}> = React.memo(({ cards, labels, patterns, setPattern }) => {
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
    setPattern({ patterns: [...patterns, newPattern] })
  }

  return (
    <Box>
      <Button onClick={addPattern}>パターンを追加</Button>
      {patterns.map((pattern, index) => (
        <Box key={index} my={4}>
          <PatternItem
            cards={cards}
            index={index}
            labels={labels}
            pattern={pattern}
            patterns={patterns}
            setPattern={setPattern}
          />
        </Box>
      ))}
    </Box>
  )
})

const LabelManagement: FC<{
  labels: Array<{ name: string; uid: string }>
  patterns: Array<Pattern>
  setLabels: (labels: LabelState) => void
  setPatterns: (patterns: PatternState) => void
}> = ({ labels, patterns, setLabels, setPatterns }) => {
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
      <Button mb={4} onClick={addLabel}>
        ラベルを追加
      </Button>
      <Grid gap={4} templateColumns="repeat(auto-fill, minmax(300px, 1fr))">
        {labels.map((label) => (
          <Card key={label.uid}>
            <CardBody>
              <Flex align="center" gap={2} justify="space-between">
                <Icon as={VscClose} fontSize="xl" onClick={() => deleteLabel(label.uid)} />
                <Input onChange={(e) => editLabel(label.uid, e.target.value)} value={label.name} />
              </Flex>
            </CardBody>
          </Card>
        ))}
      </Grid>
    </Box>
  )
}

const domNode = document.getElementById("root")

if (domNode != null) {
  const root = createRoot(domNode)
  root.render(<Root />)
}
