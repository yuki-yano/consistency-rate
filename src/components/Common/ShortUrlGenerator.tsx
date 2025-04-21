import type { FC } from "react";

import { Button, Flex, Icon, Input, useClipboard } from "@chakra-ui/react";
import { useState } from "react";
import { LuCopy, LuCopyCheck } from "react-icons/lu";

import { fetchShortUrl } from "../../fetch";

export const ShortUrlGenerator: FC = () => {
  const { hasCopied, onCopy, setValue: setShortUrl, value: shortUrl } = useClipboard("");
  const [loadingShortUrl, setLoadingShortUrl] = useState(false);

  return (
    <Flex gap={2} mb={2}>
      <Button
        disabled={loadingShortUrl}
        onClick={async () => {
          setLoadingShortUrl(true);
          const shortUrl = await fetchShortUrl(location.href);
          setShortUrl(shortUrl);
          setLoadingShortUrl(false);
        }}
      >
        短縮URLを生成
      </Button>

      <Input
        maxW="150px"
        onChange={(e) => {
          setShortUrl(e.target.value);
        }}
        placeholder="短縮URL"
        readOnly
        value={shortUrl}
      />

      <Button disabled={loadingShortUrl || shortUrl === ""} onClick={onCopy}>
        <Icon as={hasCopied ? LuCopyCheck : LuCopy} h={4} w={4} />
      </Button>
    </Flex>
  );
}; 