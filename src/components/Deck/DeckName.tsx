import type { FC } from "react";

import { Box, FormControl, FormLabel, Input } from "@chakra-ui/react";
import { useAtom } from "jotai";

import { locAtom } from "../../state";

export const DeckName: FC = () => {
  const [loc, setLoc] = useAtom(locAtom);

  return (
    <Box my={2}>
      <FormControl>
        <FormLabel>デッキ名</FormLabel>
        <Input
          onChange={(e) => {
            setLoc((prev) => ({
              ...prev,
              searchParams:
                e.target.value === ""
                  ? undefined
                  : new URLSearchParams([
                      ["deckName", encodeURIComponent(e.target.value)],
                    ]),
            }));
          }}
          value={decodeURIComponent(loc.searchParams?.get("deckName") ?? "")}
        />
      </FormControl>
    </Box>
  );
}; 