import type { Signal, SignalsOutput } from './types'

function getTitleTopics(signal: Signal): string[] {
  const topRelatedTopic = signal.related_topics[0]

  return topRelatedTopic
    ? [signal.primary_topic, topRelatedTopic]
    : [signal.primary_topic]
}

function renumberSignals(signals: Signal[]): Signal[] {
  return signals.map((signal, index) => ({
    ...signal,
    id: `signal_${String(index + 1).padStart(3, '0')}`
  }))
}

export function applySignalDiversity(output: SignalsOutput): SignalsOutput {
  const usedTitleTopics = new Set<string>()
  const signals: Signal[] = []

  for (const signal of output.signals) {
    const titleTopics = getTitleTopics(signal)
    const reusesTitleTopic = titleTopics.some((topic) => usedTitleTopics.has(topic))

    if (reusesTitleTopic) {
      continue
    }

    signals.push(signal)

    for (const topic of titleTopics) {
      usedTitleTopics.add(topic)
    }
  }

  return {
    ...output,
    signals: renumberSignals(signals)
  }
}
