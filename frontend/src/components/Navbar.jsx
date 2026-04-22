import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Map, Layers, AlertTriangle, Home, LogOut, ChevronDown, Shield, Settings } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const baseLinks = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/map', label: 'Map', icon: Map },
  { to: '/claims', label: 'Claims', icon: Layers },
  { to: '/disputes', label: 'Disputes', icon: AlertTriangle },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const links = user?.role === 'ADMIN'
    ? [...baseLinks, { to: '/admin', label: 'Admin', icon: Settings }]
    : baseLinks
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user
    ? ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')) || user.username[0].toUpperCase()
    : '?'

  return (
    <nav className="bg-slate-950 border-b border-slate-800 text-white px-6 py-0 flex items-center justify-between shadow-xl sticky top-0 z-50">
      {/* Brand */}
      <div className="flex items-center gap-3 py-3">
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-1.5 rounded-lg">
          <Map size={20} className="text-emerald-400" />
        </div>
        <div className="leading-tight">
          <span className="font-bold text-sm tracking-tight text-white">GIS MineClaim</span>
          <span className="block text-xs text-slate-500">Zimbabwe</span>
        </div>
      </div>

      {/* Nav Links */}
      <div className="flex gap-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </div>

      {/* User Menu */}
      <div className="relative py-3">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white">
            {initials}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-white leading-tight">
              {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
            </p>
            <div className="flex items-center gap-1">
              {user?.role === 'ADMIN' && <Shield size={11} className="text-amber-400" />}
              <p className="text-xs text-slate-400">{user?.role}</p>
            </div>
          </div>
          <ChevronDown size={14} className="text-slate-400" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-sm font-semibold text-white">
                  {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
                </p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                <span className={`mt-1 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                  user?.role === 'ADMIN'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {user?.role === 'ADMIN' && <Shield size={10} />}
                  {user?.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
              >
                <LogOut size={15} />
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </nav>
  )
}
