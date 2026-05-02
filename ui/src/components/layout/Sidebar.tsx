import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Search, FlaskConical, Settings } from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/search', icon: Search, label: 'Search', end: false },
  { to: '/experiments', icon: FlaskConical, label: 'Experiments', end: false },
  { to: '/settings', icon: Settings, label: 'Settings', end: false },
]

export default function Sidebar() {
  const navigate = useNavigate()

  return (
    <aside className="w-60 min-h-screen bg-slate-900 flex flex-col flex-shrink-0">
      <div className="px-5 pt-5 pb-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-3 w-full text-left"
        >
          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
            F
          </div>
          <span className="text-white font-semibold text-sm">FLS Search</span>
        </button>

        <div className="mt-4 border-t border-slate-700" />

        <nav className="mt-3 flex flex-col gap-0.5">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-auto px-5 py-4 flex items-center gap-2.5">
        <img src="/nsf-logo.png" alt="NSF" className="w-7 h-7 opacity-70" />
        <span className="text-slate-500 text-xs">NSF Funded</span>
      </div>

      <div className="px-5 py-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
            R
          </div>
          <div>
            <p className="text-white text-xs font-medium">Researcher</p>
            <p className="text-slate-400 text-xs">NSF Lab</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
