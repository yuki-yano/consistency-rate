import { ChakraProvider } from "@chakra-ui/react"
import { useAtom } from "jotai"
import { DevTools } from "jotai-devtools"
import "jotai-devtools/styles.css"
import { useEffect } from "react"
import { createRoot } from "react-dom/client"

import type { CalculationResultState, CardsState, DeckState, LabelState, PatternState, PotState } from "./state"

import { App } from "./App"
import { ChatProvider } from "./providers/ChatProvider"
import { calculationResultAtom, cardsAtom, deckAtom, labelAtom, patternAtom, potAtom } from "./state"
import { theme } from "./theme"

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
  const [, setDeck] = useAtom(deckAtom)
  const [, setCards] = useAtom(cardsAtom)
  const [, setPattern] = useAtom(patternAtom)
  const [, setPot] = useAtom(potAtom)
  const [, setLabel] = useAtom(labelAtom)
  const [calculationResult, setCalculationResult] = useAtom(calculationResultAtom)
  const [cards] = useAtom(cardsAtom)
  const [deck] = useAtom(deckAtom)
  const [label] = useAtom(labelAtom)
  const [pattern] = useAtom(patternAtom)
  const [pot] = useAtom(potAtom)

  useEffect(() => {
    window.injectFromState = (states: StateMap) => {
      if (states.deck != null) setDeck(states.deck)
      if (states.cards != null) setCards(states.cards)
      if (states.pattern != null) setPattern(states.pattern)
      if (states.pot != null) setPot(states.pot)
      if (states.label != null) setLabel(states.label)
      if (states.calculationResult != null) setCalculationResult(states.calculationResult)
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
    setCalculationResult,
    setCards,
    setDeck,
    setLabel,
    setPattern,
    setPot,
    calculationResult,
    cards,
    deck,
    label,
    pattern,
    pot,
  ])

  return (
    <ChakraProvider theme={theme}>
      {import.meta.env.DEV && <DevTools />}
      <ChatProvider>
        <App />
      </ChatProvider>
    </ChakraProvider>
  )
}

const domNode = document.getElementById("root")

if (domNode != null) {
  const root = createRoot(domNode)
  root.render(<Root />)
}
