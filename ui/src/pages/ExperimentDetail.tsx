import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Download, Lightbulb, Hand, FileText, ImageOff } from 'lucide-react'
import { useIndex } from '../context/IndexContext'
import { experimentTitle, formatDate, formatTime, parseDuration, parseFLSCount, parseShape, parseAction, decodeExpPath } from '../lib/utils'

const SNAPSHOT_LABELS: Record<string, string> = {
  snapshot_first: 'Takeoff',
  snapshot_middle_1: 'Middle 1',
  snapshot_middle_2: 'Middle 2',
  snapshot_middle_3: 'Middle 3',
  snapshot_last: 'Landing',
}

const SNAPSHOT_ORDER = ['snapshot_first', 'snapshot_middle_1', 'snapshot_middle_2', 'snapshot_middle_3', 'snapshot_last']

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-sm text-slate-800 font-medium">{value || '—'}</div>
    </div>
  )
}

export default function ExperimentDetail() {
  const { '*': encodedPath } = useParams()
  const navigate = useNavigate()
  const { experiments } = useIndex()

  const experimentPath = decodeExpPath(encodedPath ?? '')
  const exp = experiments.find(e => e.experiment_path === experimentPath)

  if (!exp) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Experiment not found</p>
          <button onClick={() => navigate(-1)} className="text-blue-600 text-sm hover:underline">
            Go back
          </button>
        </div>
      </div>
    )
  }

  const textItem = exp.items.find(i => i.id === 'experiment_text')
  const snapshots = SNAPSHOT_ORDER
    .map(id => exp.items.find(i => i.id === id))
    .filter(Boolean)
  const telemetryFiles = Object.entries(
    exp.items.reduce<Record<string, string>>((acc, item) => {
      if (item.source_path && item.source_path !== 'metadata.json' && !item.source_path.startsWith('snapshots/')) {
        acc[item.source_path] = item.source_path
      }
      return acc
    }, {})
  )

  const summary = textItem?.text_summary ?? ''
  const duration = parseDuration(summary)
  const flsCount = parseFLSCount(summary)
  const shape = parseShape(summary)
  const action = parseAction(summary)

  const isIllumination = exp.metadata.type === 'illumination'

  function getSnapshotOffset(id: string): string {
    const item = exp.items.find(i => i.id === id)
    if (!item?.timestamp || !exp.metadata.timestamp) return ''
    const diff = (new Date(item.timestamp).getTime() - new Date(exp.metadata.timestamp).getTime()) / 1000
    return `T+${Math.round(Math.abs(diff))}s`
  }

  return (
    <div className="flex flex-col h-screen">
      {/* TopBar */}
      <div className="flex items-center justify-between px-10 h-[72px] border-b border-slate-200 bg-white flex-shrink-0">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-0.5"
          >
            <ChevronLeft size={14} />Search Results
          </button>
          <h1 className="text-xl font-semibold text-slate-900">Experiment Detail</h1>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          <Download size={14} />Export
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-10 py-6">
        {/* Experiment Header */}
        <div className="bg-white rounded-xl border border-slate-200 px-6 py-5 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold mb-2 ${
                isIllumination ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'
              }`}>
                {isIllumination ? <Lightbulb size={10} /> : <Hand size={10} />}
                {isIllumination ? 'ILLUMINATION' : 'INTERACTION'}
              </span>
              <h2 className="text-2xl font-bold text-slate-900">{experimentTitle(exp)}</h2>
              <p className="text-sm text-slate-500 mt-1">
                {formatDate(exp.folder_date + 'T00:00:00')} · {formatTime(exp.metadata.timestamp)} · Duration: {duration} · {flsCount} FLSs
                {shape ? ` · Shape: ${shape}` : ''}
                {action ? ` · Action: ${action}` : ''}
              </p>
            </div>
            {exp.metadata.notes && (
              <div className="max-w-xs">
                <p className="text-xs text-slate-400 mb-1">Researcher notes</p>
                <p className="text-sm text-slate-600 italic">{exp.metadata.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Snapshots */}
        {snapshots.length > 0 ? (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Representative Snapshots</h3>
            <div className="grid grid-cols-5 gap-3">
              {snapshots.map(snap => {
                if (!snap) return null
                const label = SNAPSHOT_LABELS[snap.id] ?? snap.id
                const offset = getSnapshotOffset(snap.id)
                return (
                  <div key={snap.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className={`h-32 flex items-center justify-center ${
                      isIllumination ? 'bg-amber-50' : 'bg-violet-50'
                    }`}>
                      <ImageOff size={24} className="text-slate-300" />
                    </div>
                    <div className="px-3 py-2">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        isIllumination ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'
                      }`}>{label}</span>
                      {offset && <p className="text-xs text-slate-400 mt-1">{offset}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="mb-5 bg-slate-50 rounded-xl border border-slate-200 border-dashed px-6 py-8 text-center">
            <ImageOff size={20} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No snapshots available — run fls-embed to generate them</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-5">
          {/* Metadata Panel */}
          <div className="bg-white rounded-xl border border-slate-200 px-6 py-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Experiment Metadata</h3>
            <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-x-6 gap-y-4">
              <MetaField label="Type" value={exp.metadata.type.charAt(0).toUpperCase() + exp.metadata.type.slice(1)} />
              {shape && <MetaField label="Shape" value={shape.charAt(0).toUpperCase() + shape.slice(1)} />}
              {action && <MetaField label="Action" value={action} />}
              <MetaField label="FLS Count" value={String(flsCount)} />
              <MetaField label="Duration" value={duration ? `${duration.replace('s', ' seconds')}` : '—'} />
              <MetaField label="Date" value={formatDate(exp.folder_date + 'T00:00:00')} />
              <MetaField label="Time" value={formatTime(exp.metadata.timestamp)} />
              <MetaField label="Video" value={summary.includes('video present') ? 'Available' : 'Not available'} />
            </div>
          </div>

          {/* Telemetry / Embeddings Panel */}
          <div className="bg-white rounded-xl border border-slate-200 px-6 py-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Embedding Items</h3>
            <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
              {exp.items.map(item => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <FileText size={14} className="text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{item.source_path || item.id}</p>
                    <p className="text-xs text-slate-400">{item.modality} · {item.embedding.length > 0 ? `${item.embedding.length}d vector` : 'no embedding'}</p>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    item.modality === 'image' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                  }`}>{item.modality}</span>
                </div>
              ))}
              {exp.items.length === 0 && (
                <p className="text-sm text-slate-400">No embedding data — run fls-embed</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
