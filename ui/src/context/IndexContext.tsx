import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import type { EmbeddingsIndex, Experiment } from '../types'

interface IndexContextValue {
  experiments: Experiment[]
  loading: boolean
  error: string | null
  totalCounts: { total: number; interaction: number; illumination: number }
}

const IndexContext = createContext<IndexContextValue>({
  experiments: [],
  loading: true,
  error: null,
  totalCounts: { total: 0, interaction: 0, illumination: 0 },
})

async function fetchExperiments(): Promise<EmbeddingsIndex> {
  const r = await fetch('/api/experiments')
  if (!r.ok) throw new Error(`Server error: ${r.status}`)
  return r.json()
}

export function IndexProvider({ children }: { children: ReactNode }) {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await fetchExperiments()
        if (cancelled) return
        if ('loading' in data && data.loading) {
          // Server is still indexing Drive — poll every 2 seconds
          pollRef.current = setTimeout(load, 2000)
          return
        }
        setExperiments(
          (data.experiments ?? []).map(e => ({
            ...e,
            folder_date: e.experiment_path.split('/')[1] ?? '',
          }))
        )
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [])

  const totalCounts = {
    total: experiments.length,
    interaction: experiments.filter(e => e.metadata.type === 'interaction').length,
    illumination: experiments.filter(e => e.metadata.type === 'illumination').length,
  }

  return (
    <IndexContext.Provider value={{ experiments, loading, error, totalCounts }}>
      {children}
    </IndexContext.Provider>
  )
}

export function useIndex() {
  return useContext(IndexContext)
}
