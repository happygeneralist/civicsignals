import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { generateRulesSignals } from '../src/lib/signals/generateRulesSignals'
import { itemToCivicLink, tagLinks } from '../src/lib/signals/tagLinks'
import type { FeedItem, TopicRule } from '../src/lib/signals/types'
import { validateSignalsOutput } from '../src/lib/signals/validateSignals'

const itemsPath = 'src/data/items.json'
const topicRulesPath = 'src/lib/signals/topic-rules.json'
const outputPath = 'src/data/signals/latest.json'

async function readJsonFile<T>(filePath: string): Promise<T> {
  const file = await readFile(filePath, 'utf8')
  return JSON.parse(file) as T
}

async function main() {
  const provider = process.env.SIGNALS_PROVIDER ?? 'rules'

  if (provider !== 'rules') {
    throw new Error('Only SIGNALS_PROVIDER=rules is implemented. Use rules for now.')
  }

  const items = await readJsonFile<FeedItem[]>(itemsPath)
  const topicRules = await readJsonFile<TopicRule[]>(topicRulesPath)
  const links = tagLinks(items.map(itemToCivicLink), topicRules)
  const output = generateRulesSignals(links)
  const validationErrors = validateSignalsOutput(output, links)

  if (validationErrors.length > 0) {
    throw new Error([
      'Generated signals failed validation:',
      ...validationErrors.map((error) => `- ${error}`)
    ].join('\n'))
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`)

  console.log(`Generated ${output.signals.length} signals at ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
