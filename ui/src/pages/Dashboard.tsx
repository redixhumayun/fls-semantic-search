import { useNavigate } from 'react-router-dom'
import { Search, ServerCrash } from 'lucide-react'
import { useIndex } from '../context/IndexContext'
import StatCard from '../components/dashboard/StatCard'
import CalendarPanel from '../components/dashboard/CalendarPanel'
import RecentPanel from '../components/dashboard/RecentPanel'

export default function Dashboard() {
  const { experiments, loading, error, totalCounts } = useIndex()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col h-screen">
      {/* TopBar */}
      <div className="flex items-center justify-between px-10 h-[72px] border-b border-slate-200 bg-white flex-shrink-0">
        <h1 className="text-xl font-semibold text-slate-900">Experiment Dashboard</h1>
        <button
          onClick={() => navigate('/search')}
          className="flex items-center gap-2 w-[500px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 text-sm hover:border-slate-300 transition-colors"
        >
          <Search size={16} />
          <span>Search experiments with natural language...</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-10 py-6">
        {loading ? (
          <div className="text-slate-400 text-sm">Loading experiments...</div>
        ) : error ? (
          <div className="flex gap-3 items-start bg-red-50 border border-red-200 rounded-xl px-6 py-5">
            <ServerCrash size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700">fls-server unreachable</p>
              <p className="text-sm text-red-600 mt-1">
                Could not load experiment data. Make sure fls-server is running:
              </p>
              <code className="inline-block mt-2 px-3 py-1.5 bg-red-100 text-red-800 rounded text-sm font-mono">
                fls-server
              </code>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <StatCard value={totalCounts.total} label="Total Experiments" accentColor="bg-blue-500" />
              <StatCard value={totalCounts.thisMonth} label="This Month" accentColor="bg-emerald-500" />
              <StatCard value={totalCounts.interaction} label="Interaction" accentColor="bg-violet-500" />
              <StatCard value={totalCounts.illumination} label="Illumination" accentColor="bg-amber-500" />
            </div>
            <div className="grid grid-cols-[1fr_380px] gap-4">
              <CalendarPanel experiments={experiments} />
              <RecentPanel experiments={experiments} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
