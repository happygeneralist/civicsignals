import type { CivicLink, SignalsOutput } from './types'

const UNSUPPORTED_TITLE_PATTERNS = [
  /\bproves\b/i,
  /\bconfirms\b/i,
  /\bthe sector is\b/i,
  /\b(?:the|uk|central) government is\b/i,
  /\beveryone\b/i,
  /\bmust\b/i,
  /\brevolution\b/i
]

export function validateSignalsOutput(
  output: SignalsOutput,
  sourceLinks: CivicLink[]
): string[] {
  const errors: string[] = []
  const diagnostics = output.generation_diagnostics
  const sourceLinkIds = new Set(sourceLinks.map((link) => link.id))
  const signalIds = new Set<string>()
  const primaryTopics = new Set<string>()

  if (!diagnostics) {
    errors.push('Signal generation diagnostics are missing.')
  } else {
    if (diagnostics.provider_used !== output.provider) {
      errors.push('Signal generation diagnostics do not match the output provider.')
    }

    if (!Number.isInteger(diagnostics.attempts) || diagnostics.attempts < 0) {
      errors.push('Signal generation diagnostics have an invalid attempt count.')
    }

    if (diagnostics.status === 'fallback' && !diagnostics.failure_category) {
      errors.push('Fallback signal generation diagnostics are missing a failure category.')
    }
  }

  for (const signal of output.signals) {
    if (!signal.title.trim()) {
      errors.push(`${signal.id} is missing a title.`)
    }

    if (signal.title.length > 90) {
      errors.push(`${signal.id} title is longer than 90 characters.`)
    }

    for (const pattern of UNSUPPORTED_TITLE_PATTERNS) {
      if (pattern.test(signal.title)) {
        errors.push(`${signal.id} title contains unsupported wording: ${signal.title}`)
      }
    }

    if (signalIds.has(signal.id)) {
      errors.push(`${signal.id} duplicates another signal id.`)
    }

    signalIds.add(signal.id)

    if (primaryTopics.has(signal.primary_topic)) {
      errors.push(`${signal.id} duplicates another primary topic: ${signal.primary_topic}`)
    }

    primaryTopics.add(signal.primary_topic)

    if (signal.links.length < 3) {
      errors.push(`${signal.id} has fewer than 3 supporting links.`)
    }

    const linkIds = signal.links.map((link) => link.id)
    const uniqueLinkIds = new Set(linkIds)

    if (linkIds.length !== uniqueLinkIds.size) {
      errors.push(`${signal.id} contains duplicate links.`)
    }

    for (const linkId of linkIds) {
      if (!sourceLinkIds.has(linkId)) {
        errors.push(`${signal.id} includes an unknown source link: ${linkId}`)
      }
    }
  }

  return errors
}
