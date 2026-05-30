import type { CivicLink, Signal, SignalsOutput } from './types'

type GenerateOptions = {
  periodDays?: number
  minimumLinksPerSignal?: number
  minimumSourcesPerSignal?: number
  maximumSignals?: number
  now?: Date
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

function getRelatedTopics(primaryTopic: string, links: CivicLink[]): string[] {
  const counts = new Map<string, number>()

  for (const link of links) {
    for (const topic of link.topics ?? []) {
      if (topic === primaryTopic) continue

      counts.set(topic, (counts.get(topic) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([topic]) => topic)
}

function createTitle(primaryTopic: string, relatedTopics: string[]): string {
  const topRelatedTopic = relatedTopics[0]

  if (topRelatedTopic) {
    return `${primaryTopic} is showing up around ${topRelatedTopic}`
  }

  return `More links this week about ${primaryTopic}`
}

function getPrimaryPairKey(primaryTopic: string, relatedTopics: string[]): string | null {
  const topRelatedTopic = relatedTopics[0]

  if (!topRelatedTopic) {
    return null
  }

  return [primaryTopic, topRelatedTopic]
    .sort((a, b) => a.localeCompare(b))
    .join('|')
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
    .map(([primaryTopic, topicLinks]) => {
      const uniqueLinks = Array.from(
        new Map(topicLinks.map((link) => [link.id, link])).values()
      )
      const sourceCount = countSources(uniqueLinks)
      const relatedTopics = getRelatedTopics(primaryTopic, uniqueLinks)

      return {
        primaryTopic,
        links: uniqueLinks,
        sourceCount,
        relatedTopics,
        pairKey: getPrimaryPairKey(primaryTopic, relatedTopics),
        score: uniqueLinks.length * 10 + sourceCount + relatedTopics.length
      }
    })
    .filter((candidate) => (
      candidate.links.length >= config.minimumLinksPerSignal &&
      candidate.sourceCount >= config.minimumSourcesPerSignal &&
      candidate.relatedTopics.length > 0
    ))
    .sort((a, b) => b.score - a.score || a.primaryTopic.localeCompare(b.primaryTopic))

  const usedPairKeys = new Set<string>()
  const distinctSignals = candidateSignals.filter((candidate) => {
    if (!candidate.pairKey) {
      return true
    }

    if (usedPairKeys.has(candidate.pairKey)) {
      return false
    }

    usedPairKeys.add(candidate.pairKey)
    return true
  }).slice(0, config.maximumSignals)

  const signals: Signal[] = distinctSignals.map((candidate, index) => ({
    id: createSignalId(index),
    title: createTitle(candidate.primaryTopic, candidate.relatedTopics),
    primary_topic: candidate.primaryTopic,
    related_topics: candidate.relatedTopics,
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
