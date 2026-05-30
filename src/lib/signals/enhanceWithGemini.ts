import type { CivicLink, Signal, SignalsOutput } from './types'

const DEFAULT_MODEL = 'gemini-2.5-flash'
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

const ALLOWED_PATTERNS = [
  'Governance and assurance',
  'Policy and strategy',
  'Procurement and supplier activity',
  'Delivery and implementation',
  'Research and evidence',
  'Guidance and standards',
  'Capability and workforce',
  'Community and events',
  'Local adoption',
  'Professional practice'
] as const

const UNSUPPORTED_WORDING = [
  /\btrend\b/i,
  /\btrending\b/i,
  /\bimportant\b/i,
  /\bmajor\b/i,
  /\bproves\b/i,
  /\bconfirms\b/i,
  /\bthe sector is\b/i,
  /\b(?:the|uk|central) government is\b/i,
  /\beveryone\b/i,
  /\bmust\b/i,
  /\brevolution\b/i
]

type GeminiSignal = {
  id: string
  pattern: string
  summary: string
  what_to_notice: string[]
}

type GeminiResponse = {
  signals: GeminiSignal[]
}

type EvidenceLink = {
  title: string
  source: string
  published_at: string
  summary?: string
  topics: string[]
  activity_types: string[]
  contexts: string[]
}

function truncate(value: string | undefined, limit: number): string | undefined {
  if (!value) return undefined

  const trimmed = value.replace(/\s+/g, ' ').trim()

  if (trimmed.length <= limit) {
    return trimmed
  }

  return `${trimmed.slice(0, limit - 1).trim()}…`
}

function createEvidenceLinks(signal: Signal, links: CivicLink[]): EvidenceLink[] {
  const linksById = new Map(links.map((link) => [link.id, link]))

  return signal.links
    .slice(0, 15)
    .map((signalLink) => linksById.get(signalLink.id))
    .filter((link): link is CivicLink => link !== undefined)
    .map((link) => ({
      title: link.title,
      source: link.source,
      published_at: link.published_at.slice(0, 10),
      summary: truncate(link.description, 500),
      topics: link.topics ?? [],
      activity_types: link.activity_types ?? [],
      contexts: link.contexts ?? []
    }))
}

function createPrompt(output: SignalsOutput, links: CivicLink[]): string {
  const input = {
    period_start: output.period_start,
    period_end: output.period_end,
    allowed_patterns: ALLOWED_PATTERNS,
    signals: output.signals.map((signal) => ({
      id: signal.id,
      title: signal.title,
      primary_topic: signal.primary_topic,
      related_topics: signal.related_topics,
      top_activity_types: signal.top_activity_types,
      top_contexts: signal.top_contexts,
      link_count: signal.link_count,
      source_count: signal.source_count,
      supporting_links: createEvidenceLinks(signal, links)
    }))
  }

  return `You are helping generate cautious signal summaries for Civic Signals, a public digital government link aggregator.\n\nUse only the supplied public link metadata.\n\nSignals show recurring themes in recent public links. They are not trends, rankings or judgements of importance.\n\nFor each signal:\n- choose exactly one pattern from the allowed_patterns list\n- write one useful summary in plain British English\n- write up to 3 specific what_to_notice bullets\n- describe what appears in the supporting links, not what government or the sector thinks\n- avoid generic bullets such as "this topic appears across sources"\n- do not say something is a trend\n- do not claim importance\n- do not imply official direction\n- do not use the words: trend, trending, important, major, proves, confirms, everyone, must, revolution\n- keep summaries under 300 characters\n- keep bullets under 160 characters\n\nReturn JSON only in this shape:\n{\n  "signals": [\n    {\n      "id": "signal_001",\n      "pattern": "Governance and assurance",\n      "summary": "...",\n      "what_to_notice": ["...", "...", "..."]\n    }\n  ]\n}\n\nInput:\n${JSON.stringify(input, null, 2)}`
}

function getTextFromGeminiResponse(value: unknown): string {
  const response = value as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>
      }
    }>
  }

  return response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim() ?? ''
}

function parseGeminiJson(text: string): GeminiResponse {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  return JSON.parse(cleaned) as GeminiResponse
}

function containsUnsupportedWording(value: string): boolean {
  return UNSUPPORTED_WORDING.some((pattern) => pattern.test(value))
}

function validateGeminiSignal(signal: GeminiSignal, originalSignalIds: Set<string>): string[] {
  const errors: string[] = []

  if (!originalSignalIds.has(signal.id)) {
    errors.push(`Unknown signal id: ${signal.id}`)
  }

  if (!ALLOWED_PATTERNS.includes(signal.pattern as typeof ALLOWED_PATTERNS[number])) {
    errors.push(`${signal.id} has unsupported pattern: ${signal.pattern}`)
  }

  if (!signal.summary || signal.summary.length > 300) {
    errors.push(`${signal.id} has missing or long summary.`)
  }

  if (containsUnsupportedWording(signal.summary)) {
    errors.push(`${signal.id} summary contains unsupported wording.`)
  }

  if (!Array.isArray(signal.what_to_notice) || signal.what_to_notice.length > 3) {
    errors.push(`${signal.id} has invalid what_to_notice bullets.`)
  }

  for (const bullet of signal.what_to_notice ?? []) {
    if (!bullet || bullet.length > 160) {
      errors.push(`${signal.id} has missing or long what_to_notice bullet.`)
    }

    if (containsUnsupportedWording(bullet)) {
      errors.push(`${signal.id} bullet contains unsupported wording.`)
    }
  }

  return errors
}

function mergeEnhancements(output: SignalsOutput, response: GeminiResponse): SignalsOutput {
  const enhancementsById = new Map(response.signals.map((signal) => [signal.id, signal]))

  return {
    ...output,
    provider: 'gemini',
    signals: output.signals.map((signal) => {
      const enhancement = enhancementsById.get(signal.id)

      if (!enhancement) {
        return signal
      }

      return {
        ...signal,
        pattern: enhancement.pattern,
        summary: enhancement.summary,
        what_to_notice: enhancement.what_to_notice,
        evidence_note: `Supported by ${signal.link_count} links from ${signal.source_count} ${signal.source_count === 1 ? 'source' : 'sources'}.`,
        generation_note: 'Enhanced from public link metadata.'
      }
    })
  }
}

export async function enhanceWithGemini(
  output: SignalsOutput,
  links: CivicLink[]
): Promise<SignalsOutput> {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required when SIGNALS_PROVIDER=gemini.')
  }

  if (output.signals.length === 0) {
    return output
  }

  const prompt = createPrompt(output, links)
  const response = await fetch(`${GEMINI_API_BASE_URL}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    })
  })

  if (!response.ok) {
    throw new Error(`Gemini returned ${response.status}`)
  }

  const rawResponse = await response.json()
  const text = getTextFromGeminiResponse(rawResponse)
  const parsed = parseGeminiJson(text)
  const originalSignalIds = new Set(output.signals.map((signal) => signal.id))
  const errors = parsed.signals.flatMap((signal) => validateGeminiSignal(signal, originalSignalIds))

  if (errors.length > 0) {
    throw new Error(`Gemini output failed validation:\n${errors.map((error) => `- ${error}`).join('\n')}`)
  }

  return mergeEnhancements(output, parsed)
}
