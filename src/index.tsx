import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { zValidator } from "@hono/zod-validator"
import { CoreMessage, LanguageModel, streamText } from "ai"
import { Hono } from "hono"
import { env } from "hono/adapter"
import { csrf } from "hono/csrf"
import { renderToString } from "react-dom/server"
import { v4 as uuidv4 } from "uuid"
import { z } from "zod"

type Bindings = {
  GEMINI_API_KEY: string
  GEMINI_MODEL?: string
  GOOGLE_AI_GATEWAY_URL?: string
  KV: KVNamespace
}


const BASE_TITLE = "初動率計算機"

const decodeNestedURIComponent = (value: string) => {
  let current = value

  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(current)

      if (decoded === current) {
        break
      }

      current = decoded
    } catch {
      break
    }
  }

  return current
}

const extractDeckName = (raw: string | null | undefined) => {
  if (raw == null || raw === "") {
    return null
  }

  const decoded = decodeNestedURIComponent(raw)
  const trimmed = decoded.trim()

  return trimmed === "" ? null : trimmed
}

const buildShareTitle = (deckName: string | null) => `${BASE_TITLE}${deckName != null ? ` - ${deckName}` : ""}`

const app = new Hono<{ Bindings: Bindings }>()

app.get("/", (c) => {
  const deckName = extractDeckName(c.req.query("deckName"))
  const pageTitle = buildShareTitle(deckName)

  return c.html(
    renderToString(
      <html lang="ja">
        <head>
          <title>{pageTitle}</title>
          <meta charSet="utf-8" />
          <meta content="width=device-width, initial-scale=1" name="viewport" />
          <meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" name="viewport" />

          <meta content={pageTitle} property="og:title" />
          <meta content="website" property="og:type" />
          <meta content="ja_JP" property="og:locale" />
          <meta content={pageTitle} property="twitter:title" />

          {import.meta.env.PROD ? (
            <script src="/static/client.js" type="module" />
          ) : (
            <script src="/src/client.tsx" type="module" />
          )}
        </head>
        <body>
          <div id="root" />
        </body>
      </html>,
    ),
  )
})

app.get("/short_url/:key{[0-9a-z]{8}}", async (c) => {
  const key = c.req.param("key")
  const storedUrlString = await c.env.KV.get(key)
  const requestUrl = new URL(c.req.url)

  const buildRedirectPage = (target: string, options: { deckName: string | null }) => {
    const isProd = import.meta.env.PROD
    const scriptSrc = isProd ? "/static/redirectClient.js" : "/src/redirectClient.tsx"
    let absoluteTarget = target

    try {
      absoluteTarget = new URL(target, requestUrl.origin).toString()
    } catch {
      // ignore malformed target
    }

    const shareTitle = buildShareTitle(options.deckName)

    return (
      <html lang="ja">
        <head>
          <meta charSet="utf-8" />
          <meta content="width=device-width, initial-scale=1, maximum-scale=1" name="viewport" />
          <title>リダイレクト中…</title>
          <meta content={shareTitle} property="og:title" />
          <meta content="website" property="og:type" />
          <meta content="ja_JP" property="og:locale" />
          <meta content={absoluteTarget} property="og:url" />
          <meta content="summary" name="twitter:card" />
          <meta content={shareTitle} name="twitter:title" />
          <meta content={absoluteTarget} name="twitter:url" />
          <meta content={`0;url=${absoluteTarget}`} httpEquiv="refresh" />
          <link href={absoluteTarget} rel="canonical" />
          <script dangerouslySetInnerHTML={{ __html: `window.__REDIRECT_URL__ = ${JSON.stringify(absoluteTarget)};` }} />
          <script src={scriptSrc} type="module" />
        </head>
        <body>
          <div id="redirect-root" />
        </body>
      </html>
    )
  }

  try {
    if (storedUrlString == null) {
      const fallbackTarget = new URL("/", requestUrl.origin).toString()
      return c.html(renderToString(buildRedirectPage(fallbackTarget, { deckName: null })))
    }

    const modeParam = requestUrl.searchParams.get("mode")

    const redirectUrl = new URL(storedUrlString)
    if (modeParam != null) redirectUrl.searchParams.set("mode", modeParam)

    const redirectUrlString = redirectUrl.toString()
    const deckName = extractDeckName(redirectUrl.searchParams.get("deckName"))
    return c.html(renderToString(buildRedirectPage(redirectUrlString, { deckName })))
  } catch (e) {
    console.error(
      `Error in /short_url/:key{[0-9a-z]{8}} (${c.req.path}): Invalid URL stored in KV:`,
      storedUrlString,
      e,
    )
    const fallbackTarget = new URL("/", requestUrl.origin).toString()
    return c.html(renderToString(buildRedirectPage(fallbackTarget, { deckName: null })))
  }
})

