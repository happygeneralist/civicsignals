export type FeedItem = {
  id: string
  sourceId: string
  sourceName: string
  title: string
  url: string
  summary?: string
  publishedAt?: string
  discoveredAt: string
  tags?: string[]
}

export type CivicLink = {
  id: string
  title: string
  url: string
  source: string
  published_at: string
  source_type?: string
  description?: string
  topics?: string[]
  activity_types?: string[]
  contexts?: string[]
}

export type ClassificationRule = {
  label: string
  keywords: string[]
}

export type TopicRule = {
  topic: string
  keywords: string[]
}

export type SignalLink = {
  id: string
  title: string
  url: string
  source: string
  published_at: string
  source_type?: string
}

export type Signal = {
  id: string
  title: string
  summary: string
  primary_topic: string
  related_topics: string[]
  top_activity_types: string[]
  top_contexts: string[]
  link_count: number
  source_count: number
  organisation_count: number
  links: SignalLink[]
}

export type SignalsOutput = {
  period_start: string
  period_end: string
  generated_at: string
  provider: 'rules' | 'gemini' | 'rules_fallback'
  signals: Signal[]
}

export type WeeklyTheme = {
  id: string
  topic: string
  link_count: number
  source_count: number
  top_activity_types: string[]
  top_contexts: string[]
  links: SignalLink[]
}

export type WeeklyThemesOutput = {
  period_start: string
  period_end: string
  generated_at: string
  themes: WeeklyTheme[]
}
