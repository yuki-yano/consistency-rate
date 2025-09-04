import { Button, Center, Container, Link, Spinner, Stack, Text } from "@chakra-ui/react"
import { useEffect } from "react"

type RedirectProps = {
  targetUrl: string
}

export const Redirect = ({ targetUrl }: RedirectProps) => {
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        // 即時置換（履歴に残さない）
        window.location.replace(targetUrl)
      } catch {
        // フォールバック
        window.location.href = targetUrl
      }
    }, 50)

    return () => {
      clearTimeout(t)
    }
  }, [targetUrl])

  return (
    <Container maxW="lg" py={16}>
      <Stack align="center" spacing={6}>
        <Center>
          <Spinner size="xl" thickness="4px" speed="0.65s" color="blue.400" />
        </Center>
        <Text as="h1" fontSize="2xl" fontWeight="bold">
          リダイレクト中です…
        </Text>
        <Text color="gray.600" textAlign="center">
          数秒経っても移動しない場合は、次のリンクをクリックしてください。
        </Text>
        <Link href={targetUrl} color="blue.500" isExternal>
          手動で移動する
        </Link>
        <Stack direction={{ base: "column", sm: "row" }} spacing={3}>
          <Button as={Link} href="/" variant="outline">
            トップに戻る
          </Button>
          <Button
            colorScheme="blue"
            onClick={async () => {
              await navigator.clipboard.writeText(targetUrl)
            }}
          >
            リンクをコピー
          </Button>
        </Stack>
      </Stack>
    </Container>
  )
}
