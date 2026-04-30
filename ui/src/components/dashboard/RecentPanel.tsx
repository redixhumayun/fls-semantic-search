import { ArrowRight, Lightbulb, Hand } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Experiment } from '../../types'
import { experimentTitle, formatDate, formatTime, parseDuration, encodeExpPath } from '../../lib/utils'

interface RecentPanelProps {
  experiments: Experiment[]
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

export default function RecentPanel({ experiments }: RecentPanelProps) {
  const navigate = useNavigate()
  const recent = [...experiments]
    .sort((a, b) => b.metadata.timestamp.localeCompare(a.metadata.timestamp))
    .slice(0, 6)

  return (
    <div className="bg-white rounded-xl border border-slate-200 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">Recent Experiments</h2>
        <button
          onClick={() => navigate('/experiments')}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          View all <ArrowRight size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {recent.map((exp, i) => {
          const textItem = exp.items.find(i => i.id === 'experiment_text')
          const duration = textItem ? parseDuration(textItem.text_summary) : ''

          return (
            <button
              key={exp.experiment_path}
              onClick={() => navigate(`/experiment/${encodeExpPath(exp.experiment_path)}`)}
              className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-left transition-colors ${
                i < recent.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                exp.metadata.type === 'illumination' ? 'bg-amber-50' : 'bg-violet-50'
              }`}>
                {exp.metadata.type === 'illumination'
                  ? <Lightbulb size={18} className="text-amber-500" />
                  : <Hand size={18} className="text-violet-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <TypeBadge type={exp.metadata.type} />
                <p className="text-sm text-slate-800 font-medium mt-0.5 truncate">
                  {experimentTitle(exp)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatDate(exp.metadata.timestamp)} · {formatTime(exp.metadata.timestamp)}
                  {duration && ` · ${duration}`}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
