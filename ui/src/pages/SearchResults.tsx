import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Lightbulb, Hand, Sparkles, ServerCrash, SlidersHorizontal, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useIndex } from '../context/IndexContext'
import { search, buildAISummary, EmbedServerError } from '../lib/search'
import {
  experimentTitle, formatDate, formatTime, parseDuration,
  parseDurationSeconds, parseFLSCount, parseShape, parseInteractionName, encodeExpPath,
} from '../lib/utils'
import type { Experiment, SearchResult } from '../types'

type TypeFilter = 'all' | 'interaction' | 'illumination'

interface Filters {
  minFLS: string
  maxFLS: string
  minDuration: string
  maxDuration: string
  shape: string
  interactionName: string
  hasVideo: string  // 'any' | 'yes' | 'no'
}

const DEFAULT_FILTERS: Filters = {
  minFLS: '', maxFLS: '',
  minDuration: '', maxDuration: '',
  shape: '', interactionName: '',
  hasVideo: 'any',
}

function countActiveFilters(f: Filters): number {
  return [
    f.minFLS, f.maxFLS, f.minDuration, f.maxDuration, f.shape, f.interactionName,
  ].filter(Boolean).length + (f.hasVideo !== 'any' ? 1 : 0)
}

function applyFilters(exps: Experiment[], filters: Filters): Experiment[] {
  return exps.filter(e => {
    const summary = e.items.find(i => i.id === 'experiment_text')?.text_summary ?? ''
    const fls = parseFLSCount(summary)
    const dur = parseDurationSeconds(summary)
    const shape = parseShape(summary)
    const intName = parseInteractionName(summary)
    const hasVideo = summary.includes('video present')

    if (filters.minFLS && fls < parseInt(filters.minFLS)) return false
    if (filters.maxFLS && fls > parseInt(filters.maxFLS)) return false
    if (filters.minDuration && dur < parseFloat(filters.minDuration)) return false
    if (filters.maxDuration && dur > parseFloat(filters.maxDuration)) return false
    if (filters.shape && shape !== filters.shape) return false
    if (filters.interactionName && intName !== filters.interactionName) return false
    if (filters.hasVideo === 'yes' && !hasVideo) return false
    if (filters.hasVideo === 'no' && hasVideo) return false

    return true
  })
}

function TypeBadge({ type }: { type: 'interaction' | 'illumination' }) {
  if (type === 'illumination') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">
        <Lightbulb size={10} />ILLUMINATION
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-violet-100 text-violet-700">
      <Hand size={10} />INTERACTION
    </span>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-blue-600' : 'text-slate-400'
  return <span className={`text-xs font-semibold ${color}`}>{pct}%</span>
}

function ResultCard({ result, onClick }: { result: SearchResult; onClick: () => void }) {
  const { experiment: exp, score, textItem } = result
  const duration = parseDuration(textItem?.text_summary ?? '')

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-5 flex gap-4 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className={`w-28 h-28 rounded-lg flex items-center justify-center flex-shrink-0 ${
        exp.metadata.type === 'illumination' ? 'bg-amber-50' : 'bg-violet-50'
      }`}>
        {exp.metadata.type === 'illumination'
          ? <Lightbulb size={36} className="text-amber-400" />
          : <Hand size={36} className="text-violet-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <TypeBadge type={exp.metadata.type} />
          <ScoreBadge score={score} />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mt-2 truncate">
          {experimentTitle(exp)}
        </h3>
        <p className="text-sm text-slate-500 mt-0.5">
          {formatDate(exp.folder_date + 'T00:00:00')} · {formatTime(exp.metadata.timestamp)}
        </p>
        {duration && (
          <p className="text-sm text-slate-400 mt-0.5">Duration: {duration}</p>
        )}
      </div>
    </div>
  )
}

