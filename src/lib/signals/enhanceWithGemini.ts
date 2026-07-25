import type {
  CivicLink,
  GeminiFailureCategory,
  Signal,
  SignalGenerationDiagnostics,
  SignalsOutput
} from './types'

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const MAX_ATTEMPTS = 3
const MAX_RETRY_AFTER_MS = 60_000
const ERROR_SUMMARY_LIMIT = 280

export const ALLOWED_PATTERNS = [
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

export type GeminiGenerationOptions = {
  apiKey?: string
  model?: string
  fetchFn?: typeof fetch
  delay?: (milliseconds: number) => Promise<void>
  random?: () => number
}

type ProviderGenerationOptions = GeminiGenerationOptions & {
  log?: (message: string) => void
}

export class GeminiGenerationError extends Error {
  readonly attempts: number
  readonly category: GeminiFailureCategory
  readonly httpStatus?: number
  readonly retryable: boolean
  readonly safeSummary: string

  constructor({
    attempts,
    category,
    httpStatus,
    retryable,
    safeSummary
  }: {
    attempts: number
    category: GeminiFailureCategory
    httpStatus?: number
    retryable: boolean
    safeSummary: string
  }) {
    super(safeSummary)
    this.name = 'GeminiGenerationError'
    this.attempts = attempts
    this.category = category
    this.httpStatus = httpStatus
    this.retryable = retryable
    this.safeSummary = safeSummary
  }
}

// Gemini's generateContent endpoint supports responseMimeType and responseJsonSchema.
// Keep this schema small because Gemini supports a documented subset of JSON Schema.
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['signals'],
  properties: {
    signals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'pattern', 'summary', 'what_to_notice'],
        properties: {
          id: { type: 'string' },
          pattern: { type: 'string', enum: ALLOWED_PATTERNS },
          summary: { type: 'string' },
          what_to_notice: {
            type: 'array',
            maxItems: 3,
            items: { type: 'string' }
          }
        }
      }
    }
  }
} as const

function truncate(value: string | undefined, limit: number): string | undefined {
  if (!value) return undefined

  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed.length <= limit ? trimmed : `${trimmed.slice(0, limit - 1).trim()}…`
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

  return `You are helping generate cautious signal summaries for Civic Signals, a public digital government link aggregator.

Use only the supplied public link metadata. Signals show recurring themes in recent public links. They are not trends, rankings or judgements of importance.

For every supplied signal, choose one allowed pattern, write a useful plain-British-English summary, and write up to 3 specific what_to_notice bullets. Describe only what appears in the supporting links. Avoid generic bullets, trends, importance claims, and implied official direction. Do not use: trend, trending, important, major, proves, confirms, everyone, must, revolution.

Keep summaries under 300 characters and bullets under 160 characters. Return only the structured response requested by the schema.

Input:
${JSON.stringify(input, null, 2)}`
}

function getTextFromGeminiResponse(value: unknown): string {
  const response = value as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }

  return response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim() ?? ''
}

function stripCodeFence(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()
}

