import { Hono } from "hono"
import { renderToString } from "react-dom/server"

const app = new Hono()

app.get("*", (c) => {
  return c.html(
    renderToString(
      <html lang="ja">
        <head>
          <title>初動率計算機</title>
          <meta charSet="utf-8" />
          <meta content="width=device-width, initial-scale=1" name="viewport" />
          <meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" name="viewport" />
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

export default app
