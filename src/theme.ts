import { cardAnatomy, accordionAnatomy } from "@chakra-ui/anatomy"
import { createMultiStyleConfigHelpers, defineStyle, defineStyleConfig, extendTheme } from "@chakra-ui/react"

const { definePartsStyle: cardDefinePartsStyle } = createMultiStyleConfigHelpers(cardAnatomy.keys)
const { definePartsStyle: accordionDefinePartsStyle } = createMultiStyleConfigHelpers(accordionAnatomy.keys)

export const theme = extendTheme({
  styles: {
    global: {
      body: {
        bg: "gray.50",
      },
    },
  },
  fontSizes: {
    xs: "10px",
    sm: "12px",
    md: "14px",
    lg: "16px",
    xl: "18px",
  },
  components: {
    Button: defineStyleConfig({
      variants: {
        solid: defineStyle({
          bg: "gray.200",
        }),
      },
    }),
    Card: {
      baseStyle: cardDefinePartsStyle({
        container: {
          shadow: "base",
        },
        body: {
          padding: 3,
        },
      }),
    },
    Accordion: {
      baseStyle: accordionDefinePartsStyle({
        button: {
          paddingBottom: 0,
        },
      }),
    },
  },
})
