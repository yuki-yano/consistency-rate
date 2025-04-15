import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { csrf } from "hono/csrf"
import { renderToString } from "react-dom/server"
import { v4 as uuidv4 } from "uuid"
import { z } from "zod"
import { env } from "hono/adapter"
import { CoreMessage, streamText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

type Bindings = {
  KV: KVNamespace
  OPENAI_API_KEY: string
  OPENAI_MODEL?: string
  AI_GATEWAY_URL?: string
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
    const redirectUrl = new URL(storedUrlString)

    redirectUrl.search = requestUrl.search

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
    const { OPENAI_API_KEY, OPENAI_MODEL, AI_GATEWAY_URL } = env(c)

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OpenAI API Key is not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (AI_GATEWAY_URL == null) {
      return new Response(JSON.stringify({ error: "AI Gateway URL is not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { messages }: { messages: CoreMessage[] } = await c.req.json()

    const filteredMessages: CoreMessage[] = Array.isArray(messages)
      ? messages
          .filter((msg) => msg.role === "user" || msg.role === "assistant" || msg.role === "system")
          .map((msg) => ({
            role: msg.role,
            content: typeof msg.content === "string" ? msg.content : "",
          }))
      : []

    if (filteredMessages.length === 0) {
      console.error("Invalid or empty messages array after filtering.")
      return new Response(JSON.stringify({ error: "Invalid or empty messages format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    let modelName = "gpt-4.1-mini"
    if (typeof OPENAI_MODEL === "string" && OPENAI_MODEL.trim() !== "") {
      modelName = OPENAI_MODEL
    }

    const openai = createOpenAI({
      apiKey: OPENAI_API_KEY,
      baseURL: AI_GATEWAY_URL,
    })

    const model = openai(modelName)

    const result = streamText({
      model: model,
      messages: filteredMessages,
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error("Error in /api/chat:", error) // エラーログは残す
    let errorMessage = "An unknown error occurred"
    const statusCode = 500

    if (error instanceof Error) {
      errorMessage = `Backend Error: ${error.message}`
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    })
  }
})

export default app
