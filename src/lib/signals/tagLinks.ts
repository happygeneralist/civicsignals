import type { CivicLink, FeedItem, TopicRule } from './types'

function normaliseText(value: string): string {
  return value.toLowerCase()
}

function getSearchText(link: CivicLink): string {
  return normaliseText([
    link.title,
    link.description ?? '',
    link.url
  ].join(' '))
}

function tagToTopic(tag: string): string | null {
  const tagMap: Record<string, string> = {
    ai: 'AI and automation',
    accessibility: 'Accessibility',
    'content-design': 'Content design',
    data: 'Data',
    governance: 'Governance',
    'local-government': 'Local government',
    policy: 'Policy',
    procurement: 'Procurement',
    research: 'Research',
    security: 'Security',
    'service-design': 'Service design',
    standards: 'Standards',
    transformation: 'Transformation',
    'digital-transformation': 'Transformation',
    capability: 'Workforce and capability'
  }

  return tagMap[tag.toLowerCase()] ?? null
}

export function itemToCivicLink(item: FeedItem): CivicLink {
  const topics = (item.tags ?? [])
    .map(tagToTopic)
    .filter((topic): topic is string => topic !== null)

  return {
    id: item.id,
    title: item.title,
    url: item.url,
    source: item.sourceName,
    published_at: item.publishedAt ?? item.discoveredAt,
    source_type: item.tags?.includes('weeknotes') ? 'weeknote' : undefined,
    description: item.summary,
    topics: Array.from(new Set(topics))
  }
}

export function tagLinks(
  links: CivicLink[],
  topicRules: TopicRule[]
): CivicLink[] {
  return links.map((link) => {
    const topics = new Set(link.topics ?? [])
    const searchText = getSearchText(link)

    for (const rule of topicRules) {
      const matched = rule.keywords.some((keyword) =>
        searchText.includes(keyword.toLowerCase())
      )

      if (matched) {
        topics.add(rule.topic)
      }
    }

    return {
      ...link,
      topics: Array.from(topics)
    }
  })
}
