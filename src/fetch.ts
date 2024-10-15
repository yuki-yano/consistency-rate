export const fetchShortUrl = async (url: string) => {
  const response = await fetch("/api/shorten_url/create", {
    body: `url=${encodeURIComponent(url)}`,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    method: "POST",
  })

  const json = (await response.json()) as { shortenUrl: string }

  return json.shortenUrl
}