const shortenUrlSchema = z.object({
  url: z.string().url(),
})
const shortenUrlValidator = zValidator("form", shortenUrlSchema)

const createKey = async (kv: KVNamespace, value: string, prefix = "") => {
  const uuid = uuidv4()
  const key = uuid.substring(0, 8)
  const prefixedKey = prefix + key
  const result = await kv.get(prefixedKey)

  if (result == null) {
    await kv.put(prefixedKey, value)
    return key // Return the key without prefix
  } else {
    // Retry if key collision happens
    return await createKey(kv, value, prefix)
  }
}

app.post("/api/shorten_url/create", csrf(), shortenUrlValidator, async (c) => {
  const { url } = c.req.valid("form")
  const key = await createKey(c.env.KV, url) // No prefix for short URLs
  const shortenUrl = new URL(`/short_url/${key}`, c.req.url)

  try {
    const originalUrl = new URL(url)
    const modeParam = originalUrl.searchParams.get("mode")

    if (modeParam !== null) {
      shortenUrl.searchParams.set("mode", modeParam)
    }
  } catch (e) {
    console.error(`Error in /api/shorten_url/create (${c.req.path}): Invalid original URL format:`, url, e)
  }

  return c.json({ shortenUrl: shortenUrl.toString() })
})

const chatMessageSchema = z.object({
  content: z.string(),
  role: z.enum(["user", "assistant", "system"]),
})

const chatHistorySchema = z.object({
  messages: z.array(chatMessageSchema),
})
const chatHistoryValidator = zValidator("json", chatHistorySchema)

const CHAT_HISTORY_PREFIX = "chat_history_"

const createChatHistoryKey = async (kv: KVNamespace, messages: CoreMessage[]) => {
  // Use the generic createKey function with a prefix
  return await createKey(kv, JSON.stringify(messages), CHAT_HISTORY_PREFIX)
}

app.post("/api/chat/history", chatHistoryValidator, async (c) => {
  const { messages } = c.req.valid("json")

  if (messages == null || messages.length === 0) {
    return c.json({ error: "Messages cannot be empty" }, 400)
  }

  try {
    const key = await createChatHistoryKey(c.env.KV, messages)
    return c.json({ key: key })
  } catch (error) {
    console.error(`Error in /api/chat/history (${c.req.path}): Failed to save chat history:`, error)
    return c.json({ error: "Failed to save chat history" }, 500)
  }
})

