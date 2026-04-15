import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Map, Layers, AlertTriangle, Shield, UploadCloud, FileText, Database } from 'lucide-react'
import { claimsApi, parcelsApi, disputesApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    claims: 0,
    parcels: 0,
    disputes: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [claimsRes, parcelsRes, disputesRes] = await Promise.all([
          claimsApi.list({ page: 1 }),
          parcelsApi.list({ page: 1 }),
          disputesApi.list({ page: 1 }),
        ])
        setStats({
          claims: claimsRes.data.count || 0,
          parcels: parcelsRes.data.count || 0,
          disputes: disputesRes.data.count || 0,
        })
      } catch {
        // API not available yet — show zeros
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const cards = [
    { label: 'Mine Claims', value: stats.claims, icon: Layers, color: 'text-red-500', bg: 'bg-red-50', to: '/claims' },
    { label: 'Farm Parcels', value: stats.parcels, icon: Shield, color: 'text-green-500', bg: 'bg-green-50', to: '/claims' },
    { label: 'Active Disputes', value: stats.disputes, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', to: '/disputes' },
    { label: 'View Map', value: '→', icon: Map, color: 'text-blue-500', bg: 'bg-blue-50', to: '/map' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Dashboard Overview</h1>
        {loading === false && (
          <div className="text-sm text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
            Welcome back, {user?.first_name || user?.username || 'User'}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          <span className="ml-3 text-slate-500">Loading metrics...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <Link
              key={card.label}
              to={card.to}
              className="block rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-1 bg-white relative overflow-hidden group"
            >
              <div className="flex items-center justify-between mb-4 relative z-10">
                <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{card.label}</span>
                <div className={`p-3 rounded-xl ${card.bg}`}>
                  <card.icon size={22} className={card.color} />
                </div>
              </div>
              <div className="text-4xl font-extrabold text-slate-800 tracking-tight relative z-10">{card.value}</div>
              {/* Fixed missing map element inside cards */}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        
        {/* Quick Actions Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
             <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Map size={20} />
             </div>
            <h2 className="text-xl font-bold text-slate-800">Quick Actions</h2>
          </div>
          <div className="p-6 flex-1 flex flex-col gap-4 bg-slate-50/50">
            <Link
              to="/map"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold shadow hover:bg-emerald-700 hover:shadow-md transition-all active:scale-[0.98]"
            >
              <Map size={18} />
              Open Interactive Map
            </Link>
            <Link
              to="/disputes"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 text-white rounded-xl text-sm font-semibold shadow hover:bg-amber-700 hover:shadow-md transition-all active:scale-[0.98]"
            >
              <AlertTriangle size={18} />
              Review Dispute Conflicts
            </Link>
          </div>
        </div>

        {/* Administration Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Database size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Administration</h2>
          </div>
          <div className="p-6 flex-1 flex flex-col gap-4 bg-slate-50/50">
            
            <p className="text-sm text-slate-600 mb-2">
              Access the backend to manage boundaries, upload bulk GIS shapes, and manage user accounts and approvals.
            </p>

            {user?.role === 'ADMIN' && (
              <>
                <a
                  href="http://127.0.0.1:8000/admin/spatial_data/mineclaim/"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold shadow-sm hover:bg-slate-50 hover:text-blue-600 transition-all active:scale-[0.98]"
                >
                  <UploadCloud size={18} />
                  Upload Boundaries
                </a>
               
                <a
                  href="http://127.0.0.1:8000/admin/users/user/"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-xl text-sm font-semibold shadow hover:bg-slate-900 transition-all active:scale-[0.98]"
                >
                  <Shield size={18} />
                  Manage User Accounts & Approvals
                </a>
              </>
            )}
           
          </div>
        </div>

      </div>
    </div>
  )
}
