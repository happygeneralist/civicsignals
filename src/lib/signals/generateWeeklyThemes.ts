import type { CivicLink, SignalLink, WeeklyTheme, WeeklyThemesOutput } from './types'

type GenerateOptions = {
  periodDays?: number
  now?: Date
}

const DEFAULT_OPTIONS = {
  periodDays: 7
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

function getRecentLinks(links: CivicLink[], periodStart: string, periodEnd: string): CivicLink[] {
  return links.filter((link) => {
    const publishedAt = getDateOnly(link.published_at)

    return publishedAt >= periodStart && publishedAt <= periodEnd
  })
}

function countSources(links: CivicLink[]): number {
  return new Set(links.map((link) => link.source)).size
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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function toSignalLink(link: CivicLink): SignalLink {
  return {
    id: link.id,
    title: link.title,
    url: link.url,
    source: link.source,
    published_at: getDateOnly(link.published_at),
    source_type: link.source_type
  }
}

export function generateWeeklyThemes(
  links: CivicLink[],
  options: GenerateOptions = {}
): WeeklyThemesOutput {
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

  const themes: WeeklyTheme[] = Array.from(linksByTopic.entries())
    .map(([topic, topicLinks]) => {
      const uniqueLinks = Array.from(
        new Map(topicLinks.map((link) => [link.id, link])).values()
      ).sort((a, b) => b.published_at.localeCompare(a.published_at))

      return {
        id: slugify(topic),
        topic,
        link_count: uniqueLinks.length,
        source_count: countSources(uniqueLinks),
        top_activity_types: getTopValues(uniqueLinks.flatMap((link) => link.activity_types ?? []), 4),
        top_contexts: getTopValues(uniqueLinks.flatMap((link) => link.contexts ?? []), 4),
        links: uniqueLinks.map(toSignalLink)
      }
    })
    .filter((theme) => theme.link_count > 0)
    .sort((a, b) => b.link_count - a.link_count || a.topic.localeCompare(b.topic))

  return {
    period_start: periodStart,
    period_end: periodEnd,
    generated_at: now.toISOString(),
    themes
  }
}