app.get("/api/chat/history/:key{[0-9a-z]{8}}", async (c) => {
  const key = c.req.param("key")
  const prefixedKey = CHAT_HISTORY_PREFIX + key

  try {
    const storedHistory = await c.env.KV.get(prefixedKey)

    if (storedHistory === null) {
      return c.json({ error: "Chat history not found" }, 404)
    }

    // Attempt to parse the stored JSON string
    try {
      const messages: CoreMessage[] = JSON.parse(storedHistory)
      // Validate the structure roughly (more robust validation could be added)
      if (Array.isArray(messages) && messages.every((msg) => msg !== null && "role" in msg && "content" in msg)) {
        return c.json({ messages })
      } else {
        console.error("Invalid chat history format found in KV for key:", prefixedKey)
        return c.json({ error: "Invalid chat history format found" }, 500)
      }
    } catch (parseError) {
      console.error(
        `Error in /api/chat/history/:key{[0-9a-z]{8}} (${c.req.path}): Failed to parse chat history from KV for key:`,
        prefixedKey,
        parseError,
      )
      // Optionally delete the invalid entry
      // await c.env.KV.delete(prefixedKey);
      return c.json({ error: "Failed to parse chat history" }, 500)
    }
  } catch (error) {
    console.error(
      `Error in /api/chat/history/:key{[0-9a-z]{8}} (${c.req.path}): Failed to retrieve chat history:`,
      error,
    )
    return c.json({ error: "Failed to retrieve chat history" }, 500)
  }
})

app.post("/api/chat", async (c) => {
  try {
    const { GEMINI_API_KEY, GEMINI_MODEL, GOOGLE_AI_GATEWAY_URL } = env(c)

    const {
      messages,
      systemPrompt,
      thinkingBudget,
    }: {
      messages: CoreMessage[]
      systemPrompt?: string
      thinkingBudget?: number
    } = await c.req.json()

    const baseURL = GOOGLE_AI_GATEWAY_URL
    const apiKey = GEMINI_API_KEY
    const modelNameFromEnv = GEMINI_MODEL
    const defaultModel = "gemini-2.5-flash-lite"

    const validThinkingBudget =
      typeof thinkingBudget === "number" && [0, 1024, 8192].includes(thinkingBudget) ? thinkingBudget : 0
    const providerOptions = {
      google: {
        thinkingConfig: {
          thinkingBudget: validThinkingBudget,
        },
      },
    }

    if (baseURL == null) {
      console.error(`Error in /api/chat (${c.req.path}): GOOGLE_AI_GATEWAY_URL is not set.`)
      return new Response(JSON.stringify({ error: "GOOGLE_AI_GATEWAY_URL is not set." }), { status: 500 })
    }
    if (!apiKey) {
      console.error(`Error in /api/chat (${c.req.path}): GEMINI_API_KEY is not set.`)
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not set." }), { status: 500 })
    }

    const modelName =
      typeof modelNameFromEnv === "string" && modelNameFromEnv.trim() !== "" ? modelNameFromEnv : defaultModel

    const client = createGoogleGenerativeAI({
      apiKey: apiKey,
      baseURL: baseURL,
    })

    const model: LanguageModel = client(modelName)

    const processedMessages: CoreMessage[] = Array.isArray(messages)
      ? messages
          .filter((msg) => msg.role === "user" || msg.role === "assistant")
          .map((msg) => ({
            content: typeof msg.content === "string" ? msg.content : "",
            role: msg.role,
          }))
      : []

    if (typeof systemPrompt === "string" && systemPrompt.trim() !== "") {
      processedMessages.unshift({ content: systemPrompt, role: "system" })
    }

    if (processedMessages.length === 0 || (processedMessages.length === 1 && processedMessages[0].role === "system")) {
      console.error(`Error in /api/chat (${c.req.path}): Invalid or empty messages array after processing.`)
      return new Response(JSON.stringify({ error: "Invalid or empty messages format" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      })
    }

    const result = streamText({
      messages: processedMessages,
      model: model,
      providerOptions: {
        ...providerOptions,
      },
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error(`Error in /api/chat (${c.req.path}):`, error)
    let errorMessage = "An unknown error occurred"
    const statusCode = 500

    if (error instanceof Error) {
      errorMessage = `Backend Error: ${error.message}`
    } else if (typeof error === "object" && error !== null && "message" in error) {
      errorMessage = `Backend Error: ${error.message}`
    } else {
      errorMessage = `Backend Error: An unexpected error type occurred.`
    }

    return new Response(JSON.stringify({ error: errorMessage }), { status: statusCode })
  }
})

export default app
