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
import { createXai } from "@ai-sdk/xai"

type Bindings = {
  KV: KVNamespace
  GEMINI_API_KEY: string
  GEMINI_MODEL?: string
  GOOGLE_AI_GATEWAY_URL?: string
  OPENAI_API_KEY: string
  OPENAI_MODEL?: string
  OPENAI_AI_GATEWAY_URL?: string
  GROK_API_KEY: string
  GROK_MODEL?: string
  GROK_AI_GATEWAY_URL?: string
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
    return key; // Return the key without prefix
  } else {
    // Retry if key collision happens
    return await createKey(kv, value, prefix);
  }
}

app.post("/api/shorten_url/create", csrf(), shortenUrlValidator, async (c) => {
  const { url } = c.req.valid("form")
  const key = await createKey(c.env.KV, url) // No prefix for short URLs
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

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const chatHistorySchema = z.object({
  messages: z.array(chatMessageSchema),
});
const chatHistoryValidator = zValidator("json", chatHistorySchema);

const CHAT_HISTORY_PREFIX = "chat_history_";

const createChatHistoryKey = async (
  kv: KVNamespace,
  messages: CoreMessage[],
) => {
  // Use the generic createKey function with a prefix
  return await createKey(kv, JSON.stringify(messages), CHAT_HISTORY_PREFIX);
};

app.post("/api/chat/history", chatHistoryValidator, async (c) => {
  const { messages } = c.req.valid("json");

  if (messages == null || messages.length === 0) {
    return c.json({ error: "Messages cannot be empty" }, 400);
  }

  try {
    const key = await createChatHistoryKey(c.env.KV, messages);
    return c.json({ key: key });
  } catch (error) {
    console.error("Failed to save chat history:", error);
    return c.json({ error: "Failed to save chat history" }, 500);
  }
});

app.get("/api/chat/history/:key{[0-9a-z]{8}}", async (c) => {
  const key = c.req.param("key");
  const prefixedKey = CHAT_HISTORY_PREFIX + key;

  try {
    const storedHistory = await c.env.KV.get(prefixedKey);

    if (storedHistory === null) {
      return c.json({ error: "Chat history not found" }, 404);
    }

    // Attempt to parse the stored JSON string
    try {
      const messages: CoreMessage[] = JSON.parse(storedHistory);
      // Validate the structure roughly (more robust validation could be added)
      if (
        Array.isArray(messages) &&
        messages.every(
          (msg) =>
            msg !== null &&
            'role' in msg &&
            'content' in msg
        )
      ) {
        return c.json({ messages });
      } else {
        console.error("Invalid chat history format found in KV for key:", prefixedKey);
        return c.json({ error: "Invalid chat history format found" }, 500);
      }
    } catch (parseError) {
      console.error(
        "Failed to parse chat history from KV for key:",
        prefixedKey,
        parseError,
      );
      // Optionally delete the invalid entry
      // await c.env.KV.delete(prefixedKey);
      return c.json({ error: "Failed to parse chat history" }, 500);
    }
  } catch (error) {
    console.error("Failed to retrieve chat history:", error);
    return c.json({ error: "Failed to retrieve chat history" }, 500);
  }
});

app.post("/api/chat", async (c) => {
  try {
    const {
      GEMINI_API_KEY,
      GEMINI_MODEL,
      GOOGLE_AI_GATEWAY_URL,
      OPENAI_API_KEY,
      OPENAI_MODEL,
      OPENAI_AI_GATEWAY_URL,
      GROK_API_KEY,
      GROK_MODEL,
      GROK_AI_GATEWAY_URL,
    } = env(c)

    const { messages, provider, thinkingBudget, systemPrompt }: {
      messages: CoreMessage[];
      provider: "google" | "openai" | "xai";
      thinkingBudget?: number;
      systemPrompt?: string;
    } = await c.req.json()

    if (!provider) {
      return new Response(JSON.stringify({ error: "AI_PROVIDER environment variable is not set or invalid. Please set it to 'google', 'openai', or 'xai'." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    let baseURL: string | undefined
    let apiKey: string | undefined
    let modelNameFromEnv: string | undefined
    let clientFactory: typeof createOpenAI | typeof createGoogleGenerativeAI | typeof createXai
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
    } else if (provider === "xai") {
      apiKey = GROK_API_KEY
      modelNameFromEnv = GROK_MODEL
      clientFactory = createXai
      defaultModel = "grok-3-mini-beta"

      baseURL = GROK_AI_GATEWAY_URL

      // Check if the Grok gateway URL is set
      if (baseURL == null || baseURL.trim() === "") {
        return new Response(JSON.stringify({ error: "GROK_AI_GATEWAY_URL must be set when using xai provider." }), { status: 500 });
      }

      providerOptions = {
        xai: {
          reasoning_effort: "high",
        },
      }
      if (apiKey == null || apiKey === "") {
        return new Response(JSON.stringify({ error: "GROK_API_KEY is not set, but provider in request is 'xai'." }), { status: 500 })
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid AI_PROVIDER value."}), { status: 500 })
    }

    // BaseURL check - already handles null/empty baseURL from provider logic
    if (baseURL == null || baseURL === "") {
      console.error("Base URL is missing unexpectedly.")
      return new Response(JSON.stringify({ error: "Internal configuration error: Missing Base URL."}), { status: 500 })
    }
    if (apiKey == null || apiKey === "") {
      console.error("API Key is missing unexpectedly.")
      return new Response(JSON.stringify({ error: "Internal configuration error: Missing API Key."}), { status: 500 })
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