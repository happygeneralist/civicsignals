import type { CivicLink, Signal, SignalsOutput } from './types'

type GenerateOptions = {
  periodDays?: number
  minimumLinksPerSignal?: number
  minimumSourcesPerSignal?: number
  maximumSignals?: number
  now?: Date
}

type CandidateSignal = {
  primaryTopic: string
  links: CivicLink[]
  sourceCount: number
  relatedTopics: string[]
  topActivityTypes: string[]
  topContexts: string[]
  score: number
}

const DEFAULT_OPTIONS = {
  periodDays: 7,
  minimumLinksPerSignal: 5,
  minimumSourcesPerSignal: 3,
  maximumSignals: 3
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function getDateOnly(value: string): string {
  return value.slice(0, 10)
}

function getRecentLinks(
  links: CivicLink[],
  periodStart: string,
  periodEnd: string
): CivicLink[] {
  return links.filter((link) => {
    const publishedAt = getDateOnly(link.published_at)

    return publishedAt >= periodStart && publishedAt <= periodEnd
  })
}

function countSources(links: CivicLink[]): number {
  return new Set(links.map((link) => link.source)).size
}

function createSignalId(index: number): string {
  return `signal_${String(index + 1).padStart(3, '0')}`
}

function countValues(values: string[]): Map<string, number> {
  const counts = new Map<string, number>()

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return counts
}

function getTopValues(values: string[], limit = 3): string[] {
  return Array.from(countValues(values).entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value)
}

function getRelatedTopics(primaryTopic: string, links: CivicLink[]): string[] {
  return getTopValues(
    links.flatMap((link) => (link.topics ?? []).filter((topic) => topic !== primaryTopic)),
    3
  )
}

function createSummary(candidate: CandidateSignal): string {
  const activityText = candidate.topActivityTypes.length > 0
    ? ` mostly through ${formatList(candidate.topActivityTypes)} activity`
    : ''

  const contextText = candidate.topContexts.length > 0
    ? ` in ${formatList(candidate.topContexts)}`
    : ''

  return `${candidate.primaryTopic} appears across recent links${activityText}${contextText}.`
}

function formatList(values: string[]): string {
  if (values.length === 0) return ''
  if (values.length === 1) return values[0]
  if (values.length === 2) return `${values[0]} and ${values[1]}`

  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`
}

export function generateRulesSignals(
  links: CivicLink[],
  options: GenerateOptions = {}
): SignalsOutput {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options
  }

  const now = config.now ?? new Date()
  const periodEnd = toDateOnly(now)
  const periodStart = toDateOnly(addDays(now, -(config.periodDays - 1)))
  const recentLinks = getRecentLinks(links, periodStart, periodEnd)
  const linksByTopic = new Map<string, CivicLink[]>()

  for (const link of recentLinks) {
    for (const topic of link.topics ?? []) {
      const existing = linksByTopic.get(topic) ?? []
      existing.push(link)
      linksByTopic.set(topic, existing)
    }
  }

  const candidateSignals = Array.from(linksByTopic.entries())
    .map(([primaryTopic, topicLinks]): CandidateSignal => {
      const uniqueLinks = Array.from(
        new Map(topicLinks.map((link) => [link.id, link])).values()
      )
      const sourceCount = countSources(uniqueLinks)
      const relatedTopics = getRelatedTopics(primaryTopic, uniqueLinks)
      const topActivityTypes = getTopValues(uniqueLinks.flatMap((link) => link.activity_types ?? []), 3)
      const topContexts = getTopValues(uniqueLinks.flatMap((link) => link.contexts ?? []), 2)

      return {
        primaryTopic,
        links: uniqueLinks,
        sourceCount,
        relatedTopics,
        topActivityTypes,
        topContexts,
        score: uniqueLinks.length * 10 + sourceCount + topActivityTypes.length + topContexts.length
      }
    })
    .filter((candidate) => (
      candidate.links.length >= config.minimumLinksPerSignal &&
      candidate.sourceCount >= config.minimumSourcesPerSignal &&
      (candidate.topActivityTypes.length > 0 || candidate.topContexts.length > 0)
    ))
    .sort((a, b) => b.score - a.score || a.primaryTopic.localeCompare(b.primaryTopic))
    .slice(0, config.maximumSignals)

  const signals: Signal[] = candidateSignals.map((candidate, index) => ({
    id: createSignalId(index),
    title: candidate.primaryTopic,
    summary: createSummary(candidate),
    primary_topic: candidate.primaryTopic,
    related_topics: candidate.relatedTopics,
    top_activity_types: candidate.topActivityTypes,
    top_contexts: candidate.topContexts,
    link_count: candidate.links.length,
    source_count: candidate.sourceCount,
    organisation_count: candidate.sourceCount,
    links: candidate.links.map((link) => ({
      id: link.id,
      title: link.title,
      url: link.url,
      source: link.source,
      published_at: getDateOnly(link.published_at),
      source_type: link.source_type
    }))
  }))

  return {
    period_start: periodStart,
    period_end: periodEnd,
    generated_at: now.toISOString(),
    provider: 'rules',
    signals
  }
}
