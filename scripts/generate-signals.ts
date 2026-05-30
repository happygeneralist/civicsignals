import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { applySignalDiversity } from '../src/lib/signals/applySignalDiversity'
import { generateRulesSignals } from '../src/lib/signals/generateRulesSignals'
import { generateWeeklyThemes } from '../src/lib/signals/generateWeeklyThemes'
import { itemToCivicLink, tagLinks } from '../src/lib/signals/tagLinks'
import type { ClassificationRule, FeedItem, TopicRule } from '../src/lib/signals/types'
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

async function main() {
  const provider = process.env.SIGNALS_PROVIDER ?? 'rules'

  if (provider !== 'rules') {
    throw new Error('Only SIGNALS_PROVIDER=rules is implemented. Use rules for now.')
  }

  const items = await readJsonFile<FeedItem[]>(itemsPath)
  const topicRules = await readJsonFile<TopicRule[]>(topicRulesPath)
  const activityRules = await readJsonFile<ClassificationRule[]>(activityRulesPath)
  const contextRules = await readJsonFile<ClassificationRule[]>(contextRulesPath)
  const links = tagLinks(items.map(itemToCivicLink), topicRules, activityRules, contextRules)
  const rulesOutput = generateRulesSignals(links)
  const output = applySignalDiversity(rulesOutput)
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
