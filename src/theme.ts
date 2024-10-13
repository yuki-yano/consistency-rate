import { accordionAnatomy, cardAnatomy } from "@chakra-ui/anatomy"
import { createMultiStyleConfigHelpers, defineStyle, defineStyleConfig, extendTheme } from "@chakra-ui/react"

const { definePartsStyle: cardDefinePartsStyle } = createMultiStyleConfigHelpers(cardAnatomy.keys)
const { definePartsStyle: accordionDefinePartsStyle } = createMultiStyleConfigHelpers(accordionAnatomy.keys)

export const theme = extendTheme({
  components: {
    Accordion: {
      baseStyle: accordionDefinePartsStyle({
        button: {
          paddingBottom: 0,
        },
      }),
    },
    Button: defineStyleConfig({
      variants: {
        solid: defineStyle({
          bg: "gray.200",
        }),
      },
    }),
    Card: {
      baseStyle: cardDefinePartsStyle({
        body: {
          padding: 3,
        },
        container: {
          shadow: "base",
        },
      }),
    },
  },
  fontSizes: {
    lg: "16px",
    md: "14px",
    sm: "12px",
    xl: "18px",
    xs: "10px",
  },
  styles: {
    global: {
      body: {
        bg: "gray.50",
      },
    },
  },
})
