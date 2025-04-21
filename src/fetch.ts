import type { Message } from "@ai-sdk/react";

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

type SaveHistorySuccessResponse = {
  key: string;
}

type SaveHistoryErrorResponse = {
  error: string;
}

type RestoreHistorySuccessResponse = {
  messages: Message[];
}

type RestoreHistoryErrorResponse = {
  error: string;
}

export const saveChatHistory = async (messages: Message[]): Promise<string> => {
  const response = await fetch('/api/chat/history', {
    body: JSON.stringify({ messages }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json() as SaveHistoryErrorResponse;
      if (typeof errorData === 'object' && errorData !== null && typeof errorData.error === 'string') {
        errorMessage = errorData.error;
      }
    } catch {
      console.error("Failed to parse response from /api/chat/history:", response);
    }
    throw new Error(errorMessage);
  }

  const data = await response.json() as SaveHistorySuccessResponse;
  if (typeof data === 'object' && data !== null && typeof data.key === 'string' && data.key.trim() !== '') {
    return data.key;
  } else {
    console.error("Invalid response format from /api/chat/history:", data);
    throw new Error("サーバーから有効なキーが返されませんでした。");
  }
};

export const restoreChatHistory = async (historyId: string): Promise<Message[]> => {
  const response = await fetch(`/api/chat/history/${historyId}`);

  if (!response.ok) {
      let errorMessage = `復元エラー (${response.status}): ${response.statusText}`;
      try {
          const errorData = await response.json() as RestoreHistoryErrorResponse;
          if (errorData?.error) {
              errorMessage = errorData.error;
          }
      } catch {
          console.error("Failed to parse response from /api/chat/history/KEY:", response);
      }
      throw new Error(errorMessage);
  }

  const data = await response.json() as RestoreHistorySuccessResponse;

  if (data?.messages != null && Array.isArray(data.messages)) {
    return data.messages;
  } else {
    console.error("Invalid response format from /api/chat/history/KEY:", data);
    throw new Error("サーバーから無効な履歴データ形式が返されました。");
  }
};
