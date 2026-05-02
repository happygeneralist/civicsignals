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

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'CivicSignalsBot/0.1',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json'
  }
})

async function loadSources(): Promise<Source[]> {
  const file = await readFile('data/sources.yml', 'utf8')
  return YAML.parse(file) ?? []
}

async function saveSources(sources: Source[]) {
  await writeFile('data/sources.yml', YAML.stringify(sources), 'utf8')
}

function isJsonFeed(source: Source) {
  return source.feedUrl?.endsWith('.json') || source.feedUrl?.includes('/feed.json')
}

async function checkFeed(source: Source) {
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

function normaliseSourceKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\/$/, '')
}

function sourceDedupeKeys(source: Source) {
  const keys = [`id:${normaliseSourceKey(source.id)}`]

  if (source.feedUrl) {
    keys.push(`feed:${normaliseSourceKey(source.feedUrl)}`)
  }

  if (source.apiPath) {
    keys.push(`api:${normaliseSourceKey(source.apiPath)}`)
  }

  return keys
}

function dedupeSources(sources: Source[]) {
  const seen = new Set<string>()
  const deduped: Source[] = []
  const duplicates: Array<{ source: Source; matchedKey: string }> = []

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

async function main() {
  const sources = await loadSources()
  const { deduped, duplicates } = dedupeSources(sources)

  const passed: Array<{ id: string; name: string; reason: string }> = []
  const failed: Array<{ id: string; name: string; reason: string }> = []
  const skipped: Array<{ id: string; name: string; reason: string }> = []

  for (const source of deduped) {
    if (source.status === 'paused') {
      skipped.push({
        id: source.id,
        name: source.name,
        reason: 'Paused'
      })
      continue
    }

    if (source.apiPath && !source.feedUrl) {
      skipped.push({
        id: source.id,
        name: source.name,
        reason: 'GOV.UK Content API source, not RSS/Atom'
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

  await saveSources(deduped)

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
