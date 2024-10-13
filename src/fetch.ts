export const fetchShortUrl = async (url: string) => {
  const response = await fetch("https://ur0.cc/api.php?create=true", {
    body: `url=${encodeURIComponent(url)}`,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    method: "POST",
  })

  const json = (await response.json()) as { shorturl: string }

  return json.shorturl
}
