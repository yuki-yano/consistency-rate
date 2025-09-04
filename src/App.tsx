import type { FC } from "react";

import {
  Box,
  Container,
  Divider,
  Grid,
  Heading,
  Icon,
  IconButton,
  Link,
  Show,
} from "@chakra-ui/react";
import { useAtom, useAtomValue } from "jotai";
import { useMemo, useRef } from "react";
import { LuMessageSquare } from "react-icons/lu";

import { CalculateButton } from "./components/Calculation/CalculateButton";
import { SpCalcButton } from "./components/Calculation/SpCalcButton";
import { SuccessRates } from "./components/Calculation/SuccessRates";
import { CardList } from "./components/Card/CardList";
import { ChatUI } from "./components/Chat/ChatUI";
import { ShortUrlGenerator } from "./components/Common/ShortUrlGenerator";
import { Deck } from "./components/Deck/Deck";
import { LabelManagement } from "./components/Label/LabelManagement";
import { PatternList } from "./components/Pattern/PatternList";
import { Pot } from "./components/Pot/Pot";
import { calculationSettingsAtom, isChatOpenAtom, locAtom, potAtom, showDeltaAtom } from "./state";
import { Button, Flex } from "@chakra-ui/react";
import { useAtom } from "jotai";

export const App: FC = () => {
  const successRatesRef = useRef<HTMLDivElement>(null);
  const [isChatOpen, setIsChatOpen] = useAtom(isChatOpenAtom);
  const loc = useAtomValue(locAtom);
  const settings = useAtomValue(calculationSettingsAtom);
  const pot = useAtomValue(potAtom);
  const [showDelta, setShowDelta] = useAtom(showDeltaAtom);
  const isAiMode = useMemo(() => loc.searchParams?.get("mode") === "ai", [loc.searchParams]);
  const isExactActive = settings.mode !== "simulation" && pot.prosperity.count === 0;

  const scrollToSuccessRates = () => {
    if (successRatesRef.current) {
      successRatesRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

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

        {/* モバイル: 短縮URLの上に差分トグルを常時表示（厳密時のみ有効） */}
        <Show below="md">
          <Flex my={2} gap={2}>
            <Button
              onClick={() => setShowDelta((v) => !v)}
              size="sm"
              aria-pressed={showDelta}
              variant="solid"
              isDisabled={!isExactActive}
              colorScheme={isExactActive && showDelta ? "teal" : undefined}
              bgColor={!isExactActive ? "gray.200" : showDelta ? "teal.500" : "gray.300"}
              color={!isExactActive ? "gray.500" : showDelta ? "white" : "gray.700"}
              borderWidth={!isExactActive || !showDelta ? "1px" : undefined}
              borderColor={!isExactActive ? "gray.300" : !showDelta ? "gray.400" : undefined}
              _hover={{ bgColor: !isExactActive ? "gray.200" : showDelta ? "teal.600" : "gray.400" }}
              _active={{ bgColor: !isExactActive ? "gray.200" : showDelta ? "teal.700" : "gray.500" }}
              title={!isExactActive ? "厳密計算時のみ有効" : undefined}
            >
              差分表示: {showDelta ? "ON" : "OFF"}
            </Button>
          </Flex>
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

      {isAiMode && (
        <>
          <IconButton
            _hover={{
              bgColor: "gray.400",
            }}
            aria-label="チャットを開く"
            bgColor="gray.300"
            bottom={{ base: 24, md: 6 }}
            boxShadow="md"
            color="gray.600"
            h={14}
            icon={<Icon as={LuMessageSquare} h={8} w={8} />}
            isRound
            onClick={() => setIsChatOpen(true)}
            p={2}
            position="fixed"
            right={6}
            visibility={isChatOpen ? "hidden" : "visible"}
            w={14}
            zIndex="sticky"
          />

          {isChatOpen && <ChatUI />}
        </>
      )}
    </>
  );
}; 
