import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { csrf } from "hono/csrf"
import { renderToString } from "react-dom/server"
import { v4 as uuidv4 } from "uuid"
import { z } from "zod"
import { env } from "hono/adapter"
import { CoreMessage, JSONValue, LanguageModel, streamText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

type Bindings = {
  KV: KVNamespace
  GEMINI_API_KEY: string
  GEMINI_MODEL?: string
  GOOGLE_AI_GATEWAY_URL?: string
  OPENAI_API_KEY: string
  OPENAI_MODEL?: string
  OPENAI_AI_GATEWAY_URL?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.get("/", (c) => {
  const queryDeckName = c.req.query("deckName")
  const deckName = queryDeckName != null && queryDeckName !== "" ? ` - ${decodeURIComponent(queryDeckName)}` : ""

  return c.html(
    renderToString(
      <html lang="ja">
        <head>
          <title>初動率計算機</title>
          <meta charSet="utf-8" />
          <meta content="width=device-width, initial-scale=1" name="viewport" />
          <meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" name="viewport" />

          <meta content={`初動率計算機${deckName}`} property="og:title" />
          <meta content="website" property="og:type" />
          <meta content="ja_JP" property="og:locale" />
          <meta content={`初動率計算機${deckName}`} property="twitter:title" />

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

  if (storedUrlString == null) {
    return c.redirect("/")
  }

  try {
    const requestUrl = new URL(c.req.url)
    const modeParam = requestUrl.searchParams.get("mode")

    const redirectUrl = new URL(storedUrlString)

    if (modeParam !== null) {
      redirectUrl.searchParams.set("mode", modeParam)
    }

    return c.redirect(redirectUrl.toString())
  } catch (e) {
    console.error("Invalid URL stored in KV:", storedUrlString, e)
    return c.redirect("/")
  }
})

const schema = z.object({
  url: z.string().url(),
})
const validator = zValidator("form", schema)

const createKey = async (kv: KVNamespace, url: string) => {
  const uuid = uuidv4()
  const key = uuid.substring(0, 8)
  const result = await kv.get(key)

  if (result == null) {
    await kv.put(key, url)
  } else {
    return await createKey(kv, url)
  }
  return key
}

app.post("/api/shorten_url/create", csrf(), validator, async (c) => {
  const { url } = c.req.valid("form")
  const key = await createKey(c.env.KV, url)
  const shortenUrl = new URL(`/short_url/${key}`, c.req.url)

  try {
    const originalUrl = new URL(url);
    const modeParam = originalUrl.searchParams.get("mode");

    if (modeParam !== null) {
      shortenUrl.searchParams.set("mode", modeParam);
    }
  } catch (e) {
    console.error("Invalid original URL format:", url, e);
  }

  return c.json({ shortenUrl: shortenUrl.toString() })
})

app.post("/api/chat", async (c) => {
  try {
    const {
      GEMINI_API_KEY,
      GEMINI_MODEL,
      GOOGLE_AI_GATEWAY_URL,
      OPENAI_API_KEY,
      OPENAI_MODEL,
      OPENAI_AI_GATEWAY_URL,
    } = env(c)

    const { messages, provider, thinkingBudget, systemPrompt }: {
      messages: CoreMessage[];
      provider: "google" | "openai";
      thinkingBudget?: number;
      systemPrompt?: string;
    } = await c.req.json()

    if (!provider) {
      return new Response(JSON.stringify({ error: "AI_PROVIDER environment variable is not set or invalid. Please set it to 'google' or 'openai'." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    let baseURL: string | undefined
    let apiKey: string | undefined
    let modelNameFromEnv: string | undefined
    let clientFactory: typeof createOpenAI | typeof createGoogleGenerativeAI
    let defaultModel: string
    let providerOptions: Record<string, Record<string, JSONValue>> = {}

    if (provider === "google") {
      baseURL = GOOGLE_AI_GATEWAY_URL
      apiKey = GEMINI_API_KEY
      modelNameFromEnv = GEMINI_MODEL
      clientFactory = createGoogleGenerativeAI
      defaultModel = "gemini-2.5-flash-preview-04-17"
      const validThinkingBudget = typeof thinkingBudget === 'number' && [0, 1024, 8192].includes(thinkingBudget) ? thinkingBudget : 0;
      providerOptions = {
        google: {
          thinkingConfig: {
            thinkingBudget: validThinkingBudget,
          },
        },
      }
      if (baseURL == null) {
        return new Response(JSON.stringify({ error: "GOOGLE_AI_GATEWAY_URL is not set, but provider in request is 'google'." }), { status: 500 })
      }
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not set, but provider in request is 'google'." }), { status: 500 })
      }
    } else if (provider === "openai") {
      baseURL = OPENAI_AI_GATEWAY_URL
      apiKey = OPENAI_API_KEY
      modelNameFromEnv = OPENAI_MODEL
      clientFactory = createOpenAI
      defaultModel = "gpt-4.1-mini-2025-04-14"
      providerOptions = {
        openai: {
          // Add OpenAI specific options if needed
        },
      }
      if (baseURL == null) {
        return new Response(JSON.stringify({ error: "OPENAI_AI_GATEWAY_URL is not set, but provider in request is 'openai'." }), { status: 500 })
      }
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not set, but provider in request is 'openai'." }), { status: 500 })
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid AI_PROVIDER value."}), { status: 500 })
    }

    if (!apiKey || !baseURL) {
      console.error("API Key or Base URL is missing unexpectedly.")
      return new Response(JSON.stringify({ error: "Internal configuration error."}), { status: 500 })
    }

    const modelName = typeof modelNameFromEnv === "string" && modelNameFromEnv.trim() !== "" ? modelNameFromEnv : defaultModel

    const client = clientFactory({
      apiKey: apiKey,
      baseURL: baseURL,
    })

    const model: LanguageModel = client(modelName)

    const processedMessages: CoreMessage[] = Array.isArray(messages)
      ? messages
          .filter((msg) => msg.role === "user" || msg.role === "assistant")
          .map((msg) => ({
            role: msg.role,
            content: typeof msg.content === "string" ? msg.content : "",
          }))
      : []

    if (typeof systemPrompt === 'string' && systemPrompt.trim() !== '') {
      processedMessages.unshift({ role: 'system', content: systemPrompt });
    }

    if (processedMessages.length === 0 || (processedMessages.length === 1 && processedMessages[0].role === 'system')) {
      console.error("Invalid or empty messages array after processing.")
      return new Response(JSON.stringify({ error: "Invalid or empty messages format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const result = streamText({
      model: model,
      messages: processedMessages,
      providerOptions: {
        ...providerOptions,
      },
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error("Error in /api/chat:", error)
    let errorMessage = "An unknown error occurred"
    const statusCode = 500

    if (error instanceof Error) {
      errorMessage = `Backend Error: ${error.message}`
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      errorMessage = `Backend Error: ${error.message}`;
    } else {
      errorMessage = `Backend Error: An unexpected error type occurred.`
    }

    return new Response(JSON.stringify({ error: errorMessage }), { status: statusCode })
  }
})

export default app