export default function SearchResults() {
  const { experiments } = useIndex()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const queryParam = searchParams.get('q') ?? ''
  const dateParam = searchParams.get('date') ?? ''
  const typeParam = (searchParams.get('type') ?? 'all') as TypeFilter

  const [inputValue, setInputValue] = useState(queryParam)
  const [results, setResults] = useState<SearchResult[]>([])
  const [aiSummary, setAiSummary] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)

  const uniqueShapes = useMemo(() => {
    const shapes = new Set<string>()
    experiments.forEach(e => {
      if (e.metadata.type !== 'illumination') return
      const s = parseShape(e.items.find(i => i.id === 'experiment_text')?.text_summary ?? '')
      if (s) shapes.add(s)
    })
    return Array.from(shapes).sort()
  }, [experiments])

  const uniqueInteractionNames = useMemo(() => {
    const names = new Set<string>()
    experiments.forEach(e => {
      if (e.metadata.type !== 'interaction') return
      const n = parseInteractionName(e.items.find(i => i.id === 'experiment_text')?.text_summary ?? '')
      if (n) names.add(n)
    })
    return Array.from(names).sort()
  }, [experiments])

  const runSearch = useCallback(async (q: string, type: TypeFilter, date: string, f: Filters) => {
    if (!q && !date) { setResults([]); setAiSummary(''); setSearchError(null); return }
    setSearching(true)
    setSearchError(null)
    try {
      let exps = date ? experiments.filter(e => e.folder_date === date) : experiments
      exps = exps.filter(e => type === 'all' || e.metadata.type === type)
      exps = applyFilters(exps, f)
      const res = q
        ? await search(exps, q, 'all')
        : exps.map(e => ({ experiment: e, score: 1, textItem: e.items.find(i => i.id === 'experiment_text') ?? e.items[0] }))
      setResults(res)
      setAiSummary(buildAISummary(res, q || `date: ${date}`))
    } catch (e) {
      setResults([])
      setAiSummary('')
      setSearchError(e instanceof EmbedServerError ? e.message : 'An unexpected error occurred.')
    } finally {
      setSearching(false)
    }
  }, [experiments])

  useEffect(() => {
    runSearch(queryParam, typeParam, dateParam, filters)
  }, [queryParam, typeParam, dateParam, filters, runSearch])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearchParams({ q: inputValue, type: typeParam })
  }

  function setTypeFilter(type: TypeFilter) {
    setSearchParams({ q: queryParam, type, ...(dateParam ? { date: dateParam } : {}) })
  }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS)
  }

  const activeFilterCount = countActiveFilters(filters)

  return (
    <div className="flex flex-col h-screen">
      {/* TopBar */}
      <div className="flex items-center justify-between px-10 h-[72px] border-b border-slate-200 bg-white flex-shrink-0">
        <h1 className="text-xl font-semibold text-slate-900">Search Results</h1>
        <form onSubmit={handleSubmit} className="w-[500px]">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus-within:border-blue-400 transition-colors">
            <Search size={16} className="text-slate-400 flex-shrink-0" />
            <input
              autoFocus
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Search experiments with natural language..."
              className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto px-10 py-5">
        {/* Date filter pill */}
        {dateParam && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-slate-500">Showing experiments on</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
              {dateParam}
              <button onClick={() => setSearchParams({ q: queryParam, type: typeParam })} className="ml-1 text-blue-400 hover:text-blue-600">×</button>
            </span>
          </div>
        )}

        {/* Filter row */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm text-slate-500">{results.length} result{results.length !== 1 ? 's' : ''} found</span>
          <div className="flex gap-1">
            {(['all', 'illumination', 'interaction'] as TypeFilter[]).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  typeParam === t
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setFiltersOpen(o => !o)}
            className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
              activeFilterCount > 0
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-blue-500 text-white text-xs font-semibold rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
            {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Collapsible filter panel */}
        {filtersOpen && (
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-4">
            <div className="grid grid-cols-4 gap-4">
              {/* FLS Count */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">FLS Count</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" min={0} placeholder="Min"
                    value={filters.minFLS}
                    onChange={e => setFilter('minFLS', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400"
                  />
                  <span className="text-slate-300 text-xs">—</span>
                  <input
                    type="number" min={0} placeholder="Max"
                    value={filters.maxFLS}
                    onChange={e => setFilter('maxFLS', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Duration (seconds)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" min={0} placeholder="Min"
                    value={filters.minDuration}
                    onChange={e => setFilter('minDuration', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400"
                  />
                  <span className="text-slate-300 text-xs">—</span>
                  <input
                    type="number" min={0} placeholder="Max"
                    value={filters.maxDuration}
                    onChange={e => setFilter('maxDuration', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Shape */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Shape</label>
                <select
                  value={filters.shape}
                  onChange={e => setFilter('shape', e.target.value)}
                  disabled={typeParam === 'interaction'}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <option value="">Any</option>
                  {uniqueShapes.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Interaction name */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Interaction</label>
                <select
                  value={filters.interactionName}
                  onChange={e => setFilter('interactionName', e.target.value)}
                  disabled={typeParam === 'illumination'}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <option value="">Any</option>
                  {uniqueInteractionNames.map(n => (
                    <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Second row: has video + clear */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <span className="text-xs font-medium text-slate-500">Video</span>
                <select
                  value={filters.hasVideo}
                  onChange={e => setFilter('hasVideo', e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1 text-sm text-slate-700 outline-none focus:border-blue-400"
                >
                  <option value="any">Any</option>
                  <option value="yes">Present</option>
                  <option value="no">Absent</option>
                </select>
              </label>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={12} /> Clear all filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* AI Summary */}
        {aiSummary && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 mb-5 flex gap-3">
            <Sparkles size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Summary</span>
              <p className="text-sm text-slate-700 mt-1">{aiSummary}</p>
            </div>
          </div>
        )}

        {/* Server error */}
        {searchError && (
          <div className="flex gap-3 items-start bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-5">
            <ServerCrash size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">fls-server unreachable</p>
              <p className="text-sm text-red-600 mt-0.5">{searchError}</p>
            </div>
          </div>
        )}

        {/* Results grid */}
        {searching ? (
          <div className="text-slate-400 text-sm">Searching...</div>
        ) : !searchError && results.length === 0 && (queryParam || dateParam) ? (
          <div className="text-slate-400 text-sm">No experiments found.</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {results.map(result => (
              <ResultCard
                key={result.experiment.experiment_path}
                result={result}
                onClick={() => navigate(`/experiment/${encodeExpPath(result.experiment.experiment_path)}`)}
              />
            ))}
          </div>
        )}

        {/* Empty state when no query */}
        {!queryParam && !dateParam && (
          <div className="text-center py-16">
            <Search size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Type a query above to search experiments</p>
          </div>
        )}
      </div>
    </div>
  )
}
