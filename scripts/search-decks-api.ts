#!/usr/bin/env tsx

/**
 * Cloudflare API を直接使用してデッキを検索・抽出する高速版スクリプト
 *
 * Usage:
 * 1. Cloudflare API Token を取得 (Workers KV:Read権限が必要)
 * 2. CLOUDFLARE_API_TOKEN=your_token pnpm tsx scripts/extract-malice-decks-api.ts [検索パターン]
 *
 * Examples:
 *   pnpm tsx scripts/extract-malice-decks-api.ts "M∀LICE"  # M∀LICEデッキを検索
 *   pnpm tsx scripts/extract-malice-decks-api.ts "ブルーアイズ"  # ブルーアイズデッキを検索
 *   pnpm tsx scripts/extract-malice-decks-api.ts  # 全デッキ一覧を取得
 */

import { writeFile } from 'fs/promises'

const KV_NAMESPACE_ID = '66333de5f3804dba88295ff619529d99'
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '' // アカウントIDが必要
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || ''

interface DeckInfo {
  key: string
  url: string
  deckName: string
  fullUrl: string
}

async function fetchAllKeys(): Promise<string[]> {
  if (!API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN環境変数が設定されていません')
  }

  const allKeys: string[] = []
  let cursor: string | undefined

  console.log('Cloudflare APIからキーを取得中...')

  do {
    const url = new URL(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/keys`
    )

    url.searchParams.set('limit', '1000')
    if (cursor) {
      url.searchParams.set('cursor', cursor)
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API エラー: ${response.status} ${errorText}`)
    }

    const data = await response.json() as {
      result: Array<{ name: string }>
      result_info: { cursor?: string }
    }

    allKeys.push(...data.result.map(k => k.name))
    cursor = data.result_info.cursor

    console.log(`  ${allKeys.length} 個のキーを取得済み...`)
  } while (cursor)

  return allKeys
}

async function fetchKVValue(key: string): Promise<string | null> {
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${key}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5秒タイムアウト

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
      },
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return null
    }

    return await response.text()
  } catch (error) {
    return null
  }
}

async function fetchKVBulk(keys: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>()

  // 並列でフェッチ（最大50並列）
  const BATCH_SIZE = 50

  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE)
    const promises = batch.map(async (key) => {
      const value = await fetchKVValue(key)
      if (value) {
        results.set(key, value)
      }
    })

    await Promise.all(promises)

    if ((i + BATCH_SIZE) % 100 === 0 || i + BATCH_SIZE >= keys.length) {
      console.log(`  ${Math.min(i + BATCH_SIZE, keys.length)} / ${keys.length} キー処理済み...`)
    }
  }

  return results
}

async function extractDeckName(url: string): Promise<string | null> {
  try {
    const urlObj = new URL(url)
    const params = new URLSearchParams(urlObj.search)

    // deckNameパラメータを優先的にチェック（多重エンコード対応）
    const deckNameParam = params.get('deckName')
    if (deckNameParam) {
      let decoded = deckNameParam
      let prevDecoded = ''
      let count = 0

      // 多重エンコードを解決（最大5回）
      while (decoded !== prevDecoded && count < 5) {
        prevDecoded = decoded
        decoded = decodeURIComponent(decoded)
        count++
      }

      return decoded
    }

    // stateパラメータをチェック
    const stateParam = params.get('state')
    if (!stateParam) return null

    const decodedState = Buffer.from(stateParam, 'base64').toString('utf-8')
    const stateObj = JSON.parse(decodedState)

    // stateのdeckNameもデコードが必要な場合がある
    if (stateObj.deckName) {
      let decoded = stateObj.deckName
      let prevDecoded = ''
      let count = 0

      while (decoded !== prevDecoded && count < 5) {
        prevDecoded = decoded
        try {
          decoded = decodeURIComponent(decoded)
        } catch {
          break // デコードエラーの場合は終了
        }
        count++
      }

      return decoded
    }

    return null
  } catch (error) {
    return null
  }
}

