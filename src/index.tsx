import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { csrf } from "hono/csrf"
import { renderToString } from "react-dom/server"
import { v4 as uuidv4 } from "uuid"
import { z } from "zod"

type Bindings = {
  KV: KVNamespace
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
            <script src="/client.js" type="module" />
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
  const url = await c.env.KV.get(key)

  if (url == null) {
    return c.redirect("/")
  }

  return c.redirect(url)
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

  return c.json({ shortenUrl: shortenUrl.toString() })
})

export default app
