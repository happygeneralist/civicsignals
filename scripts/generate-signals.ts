import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { applySignalDiversity } from '../src/lib/signals/applySignalDiversity'
import { enhanceWithGemini } from '../src/lib/signals/enhanceWithGemini'
import { generateRulesSignals } from '../src/lib/signals/generateRulesSignals'
import { generateWeeklyThemes } from '../src/lib/signals/generateWeeklyThemes'
import { itemToCivicLink, tagLinks } from '../src/lib/signals/tagLinks'
import type { ClassificationRule, FeedItem, SignalsOutput, TopicRule } from '../src/lib/signals/types'
import { validateSignalsOutput } from '../src/lib/signals/validateSignals'

const itemsPath = 'src/data/items.json'
const topicRulesPath = 'src/lib/signals/topic-rules.json'
const activityRulesPath = 'src/lib/signals/activity-rules.json'
const contextRulesPath = 'src/lib/signals/context-rules.json'
const signalsOutputPath = 'src/data/signals/latest.json'
const weeklyThemesOutputPath = 'src/data/signals/weekly-themes.json'

async function readJsonFile<T>(filePath: string): Promise<T> {
  const file = await readFile(filePath, 'utf8')
  return JSON.parse(file) as T
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

async function enhanceSignals(
  provider: string,
  rulesOutput: SignalsOutput,
  links: ReturnType<typeof tagLinks>
): Promise<SignalsOutput> {
  if (provider === 'rules') {
    return rulesOutput
  }

  if (provider !== 'gemini') {
    throw new Error(`Unsupported SIGNALS_PROVIDER: ${provider}`)
  }

  try {
    return await enhanceWithGemini(rulesOutput, links)
  } catch (error) {
    console.warn('Gemini enhancement failed. Falling back to rules output.')
    console.warn(error)

    return {
      ...rulesOutput,
      provider: 'rules_fallback',
      signals: rulesOutput.signals.map((signal) => ({
        ...signal,
        generation_note: 'Gemini enhancement failed; using rules-based fallback.'
      }))
    }
  }
}

async function main() {
  const provider = process.env.SIGNALS_PROVIDER ?? 'rules'
  const items = await readJsonFile<FeedItem[]>(itemsPath)
  const topicRules = await readJsonFile<TopicRule[]>(topicRulesPath)
  const activityRules = await readJsonFile<ClassificationRule[]>(activityRulesPath)
  const contextRules = await readJsonFile<ClassificationRule[]>(contextRulesPath)
  const links = tagLinks(items.map(itemToCivicLink), topicRules, activityRules, contextRules)
  const rulesOutput = applySignalDiversity(generateRulesSignals(links))
  const output = await enhanceSignals(provider, rulesOutput, links)
  const weeklyThemes = generateWeeklyThemes(links)
  const validationErrors = validateSignalsOutput(output, links)

  if (validationErrors.length > 0) {
    throw new Error([
      'Generated signals failed validation:',
      ...validationErrors.map((error) => `- ${error}`)
    ].join('\n'))
  }

  await writeJsonFile(signalsOutputPath, output)
  await writeJsonFile(weeklyThemesOutputPath, weeklyThemes)

  console.log(`Generated ${output.signals.length} signals at ${signalsOutputPath}`)
  console.log(`Generated ${weeklyThemes.themes.length} weekly themes at ${weeklyThemesOutputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