async function main() {
  // コマンドライン引数から検索パターンを取得
  const searchPattern = process.argv[2] || ''
  const isSearchMode = searchPattern.length > 0

  if (isSearchMode) {
    console.log(`=== デッキ検索スクリプト（API高速版）開始 ===`)
    console.log(`検索パターン: "${searchPattern}"\n`)
  } else {
    console.log('=== 全デッキ抽出スクリプト（API高速版）開始 ===\n')
  }

  // アカウントIDの取得（設定されていない場合はwranglerから取得を試みる）
  if (!ACCOUNT_ID) {
    console.log('アカウントIDを取得中...')
    const { exec } = require('child_process')
    const { promisify } = require('util')
    const execAsync = promisify(exec)

    try {
      const { stdout } = await execAsync('pnpm wrangler whoami 2>/dev/null')
      const match = stdout.match(/Account ID:\s+([a-f0-9]{32})/)
      if (match) {
        process.env.CLOUDFLARE_ACCOUNT_ID = match[1]
        console.log(`アカウントID取得成功: ${match[1]}\n`)
      } else {
        throw new Error('アカウントIDが見つかりません')
      }
    } catch (error) {
      console.error('エラー: CLOUDFLARE_ACCOUNT_ID環境変数を設定してください')
      process.exit(1)
    }
  }

  // 1. すべてのキーを取得
  const startTime = Date.now()
  const keys = await fetchAllKeys()
  console.log(`\n合計 ${keys.length} 個のキーが見つかりました\n`)

  // 2. チャット履歴以外のキーをフィルタ
  const targetKeys = keys.filter(key => !key.startsWith('chat_history_'))
  console.log(`${targetKeys.length} 個のキーをチェック対象として処理開始...\n`)

  // 3. 値を一括取得
  const kvData = await fetchKVBulk(targetKeys)
  console.log(`\n${kvData.size} 個の有効なエントリを取得\n`)

  // 4. デッキを抽出
  const matchedDecks: DeckInfo[] = []

  console.log(isSearchMode ? `"${searchPattern}"を含むデッキを検索中...` : '全デッキを抽出中...')

  for (const [key, value] of kvData) {
    const deckName = await extractDeckName(value)
    if (!deckName) continue

    const decodedName = decodeURIComponent(deckName)

    // 検索モードの場合は検索パターンでフィルタ、そうでなければ全て取得
    const isMatch = !isSearchMode ||
      decodedName.toLowerCase().includes(searchPattern.toLowerCase()) ||
      deckName.toLowerCase().includes(searchPattern.toLowerCase())

    if (isMatch) {
      const shortUrl = `https://consistency-rate.pages.dev/short_url/${key}`
      matchedDecks.push({
        key,
        url: value,
        deckName: decodedName,
        fullUrl: shortUrl
      })
      if (isSearchMode) {
        console.log(`  ✓ マッチ: ${decodedName}`)
      }
    }
  }

  if (!isSearchMode && matchedDecks.length > 0) {
    console.log(`  ✓ ${matchedDecks.length} 個のデッキを取得`)
  }

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n処理完了: ${elapsedTime} 秒で完了`)
  console.log(`\n=== 結果 ===`)
  if (isSearchMode) {
    console.log(`"${searchPattern}"にマッチしたデッキ数: ${matchedDecks.length}\n`)
  } else {
    console.log(`総デッキ数: ${matchedDecks.length}\n`)
  }

  // 5. URL長でソート（長い順）して表示
  const sortedDecks = matchedDecks.sort((a, b) => b.url.length - a.url.length)

  sortedDecks.forEach((deck, index) => {
    console.log(`${index + 1}. デッキ名: ${deck.deckName}`)
    console.log(`   URL長: ${deck.url.length} 文字`)
    console.log(`   短縮URL: ${deck.fullUrl}`)
    console.log(`   元URL: ${deck.url.substring(0, 100)}...`)
    console.log()
  })

  // 6. 結果をファイルに保存（ソート済み）
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filePrefix = isSearchMode
    ? searchPattern.toLowerCase().replace(/[^a-z0-9]/gi, '-').substring(0, 30)
    : 'all-decks'
  const outputFile = `${filePrefix}-${timestamp}.json`

  await writeFile(outputFile, JSON.stringify(sortedDecks, null, 2))
  console.log(`\n結果をファイルに保存しました: ${outputFile}`)
}

main().catch(error => {
  console.error('エラーが発生しました:', error)
  process.exit(1)
})