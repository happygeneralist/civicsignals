import type { Signal, SignalsOutput } from './types'

function renumberSignals(signals: Signal[]): Signal[] {
  return signals.map((signal, index) => ({
    ...signal,
    id: `signal_${String(index + 1).padStart(3, '0')}`
  }))
}

export function applySignalDiversity(output: SignalsOutput): SignalsOutput {
  const usedPrimaryTopics = new Set<string>()
  const signals: Signal[] = []

  for (const signal of output.signals) {
    if (usedPrimaryTopics.has(signal.primary_topic)) {
      continue
    }

    signals.push(signal)
    usedPrimaryTopics.add(signal.primary_topic)
  }

  return {
    ...output,
    signals: renumberSignals(signals)
  }
}
