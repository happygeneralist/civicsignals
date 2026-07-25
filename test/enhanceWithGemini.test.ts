import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateSignalsWithProvider,
  sanitiseGeminiErrorSummary
} from '../src/lib/signals/enhanceWithGemini'
import type { SignalsOutput } from '../src/lib/signals/types'

type Enhancement = {
  id: string
  pattern?: string
  summary?: string
  what_to_notice?: unknown
}

const rulesOutput: SignalsOutput = {
  period_start: '2026-07-01',
  period_end: '2026-07-07',
  generated_at: '2026-07-07T12:00:00.000Z',
  provider: 'rules',
  generation_diagnostics: {
    requested_provider: 'rules',
    provider_used: 'rules',
    status: 'succeeded',
    attempts: 0
  },
  signals: [
    {
      id: 'signal_001',
      title: 'Service design',
      summary: 'Service design appears across recent links.',
      primary_topic: 'Service design',
      related_topics: [],
      top_activity_types: ['Guidance'],
      top_contexts: ['Central government'],
      link_count: 5,
      source_count: 3,
      organisation_count: 3,
      links: []
    },
    {
      id: 'signal_002',
      title: 'User research',
      summary: 'User research appears across recent links.',
      primary_topic: 'User research',
      related_topics: [],
      top_activity_types: ['Research'],
      top_contexts: ['Local government'],
      link_count: 5,
      source_count: 3,
      organisation_count: 3,
      links: []
    }
  ]
}

function enhancements(overrides: Enhancement[] = []): Enhancement[] {
  const defaults: Enhancement[] = [
    {
      id: 'signal_001',
      pattern: 'Guidance and standards',
      summary: 'Recent links describe guidance used by service teams.',
      what_to_notice: ['Several sources describe practical guidance.']
    },
    {
      id: 'signal_002',
      pattern: 'Research and evidence',
      summary: 'Recent links describe research activity in public services.',
      what_to_notice: ['Research methods are described in the linked material.']
    }
  ]

  return overrides.length > 0 ? overrides : defaults
}

function geminiResponse(signalEnhancements: readonly Enhancement[] = enhancements()): Response {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({ signals: signalEnhancements }) }] } }]
  }), { status: 200 })
}

function errorResponse(status: number, body = 'Temporary Gemini failure', headers?: HeadersInit): Response {
  return new Response(body, { status, headers })
}

function mockFetch(results: Array<Response | Error>) {
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = []
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push([input, init])
    const result = results.shift()
    if (!result) throw new Error('Unexpected request')
    if (result instanceof Error) throw result
    return result
  }) as typeof fetch

  return { calls, fetchFn }
}

function geminiOptions(fetchFn: typeof fetch, delays: number[] = []) {
  return {
    apiKey: 'test-api-key',
    model: 'gemini-2.5-flash',
    fetchFn,
    delay: async (milliseconds: number) => { delays.push(milliseconds) },
    random: () => 0
  }
}

test('merges a successful structured Gemini response and records success diagnostics', async () => {
  const { calls, fetchFn } = mockFetch([geminiResponse()])
  const output = await generateSignalsWithProvider('gemini', rulesOutput, [], geminiOptions(fetchFn))

  assert.equal(calls.length, 1)
  assert.equal(output.provider, 'gemini')
  assert.equal(output.generation_diagnostics.status, 'succeeded')
  assert.equal(output.generation_diagnostics.attempts, 1)
  assert.equal(output.signals[0].pattern, 'Guidance and standards')
  assert.equal(output.signals[1].what_to_notice?.[0], 'Research methods are described in the linked material.')

  const requestBody = JSON.parse(String(calls[0][1]?.body))
  assert.equal(requestBody.generationConfig.responseMimeType, 'application/json')
  assert.deepEqual(requestBody.generationConfig.responseJsonSchema.required, ['signals'])
  assert.equal(requestBody.generationConfig.responseJsonSchema.properties.signals.items.additionalProperties, false)
  assert.equal(requestBody.generationConfig.temperature, undefined)
})

test('retries HTTP 429 then succeeds', async () => {
  const delays: number[] = []
  const { calls, fetchFn } = mockFetch([
    errorResponse(429, '{"error":{"message":"Try again"}}', { 'Retry-After': '1' }),
    geminiResponse()
  ])
  const output = await generateSignalsWithProvider('gemini', rulesOutput, [], geminiOptions(fetchFn, delays))

  assert.equal(calls.length, 2)
  assert.deepEqual(delays, [1000])
  assert.equal(output.generation_diagnostics.attempts, 2)
  assert.equal(output.provider, 'gemini')
})

test('uses rules fallback after the maximum repeated HTTP 503 attempts', async () => {
  const delays: number[] = []
  const { calls, fetchFn } = mockFetch([errorResponse(503), errorResponse(503), errorResponse(503)])
  const output = await generateSignalsWithProvider('gemini', rulesOutput, [], geminiOptions(fetchFn, delays))

  assert.equal(calls.length, 3)
  assert.equal(delays.length, 2)
  assert.equal(output.provider, 'rules_fallback')
  assert.equal(output.generation_diagnostics.failure_category, 'server_error')
  assert.equal(output.generation_diagnostics.attempts, 3)
})

test('does not retry HTTP 400 and records a client error fallback', async () => {
  const { calls, fetchFn } = mockFetch([errorResponse(400)])
  const output = await generateSignalsWithProvider('gemini', rulesOutput, [], geminiOptions(fetchFn))

  assert.equal(calls.length, 1)
  assert.equal(output.provider, 'rules_fallback')
  assert.equal(output.generation_diagnostics.failure_category, 'client_error')
})

