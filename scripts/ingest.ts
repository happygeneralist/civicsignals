import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import YAML from 'yaml'
import { z } from 'zod'
import Parser from 'rss-parser'

const parser = new Parser()

const SourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  feedUrl: z.string().url(),
  status: z.enum(['active', 'paused', 'needs-review']),
  organisation: z.string().optional(),
  tags: z.array(z.string()).optional()
})

const FeedItemSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  sourceName: z.string(),
  title: z.string(),
  url: z.string().url(),
  summary: z.string().optional(),
  publishedAt: z.string().optional(),
  discoveredAt: z.string(),
  tags: z.array(z.string()).optional()
})

type Source = z.infer<typeof SourceSchema>
type FeedItem = z.infer<typeof FeedItemSchema>

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function cleanUrl(value: string): string {
  const url = new URL(value)

  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('utm_') || key === 'fbclid' || key === 'gclid') {
      url.searchParams.delete(key)
    }
  }

  url.hash = ''

  return url.toString()
}

async function loadSources(): Promise<Source[]> {
  const file = await readFile('data/sources.yml', 'utf8')
  const parsed = YAML.parse(file)

  return z.array(SourceSchema).parse(parsed)
}

async function loadExistingItems(): Promise<FeedItem[]> {
  try {
    const file = await readFile('src/data/items.json', 'utf8')
    const parsed = JSON.parse(file)

    return z.array(FeedItemSchema).parse(parsed)
  } catch {
    return []
  }
}

async function fetchFeed(source: Source): Promise<FeedItem[]> {
  const response = await fetch(source.feedUrl, {
    headers: {
      'User-Agent': 'CivicSignalsBot/0.1',
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml'
    }
  })

  if (!response.ok) {
    throw new Error(`${source.name} returned ${response.status}`)
  }

  const xml = await response.text()
  const feed = await parser.parseString(xml)

  return feed.items
    .map((item): FeedItem | null => {
      const rawUrl = item.link ?? item.guid

      if (!item.title || !rawUrl) {
        return null
      }

      const url = cleanUrl(rawUrl)

      const publishedAt = item.pubDate
        ? new Date(item.pubDate).toISOString()
        : item.isoDate
          ? new Date(item.isoDate).toISOString()
          : undefined

      const id = hash(`${source.id}|${url}|${item.title}|${publishedAt ?? ''}`)

      return FeedItemSchema.parse({
        id,
        sourceId: source.id,
        sourceName: source.name,
        title: item.title.trim(),
        url,
        summary: item.contentSnippet ?? item.content,
        publishedAt,
        discoveredAt: new Date().toISOString(),
        tags: source.tags ?? []
      })
    })
    .filter((item): item is FeedItem => item !== null)
}

function dedupe(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>()

  return items.filter((item) => {
    if (seen.has(item.url)) {
      return false
    }

    seen.add(item.url)

    return true
  })
}

async function main() {
  const sources = await loadSources()
  const existingItems = await loadExistingItems()

  const fetchedItems: FeedItem[] = []
  const errors: Array<{ sourceId: string; message: string }> = []

  for (const source of sources) {
    if (source.status !== 'active') {
      continue
    }

    try {
      const items = await fetchFeed(source)
      fetchedItems.push(...items)
    } catch (error) {
      errors.push({
        sourceId: source.id,
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  const items = dedupe([...fetchedItems, ...existingItems])
    .sort((a, b) => {
      const aDate = a.publishedAt ?? a.discoveredAt
      const bDate = b.publishedAt ?? b.discoveredAt

      return bDate.localeCompare(aDate)
    })
    .slice(0, 1000)

  await writeFile(
    'src/data/items.json',
    JSON.stringify(items, null, 2) + '\n'
  )

  await writeFile(
    'src/data/status.json',
    JSON.stringify({
      checkedAt: new Date().toISOString(),
      sourcesChecked: sources.length,
      activeSourcesChecked: sources.filter((source) => source.status === 'active').length,
      itemsFetched: fetchedItems.length,
      itemsStored: items.length,
      errors
    }, null, 2) + '\n'
  )

  console.log(`Fetched ${fetchedItems.length} items`)
  console.log(`Stored ${items.length} items`)

  if (errors.length > 0) {
    console.warn('Some sources failed')
    console.warn(errors)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
