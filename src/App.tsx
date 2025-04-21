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
import { isChatOpenAtom, locAtom } from "./state";

export const App: FC = () => {
  const successRatesRef = useRef<HTMLDivElement>(null);
  const [isChatOpen, setIsChatOpen] = useAtom(isChatOpenAtom);
  const loc = useAtomValue(locAtom);
  const isAiMode = useMemo(() => loc.searchParams?.get("mode") === "ai", [loc.searchParams]);

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