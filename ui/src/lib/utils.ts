import type { Experiment } from '../types'

export function formatDate(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function formatDateTime(isoString: string): string {
  return `${formatDate(isoString)} · ${formatTime(isoString)}`
}

export function parseDuration(summary: string): string {
  const m = summary.match(/duration (\d+(?:\.\d+)?) seconds/)
  if (!m) return ''
  return `${Math.round(parseFloat(m[1]))}s`
}

export function parseFLSCount(summary: string): number {
  const m = summary.match(/(\d+) FLSs?/)
  return m ? parseInt(m[1]) : 0
}

export function parseShape(summary: string): string {
  const m = summary.match(/shape ([^,]+)/)
  return m ? m[1].replace(/_/g, ' ') : ''
}

export function parseInteractionName(summary: string): string {
  const m = summary.match(/name ([^,]+)/)
  return m ? m[1].replace(/_/g, ' ') : ''
}

export function parseAction(summary: string): string {
  const m = summary.match(/action ([^,]+)/)
  return m ? m[1] : ''
}

export function experimentTitle(exp: Experiment): string {
  const textItem = exp.items.find(i => i.id === 'experiment_text')
  if (!textItem) return exp.metadata.experiment_name
  const summary = textItem.text_summary
  if (exp.metadata.type === 'illumination') {
    const shape = parseShape(summary)
    const count = parseFLSCount(summary)
    return shape ? `${capitalize(shape)} shape — ${count} FLSs` : exp.metadata.experiment_name
  } else {
    const name = parseInteractionName(summary)
    const count = parseFLSCount(summary)
    return name ? `${capitalize(name)} — ${count} FLSs` : exp.metadata.experiment_name
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function experimentsByDate(experiments: Experiment[]): Record<string, Experiment[]> {
  const map: Record<string, Experiment[]> = {}
  for (const exp of experiments) {
    const date = exp.folder_date
    if (!map[date]) map[date] = []
    map[date].push(exp)
  }
  return map
}

export function encodeExpPath(experimentPath: string): string {
  return encodeURIComponent(experimentPath)
}

export function decodeExpPath(encoded: string): string {
  return decodeURIComponent(encoded)
}