test('does not retry HTTP 403 and records a permission fallback', async () => {
  const { calls, fetchFn } = mockFetch([errorResponse(403)])
  const output = await generateSignalsWithProvider('gemini', rulesOutput, [], geminiOptions(fetchFn))

  assert.equal(calls.length, 1)
  assert.equal(output.generation_diagnostics.failure_category, 'permission')
  assert.equal(output.generation_diagnostics.http_status, 403)
})

test('records a configuration fallback without calling Gemini when the key is missing', async () => {
  const { calls, fetchFn } = mockFetch([])
  const output = await generateSignalsWithProvider('gemini', rulesOutput, [], {
    ...geminiOptions(fetchFn),
    apiKey: ''
  })

  assert.equal(calls.length, 0)
  assert.equal(output.generation_diagnostics.failure_category, 'configuration')
  assert.equal(output.generation_diagnostics.attempts, 0)
})

test('retries a network error without sleeping and then succeeds', async () => {
  const delays: number[] = []
  const { calls, fetchFn } = mockFetch([new Error('Network unavailable'), geminiResponse()])
  const output = await generateSignalsWithProvider('gemini', rulesOutput, [], geminiOptions(fetchFn, delays))

  assert.equal(calls.length, 2)
  assert.deepEqual(delays, [250])
  assert.equal(output.provider, 'gemini')
  assert.equal(output.generation_diagnostics.attempts, 2)
})

test('uses parse and empty-response fallbacks for malformed Gemini responses', async (t) => {
  await t.test('malformed response', async () => {
    const { fetchFn } = mockFetch([new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{bad json' }] } }] }))])
    const output = await generateSignalsWithProvider('gemini', rulesOutput, [], geminiOptions(fetchFn))
    assert.equal(output.generation_diagnostics.failure_category, 'response_parse')
  })

  await t.test('empty response', async () => {
    const { fetchFn } = mockFetch([new Response(JSON.stringify({ candidates: [{ content: { parts: [] } }] }))])
    const output = await generateSignalsWithProvider('gemini', rulesOutput, [], geminiOptions(fetchFn))
    assert.equal(output.generation_diagnostics.failure_category, 'empty_response')
  })
})

test('rejects unsupported wording', async () => {
  const { fetchFn } = mockFetch([geminiResponse(enhancements([
    { ...enhancements()[0], summary: 'This is an important development.' },
    enhancements()[1]
  ]))])
  const output = await generateSignalsWithProvider('gemini', rulesOutput, [], geminiOptions(fetchFn))
  assert.equal(output.generation_diagnostics.failure_category, 'response_validation')
})

test('rejects missing, duplicate and unknown signal IDs as complete-response failures', async (t) => {
  const valid = enhancements()
  for (const [name, response] of [
    ['missing', [valid[0]]],
    ['duplicate', [valid[0], { ...valid[0] }]],
    ['unknown', [valid[0], { ...valid[1], id: 'signal_999' }]]
  ] as const) {
    await t.test(name, async () => {
      const { fetchFn } = mockFetch([geminiResponse(response)])
      const output = await generateSignalsWithProvider('gemini', rulesOutput, [], geminiOptions(fetchFn))
      assert.equal(output.provider, 'rules_fallback')
      assert.equal(output.generation_diagnostics.failure_category, 'response_validation')
    })
  }
})

test('rejects an overlong summary or bullet', async (t) => {
  const valid = enhancements()
  for (const [name, response] of [
    ['summary', [{ ...valid[0], summary: 'x'.repeat(301) }, valid[1]]],
    ['bullet', [{ ...valid[0], what_to_notice: ['x'.repeat(161)] }, valid[1]]]
  ] as const) {
    await t.test(name, async () => {
      const { fetchFn } = mockFetch([geminiResponse(response)])
      const output = await generateSignalsWithProvider('gemini', rulesOutput, [], geminiOptions(fetchFn))
      assert.equal(output.generation_diagnostics.failure_category, 'response_validation')
    })
  }
})

test('sanitises API errors before they can be logged', async () => {
  const key = 'test-api-key'
  const summary = sanitiseGeminiErrorSummary(`<html>Failure at https://example.test/path?key=${key}&account=private ${key} ${'x'.repeat(400)}</html>`, key)
  assert.equal(summary.includes(key), false)
  assert.equal(summary.includes('https://'), false)
  assert.equal(summary.includes('?key='), false)
  assert.ok(summary.length <= 280)
})

test('logs only a sanitised API error summary during fallback', async () => {
  const key = 'test-api-key'
  const logs: string[] = []
  const { fetchFn } = mockFetch([errorResponse(400, JSON.stringify({
    error: { message: `Request failed at https://example.test/path?key=${key}&account=private ${key}` }
  }))])
  await generateSignalsWithProvider('gemini', rulesOutput, [], {
    ...geminiOptions(fetchFn),
    log: (message) => logs.push(message)
  })

  assert.equal(logs.length, 1)
  assert.equal(logs[0].includes(key), false)
  assert.equal(logs[0].includes('https://'), false)
  assert.equal(logs[0].includes('?key='), false)
})

test('rules provider does not call Gemini and records deliberate rules generation', async () => {
  const { calls, fetchFn } = mockFetch([])
  const output = await generateSignalsWithProvider('rules', rulesOutput, [], geminiOptions(fetchFn))

  assert.equal(calls.length, 0)
  assert.equal(output.provider, 'rules')
  assert.deepEqual(output.generation_diagnostics, {
    requested_provider: 'rules',
    provider_used: 'rules',
    status: 'succeeded',
    attempts: 0
  })
})
