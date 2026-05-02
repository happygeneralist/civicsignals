import { readFile, writeFile } from 'node:fs/promises'
import YAML from 'yaml'
import Parser from 'rss-parser'

type SourceStatus = 'active' | 'paused' | 'needs-review'

type Source = {
  id: string
  name: string
  url: string
  feedUrl?: string
  apiPath?: string
  status: SourceStatus
  organisation?: string
  tags?: string[]
}

type CheckResult = {
  ok: boolean
  reason: string
}

type RemovedDuplicate = {
  source: Source
  matchedKey: string
}

const SOURCES_FILE = 'data/sources.yml'

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'CivicSignalsBot/0.1',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml'
  },
  maxRedirects: 5
})

async function loadSources(): Promise<Source[]> {
  const file = await readFile(SOURCES_FILE, 'utf8')
  const parsed = YAML.parse(file)

  if (!Array.isArray(parsed)) {
    throw new Error(`${SOURCES_FILE} must contain a YAML list of sources`)
  }

  return parsed as Source[]
}

async function saveSources(sources: Source[]) {
  await writeFile(SOURCES_FILE, YAML.stringify(sources), 'utf8')
}

function normaliseKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\/$/, '')
}

function sourceDedupeKeys(source: Source): string[] {
  const keys = [`id:${normaliseKey(source.id)}`]

  if (source.feedUrl) {
    keys.push(`feed:${normaliseKey(source.feedUrl)}`)
  }

  if (source.apiPath) {
    keys.push(`api:${normaliseKey(source.apiPath)}`)
  }

  return keys
}

function dedupeSources(sources: Source[]) {
  const seen = new Set<string>()
  const deduped: Source[] = []
  const duplicates: RemovedDuplicate[] = []

  for (const source of sources) {
    const keys = sourceDedupeKeys(source)
    const matchedKey = keys.find((key) => seen.has(key))

    if (matchedKey) {
      duplicates.push({ source, matchedKey })
      continue
    }

    keys.forEach((key) => seen.add(key))
    deduped.push(source)
  }

  return { deduped, duplicates }
}

function isJsonFeed(source: Source): boolean {
  const feedUrl = source.feedUrl?.toLowerCase() ?? ''

  return (
    feedUrl.endsWith('.json') ||
    feedUrl.includes('/feed.json') ||
    feedUrl.includes('format=json')
  )
}

async function checkFeed(source: Source): Promise<CheckResult> {
  if (!source.feedUrl) {
    return {
      ok: false,
      reason: 'No feedUrl'
    }
  }

  if (isJsonFeed(source)) {
    return {
      ok: false,
      reason: 'JSON Feed is not supported by the current ingester'
    }
  }

  const feed = await parser.parseURL(source.feedUrl)

  if (!feed.items || feed.items.length === 0) {
    return {
      ok: false,
      reason: 'Feed parsed but returned no items'
    }
  }

  return {
    ok: true,
    reason: `${feed.items.length} items`
  }
}

function shouldSkip(source: Source): string | null {
  if (source.status === 'paused') {
    return 'Paused'
  }

  if (source.apiPath && !source.feedUrl) {
    return 'GOV.UK Content API source, not RSS/Atom'
  }

  return null
}

function sortSources(sources: Source[]): Source[] {
  return [...sources].sort((a, b) => {
    const statusOrder: Record<SourceStatus, number> = {
      active: 0,
      'needs-review': 1,
      paused: 2
    }

    const statusDifference = statusOrder[a.status] - statusOrder[b.status]

    if (statusDifference !== 0) {
      return statusDifference
    }

    return a.name.localeCompare(b.name)
  })
}

async function main() {
  const sources = await loadSources()
  const { deduped, duplicates } = dedupeSources(sources)

  const passed: Array<{ id: string; name: string; reason: string }> = []
  const failed: Array<{ id: string; name: string; reason: string }> = []
  const skipped: Array<{ id: string; name: string; reason: string }> = []

  for (const source of deduped) {
    const skipReason = shouldSkip(source)

    if (skipReason) {
      skipped.push({
        id: source.id,
        name: source.name,
        reason: skipReason
      })

      continue
    }

    try {
      const result = await checkFeed(source)

      if (result.ok) {
        source.status = 'active'
        passed.push({
          id: source.id,
          name: source.name,
          reason: result.reason
        })
      } else {
        source.status = 'needs-review'
        failed.push({
          id: source.id,
          name: source.name,
          reason: result.reason
        })
      }
    } catch (error) {
      source.status = 'needs-review'
      failed.push({
        id: source.id,
        name: source.name,
        reason: error instanceof Error ? error.message : String(error)
      })
    }
  }

  const sortedSources = sortSources(deduped)

  await saveSources(sortedSources)

  console.log('\nActive sources')
  console.table(passed)

  console.log('\nNeeds review')
  console.table(failed)

  console.log('\nSkipped')
  console.table(skipped)

  if (duplicates.length > 0) {
    console.log('\nRemoved duplicate sources')
    console.table(
      duplicates.map(({ source, matchedKey }) => ({
        id: source.id,
        name: source.name,
        matchedKey
      }))
    )
  }

  console.log(`\nChecked ${deduped.length} unique sources`)
  console.log(`Activated ${passed.length}`)
  console.log(`Needs review ${failed.length}`)
  console.log(`Skipped ${skipped.length}`)
  console.log(`Removed duplicates ${duplicates.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
