import { ChakraProvider } from "@chakra-ui/react"
import { createRoot } from "react-dom/client"

import { Redirect } from "./components/Redirect"
import { theme } from "./theme"

declare global {
  interface Window {
    __REDIRECT_URL__?: string
  }
}

const mount = () => {
  const container = document.getElementById("redirect-root")
  const url = window.__REDIRECT_URL__ ?? "\/"

  if (!container) return
  const root = createRoot(container)
  root.render(
    <ChakraProvider theme={theme}>
      <Redirect targetUrl={url} />
    </ChakraProvider>,
  )
}

mount()

