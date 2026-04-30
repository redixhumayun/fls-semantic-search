import type { Experiment, SearchResult } from '../types'

function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

export class EmbedServerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmbedServerError'
  }
}

async function getQueryEmbedding(query: string): Promise<number[]> {
  let res: Response
  try {
    res = await fetch('/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: query }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new EmbedServerError(
      'Could not reach fls-server. Make sure it is running: fls-server'
    )
  }
  if (!res.ok) {
    throw new EmbedServerError(
      'Could not reach fls-server. Make sure it is running: fls-server'
    )
  }
  const data = await res.json()
  return data.embedding
}

export async function search(
  experiments: Experiment[],
  query: string,
  typeFilter: 'all' | 'interaction' | 'illumination' = 'all',
): Promise<SearchResult[]> {
  const queryVec = await getQueryEmbedding(query)

  const filtered = typeFilter === 'all'
    ? experiments
    : experiments.filter(e => e.metadata.type === typeFilter)

  const results: SearchResult[] = filtered.flatMap(exp => {
    const textItem = exp.items.find(i => i.id === 'experiment_text')
    if (!textItem || textItem.embedding.length === 0) return []
    return [{ experiment: exp, score: dot(queryVec, textItem.embedding), textItem }]
  })

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
}

export function buildAISummary(results: SearchResult[], query: string): string {
  if (results.length === 0) return `No experiments found matching "${query}".`
  const illumination = results.filter(r => r.experiment.metadata.type === 'illumination').length
  const interaction = results.filter(r => r.experiment.metadata.type === 'interaction').length
  const dates = results.map(r => r.experiment.metadata.date).sort()
  const dateRange = dates.length > 1
    ? `between ${formatShortDate(dates[0])} and ${formatShortDate(dates[dates.length - 1])}`
    : `on ${formatShortDate(dates[0])}`
  const parts = []
  if (illumination > 0) parts.push(`${illumination} illumination`)
  if (interaction > 0) parts.push(`${interaction} interaction`)
  return `Found ${results.length} experiment${results.length !== 1 ? 's' : ''} (${parts.join(', ')}) ${dateRange}.`
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
