import type { CivicLink, ClassificationRule, FeedItem, TopicRule } from './types'

function normaliseText(value: string): string {
  return value.toLowerCase()
}

function getSearchText(link: CivicLink): string {
  return normaliseText([
    link.title,
    link.description ?? '',
    link.source,
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

function tagToContext(tag: string): string | null {
  const tagMap: Record<string, string> = {
    'central-government': 'Central government',
    govuk: 'Central government',
    'local-government': 'Local government',
    consultancy: 'Supplier market',
    supplier: 'Supplier market',
    vendor: 'Supplier market',
    'public-sector-reform': 'Public service reform',
    practitioners: 'Professional practice',
    'personal-blog': 'Professional practice',
    weeknotes: 'Professional practice'
  }

  return tagMap[tag.toLowerCase()] ?? null
}

function tagToActivityType(tag: string): string | null {
  const tagMap: Record<string, string> = {
    policy: 'Policy or strategy',
    governance: 'Governance or assurance',
    reports: 'Research or evidence',
    research: 'Research or evidence',
    weeknotes: 'Community discussion',
    practitioners: 'Community discussion'
  }

  return tagMap[tag.toLowerCase()] ?? null
}

function classifyByRules(searchText: string, rules: ClassificationRule[]): string[] {
  return rules
    .filter((rule) => rule.keywords.some((keyword) => searchText.includes(keyword.toLowerCase())))
    .map((rule) => rule.label)
}

export function itemToCivicLink(item: FeedItem): CivicLink {
  const topics = (item.tags ?? [])
    .map(tagToTopic)
    .filter((topic): topic is string => topic !== null)

  const contexts = (item.tags ?? [])
    .map(tagToContext)
    .filter((context): context is string => context !== null)

  const activityTypes = (item.tags ?? [])
    .map(tagToActivityType)
    .filter((activityType): activityType is string => activityType !== null)

  return {
    id: item.id,
    title: item.title,
    url: item.url,
    source: item.sourceName,
    published_at: item.publishedAt ?? item.discoveredAt,
    source_type: item.tags?.includes('weeknotes') ? 'weeknote' : undefined,
    description: item.summary,
    topics: Array.from(new Set(topics)),
    activity_types: Array.from(new Set(activityTypes)),
    contexts: Array.from(new Set(contexts))
  }
}

export function tagLinks(
  links: CivicLink[],
  topicRules: TopicRule[],
  activityRules: ClassificationRule[] = [],
  contextRules: ClassificationRule[] = []
): CivicLink[] {
  return links.map((link) => {
    const topics = new Set(link.topics ?? [])
    const activityTypes = new Set(link.activity_types ?? [])
    const contexts = new Set(link.contexts ?? [])
    const searchText = getSearchText(link)

    for (const rule of topicRules) {
      const matched = rule.keywords.some((keyword) =>
        searchText.includes(keyword.toLowerCase())
      )

      if (matched) {
        topics.add(rule.topic)
      }
    }

    for (const activityType of classifyByRules(searchText, activityRules)) {
      activityTypes.add(activityType)
    }

    for (const context of classifyByRules(searchText, contextRules)) {
      contexts.add(context)
    }

    return {
      ...link,
      topics: Array.from(topics),
      activity_types: Array.from(activityTypes),
      contexts: Array.from(contexts)
    }
  })
}
