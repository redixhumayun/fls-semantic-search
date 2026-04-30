interface StatCardProps {
  value: number | string
  label: string
  accentColor?: string
}

export default function StatCard({ value, label, accentColor = 'bg-blue-500' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-stretch gap-4">
      <div className={`w-1 rounded-full ${accentColor} self-stretch`} />
      <div>
        <div className="text-3xl font-bold text-slate-900 leading-tight">{value}</div>
        <div className="text-sm text-slate-500 mt-1">{label}</div>
      </div>
    </div>
  )
}