function extractFirstJsonObject(text: string): string {
  const start = text.indexOf('{')
  if (start === -1) throw new Error('No JSON object found.')

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < text.length; index += 1) {
    const character = text[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (character === '\\') {
      escaped = true
      continue
    }
    if (character === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (character === '{') depth += 1
    if (character === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }

  throw new Error('Incomplete JSON object.')
}

function parseGeminiJson(text: string): GeminiResponse {
  const cleaned = stripCodeFence(text)
  if (!cleaned) {
    throw new GeminiGenerationError({
      attempts: 0,
      category: 'empty_response',
      retryable: false,
      safeSummary: 'Gemini returned an empty response.'
    })
  }

  try {
    return JSON.parse(cleaned) as GeminiResponse
  } catch {
    try {
      return JSON.parse(extractFirstJsonObject(cleaned)) as GeminiResponse
    } catch {
      throw new GeminiGenerationError({
        attempts: 0,
        category: 'response_parse',
        retryable: false,
        safeSummary: 'Gemini returned a response that could not be parsed as JSON.'
      })
    }
  }
}

function containsUnsupportedWording(value: string): boolean {
  return UNSUPPORTED_WORDING.some((pattern) => pattern.test(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function validateGeminiResponse(value: unknown, originalSignalIds: Set<string>): string[] {
  const errors: string[] = []
  if (!isRecord(value) || !Array.isArray(value.signals)) {
    return ['Response is missing a signals array.']
  }

  const receivedIds = new Set<string>()
  const signals = value.signals

  if (signals.length !== originalSignalIds.size) {
    errors.push('Response signal count does not match the rules output.')
  }

  for (const candidate of signals) {
    if (!isRecord(candidate)) {
      errors.push('Response contains an invalid signal object.')
      continue
    }

    const id = candidate.id
    const pattern = candidate.pattern
    const summary = candidate.summary
    const bullets = candidate.what_to_notice

    if (typeof id !== 'string' || !id) {
      errors.push('Response contains a signal without an id.')
      continue
    }
    if (receivedIds.has(id)) errors.push(`${id} is duplicated.`)
    receivedIds.add(id)
    if (!originalSignalIds.has(id)) errors.push(`${id} is unknown.`)
    if (typeof pattern !== 'string' || !ALLOWED_PATTERNS.includes(pattern as typeof ALLOWED_PATTERNS[number])) {
      errors.push(`${id} has an unsupported pattern.`)
    }
    if (typeof summary !== 'string' || !summary.trim() || summary.length > 300) {
      errors.push(`${id} has a missing or long summary.`)
    } else if (containsUnsupportedWording(summary)) {
      errors.push(`${id} summary contains unsupported wording.`)
    }
    if (!Array.isArray(bullets) || bullets.length > 3) {
      errors.push(`${id} has invalid what_to_notice bullets.`)
    } else {
      for (const bullet of bullets) {
        if (typeof bullet !== 'string' || !bullet.trim() || bullet.length > 160) {
          errors.push(`${id} has a missing or long what_to_notice bullet.`)
        } else if (containsUnsupportedWording(bullet)) {
          errors.push(`${id} bullet contains unsupported wording.`)
        }
      }
    }
  }

  for (const id of originalSignalIds) {
    if (!receivedIds.has(id)) errors.push(`${id} is missing.`)
  }

  return errors
}

function classifyHttpFailure(status: number): GeminiFailureCategory {
  if (status === 401) return 'authentication'
  if (status === 403) return 'permission'
  if (status === 429) return 'rate_limit'
  if ([500, 502, 503, 504, 408].includes(status)) return 'server_error'
  return 'client_error'
}

function isRetryableStatus(status: number): boolean {
  return [408, 429, 500, 502, 503, 504].includes(status)
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function sanitiseGeminiErrorSummary(value: string, apiKey?: string): string {
  let summary = value
  if (apiKey) summary = summary.replace(new RegExp(escapeRegularExpression(apiKey), 'g'), '[redacted]')

  summary = summary
    .replace(/https?:\/\/[^\s"']+/gi, '[URL]')
    .replace(/[?&][^\s"']*=[^\s"']*/g, '[query parameters removed]')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!summary) return 'Gemini request failed without a usable error summary.'
  return summary.slice(0, ERROR_SUMMARY_LIMIT).trim()
}

async function getSafeErrorSummary(response: Response, apiKey: string): Promise<string> {
  let body = ''
  try {
    body = await response.text()
  } catch {
    // The status is still useful when the response body cannot be read.
  }

  if (!body) return `Gemini returned HTTP ${response.status}.`

  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } }
    if (typeof parsed.error?.message === 'string') {
      return sanitiseGeminiErrorSummary(parsed.error.message, apiKey)
    }
  } catch {
    // Non-JSON error bodies are sanitised below.
  }

  return sanitiseGeminiErrorSummary(body, apiKey)
}

function getRetryAfterMilliseconds(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS)

  const date = Date.parse(value)
  if (!Number.isNaN(date)) return Math.min(Math.max(date - now, 0), MAX_RETRY_AFTER_MS)
  return undefined
}

function retryDelayMilliseconds(attempt: number, retryAfter: string | null, random: () => number): number {
  const retryAfterMilliseconds = getRetryAfterMilliseconds(retryAfter)
  if (retryAfterMilliseconds !== undefined) return retryAfterMilliseconds
  return (250 * 2 ** (attempt - 1)) + Math.floor(random() * 100)
}

function defaultDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function requestGemini(
  url: string,
  body: unknown,
  apiKey: string,
  options: Required<Pick<GeminiGenerationOptions, 'fetchFn' | 'delay' | 'random'>>
): Promise<{ response: Response; attempts: number }> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response
    let failure: GeminiGenerationError | undefined

    try {
      response = await options.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    } catch {
      failure = new GeminiGenerationError({
        attempts: attempt,
        category: 'network',
        retryable: true,
        safeSummary: 'Gemini request failed due to a network error.'
      })
    }

    if (!failure && !response!.ok) {
      const status = response!.status
      failure = new GeminiGenerationError({
        attempts: attempt,
        category: classifyHttpFailure(status),
        httpStatus: status,
        retryable: isRetryableStatus(status),
        safeSummary: await getSafeErrorSummary(response!, apiKey)
      })
    }

    if (!failure) return { response: response!, attempts: attempt }
    if (!failure.retryable || attempt === MAX_ATTEMPTS) throw failure

    const retryAfter = failure.httpStatus === undefined ? null : response!.headers.get('Retry-After')
    await options.delay(retryDelayMilliseconds(attempt, retryAfter, options.random))
  }

  throw new GeminiGenerationError({
    attempts: MAX_ATTEMPTS,
    category: 'unknown',
    retryable: false,
    safeSummary: 'Gemini request failed unexpectedly.'
  })
}

function mergeEnhancements(
  output: SignalsOutput,
  response: GeminiResponse,
  diagnostics: SignalGenerationDiagnostics
): SignalsOutput {
  const enhancementsById = new Map(response.signals.map((signal) => [signal.id, signal]))
  return {
    ...output,
    provider: 'gemini',
    generation_diagnostics: diagnostics,
    signals: output.signals.map((signal) => {
      const enhancement = enhancementsById.get(signal.id)!
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
  links: CivicLink[],
  options: GeminiGenerationOptions = {}
): Promise<SignalsOutput> {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY
  const model = options.model ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL
  if (!apiKey) {
    throw new GeminiGenerationError({
      attempts: 0,
      category: 'configuration',
      retryable: false,
      safeSummary: 'GEMINI_API_KEY is not configured.'
    })
  }

  if (output.signals.length === 0) {
    return {
      ...output,
      provider: 'gemini',
      generation_diagnostics: {
        requested_provider: 'gemini',
        provider_used: 'gemini',
        status: 'succeeded',
        model,
        attempts: 0
      }
    }
  }

  const result = await requestGemini(
    `${GEMINI_API_BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      contents: [{ parts: [{ text: createPrompt(output, links) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: GEMINI_RESPONSE_SCHEMA
      }
    },
    apiKey,
    {
      fetchFn: options.fetchFn ?? fetch,
      delay: options.delay ?? defaultDelay,
      random: options.random ?? Math.random
    }
  )

  let rawResponse: unknown
  try {
    rawResponse = await result.response.json()
  } catch {
    throw new GeminiGenerationError({
      attempts: result.attempts,
      category: 'response_parse',
      retryable: false,
      safeSummary: 'Gemini returned a response body that could not be parsed.'
    })
  }

  let parsed: GeminiResponse
  try {
    parsed = parseGeminiJson(getTextFromGeminiResponse(rawResponse))
  } catch (error) {
    if (error instanceof GeminiGenerationError) {
      throw new GeminiGenerationError({ ...error, attempts: result.attempts })
    }
    throw error
  }

  const errors = validateGeminiResponse(parsed, new Set(output.signals.map((signal) => signal.id)))
  if (errors.length > 0) {
    throw new GeminiGenerationError({
      attempts: result.attempts,
      category: 'response_validation',
      retryable: false,
      safeSummary: 'Gemini returned a response that failed signal validation.'
    })
  }

  return mergeEnhancements(output, parsed, {
    requested_provider: 'gemini',
    provider_used: 'gemini',
    status: 'succeeded',
    model,
    attempts: result.attempts
  })
}

function asGeminiGenerationError(error: unknown): GeminiGenerationError {
  if (error instanceof GeminiGenerationError) return error
  return new GeminiGenerationError({
    attempts: 0,
    category: 'unknown',
    retryable: false,
    safeSummary: 'Gemini enhancement failed unexpectedly.'
  })
}

export async function generateSignalsWithProvider(
  provider: string,
  rulesOutput: SignalsOutput,
  links: CivicLink[],
  options: ProviderGenerationOptions = {}
): Promise<SignalsOutput> {
  if (provider === 'rules') {
    return {
      ...rulesOutput,
      provider: 'rules',
      generation_diagnostics: {
        requested_provider: 'rules',
        provider_used: 'rules',
        status: 'succeeded',
        attempts: 0
      }
    }
  }
  if (provider !== 'gemini') throw new Error(`Unsupported SIGNALS_PROVIDER: ${provider}`)

  const model = options.model ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL
  try {
    return await enhanceWithGemini(rulesOutput, links, options)
  } catch (error) {
    const failure = asGeminiGenerationError(error)
    options.log?.(`Gemini enhancement failed: ${failure.safeSummary} Category: ${failure.category}; attempts: ${failure.attempts}${failure.httpStatus ? `; HTTP ${failure.httpStatus}` : ''}.`)
    return {
      ...rulesOutput,
      provider: 'rules_fallback',
      generation_diagnostics: {
        requested_provider: 'gemini',
        provider_used: 'rules_fallback',
        status: 'fallback',
        model,
        attempts: failure.attempts,
        failure_category: failure.category,
        ...(failure.httpStatus === undefined ? {} : { http_status: failure.httpStatus })
      },
      signals: rulesOutput.signals.map((signal) => ({
        ...signal,
        generation_note: 'Gemini enhancement failed; using rules-based fallback.'
      }))
    }
  }
}
