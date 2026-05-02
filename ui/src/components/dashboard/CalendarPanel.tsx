import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Experiment } from '../../types'
import { experimentsByDate } from '../../lib/utils'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

interface CalendarPanelProps {
  experiments: Experiment[]
}

export default function CalendarPanel({ experiments }: CalendarPanelProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const navigate = useNavigate()

  const byDate = experimentsByDate(experiments)

  const firstDay = new Date(year, month, 1)
  // Monday-first: Sun=6, Mon=0 ... Sat=5
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const monthName = firstDay.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function handleDayClick(day: number) {
    const date = isoDate(year, month, day)
    if (byDate[date]) {
      navigate(`/search?date=${date}`)
    }
  }

  const todayStr = isoDate(now.getFullYear(), now.getMonth(), now.getDate())

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-slate-100 text-slate-500">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-slate-800">{monthName}</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-slate-100 text-slate-500">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />

          const dateStr = isoDate(year, month, day)
          const exps = byDate[dateStr] ?? []
          const hasExps = exps.length > 0
          const isToday = dateStr === todayStr
          const illumination = exps.filter(e => e.metadata.type === 'illumination').length
          const interaction = exps.filter(e => e.metadata.type === 'interaction').length

          const tooltipParts = []
          if (illumination > 0) tooltipParts.push(`${illumination} illumination`)
          if (interaction > 0) tooltipParts.push(`${interaction} interaction`)
          const tooltip = `${exps.length} experiment${exps.length !== 1 ? 's' : ''}: ${tooltipParts.join(', ')}`

          const col = idx % 7
          const tooltipPos = col === 0
            ? 'left-0'
            : col === 6
            ? 'right-0'
            : 'left-1/2 -translate-x-1/2'
          const caretPos = col === 0
            ? 'left-3'
            : col === 6
            ? 'right-3'
            : 'left-1/2 -translate-x-1/2'

          return (
            <div
              key={idx}
              onClick={() => hasExps && handleDayClick(day)}
              className={`relative group flex flex-col items-center py-2 rounded-lg ${
                hasExps ? 'cursor-pointer hover:bg-slate-50' : ''
              } ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
            >
              {hasExps && (
                <div className={`absolute bottom-full ${tooltipPos} mb-1.5 px-2 py-1 bg-slate-800 text-white text-[10px] rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10`}>
                  {tooltip}
                  <div className={`absolute top-full ${caretPos} border-4 border-transparent border-t-slate-800`} />
                </div>
              )}
              <span className={`text-sm ${isToday ? 'text-blue-600 font-semibold' : 'text-slate-700'}`}>
                {day}
              </span>
              <div className="flex items-center gap-0.5 mt-1 h-4">
                {illumination > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                {interaction > 0 && <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-amber-400" />Illumination
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-violet-500" />Interaction
        </div>
      </div>
    </div>
  )
}
