import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Map, Layers, AlertTriangle, Shield, Flame, CheckCircle, Crosshair,
  Download, FileText, TreePine, ArrowRight,
} from 'lucide-react'
import api, { reportsApi, disputesApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [recentDisputes, setRecentDisputes] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, disputesRes] = await Promise.all([
        reportsApi.summary(),
        disputesApi.list({ page: 1, page_size: 5 }),
      ])
      setStats(summaryRes.data)
      setRecentDisputes(
        (disputesRes.data?.results?.features || []).map((f) => ({
          id: f.id,
          ...f.properties,
        }))
      )
    } catch {
      setStats({
        total_mine_claims: 0,
        total_farm_parcels: 0,
        total_disputes: 0,
        open_disputes: 0,
        resolved_disputes: 0,
        total_hotspots: 0,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const tiles = stats
    ? [
        { label: 'Mine Claims', value: stats.total_mine_claims, icon: Layers, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', to: '/claims' },
        { label: 'Farm Parcels', value: stats.total_farm_parcels, icon: TreePine, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', to: '/claims' },
        { label: 'Total Disputes', value: stats.total_disputes, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', to: '/disputes' },
        { label: 'Open Disputes', value: stats.open_disputes, icon: Crosshair, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', to: '/disputes' },
        { label: 'Resolved', value: stats.resolved_disputes, icon: CheckCircle, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20', to: '/disputes' },
        { label: 'Hotspots', value: stats.total_hotspots, icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', to: '/map' },
      ]
    : []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Welcome back, {user?.first_name || user?.username || 'User'}
          </p>
        </div>
        <Link
          to="/map"
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-500 transition-all"
        >
          <Map size={16} />
          Open Map
        </Link>
      </div>

      {/* Stat Tiles */}
      {loading ? (
        <div className="flex items-center justify-center p-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <span className="ml-3 text-slate-400">Loading metrics...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {tiles.map((tile) => (
            <Link
              key={tile.label}
              to={tile.to}
              className={`rounded-xl border ${tile.border} bg-slate-900 p-4 hover:bg-slate-800 transition-all duration-200 group`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${tile.bg}`}>
                  <tile.icon size={18} className={tile.color} />
                </div>
                <ArrowRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
              </div>
              <div className="text-2xl font-bold text-white">{tile.value}</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">{tile.label}</div>
            </Link>
          ))}
        </div>
      )}

      {/* Recent Disputes */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <AlertTriangle size={18} className="text-amber-400" />
              </div>
              <h2 className="text-base font-bold text-white">Recent Disputes</h2>
            </div>
            <Link to="/disputes" className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
              View all &rarr;
            </Link>
          </div>
          <div className="divide-y divide-slate-800">
            {recentDisputes.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-500">
                No disputes detected yet. Run conflict detection to find overlaps.
              </div>
            ) : (
              recentDisputes.map((d) => (
                <div key={d.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${d.status === 'OPEN' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        {d.mine_claim_code} vs {d.farm_parcel_code}
                      </p>
                      <p className="text-xs text-slate-500">
                        {d.conflict_area ? `${Number(d.conflict_area).toFixed(4)} ha` : '—'} &middot; {d.detected_at ? new Date(d.detected_at).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    d.status === 'OPEN'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {d.status}
                  </span>
                </div>
              ))
            )}
          </div>
      </div>

      {/* Export & Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ExportButton url="/reports/disputes/csv/" filename="disputes_report.csv" icon={Download} iconBg="bg-sky-500/10" iconColor="text-sky-400" label="Export Disputes" />
        <ExportButton url="/reports/mine-claims/csv/" filename="mine_claims_report.csv" icon={FileText} iconBg="bg-rose-500/10" iconColor="text-rose-400" label="Export Mine Claims" />
        <ExportButton url="/reports/farm-parcels/csv/" filename="farm_parcels_report.csv" icon={TreePine} iconBg="bg-emerald-500/10" iconColor="text-emerald-400" label="Export Farm Parcels" />
      </div>
    </div>
  )
}

function ExportButton({ url, filename, icon: Icon, iconBg, iconColor, label }) {
  const [downloading, setDownloading] = useState(false)
  const toast = useToast()

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await api.get(url, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'text/csv' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      link.click()
      URL.revokeObjectURL(link.href)
      toast.success(`${label} downloaded.`)
    } catch {
      toast.error('Failed to download report.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-3 px-5 py-4 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-all text-left disabled:opacity-50"
    >
      <div className={`p-2 ${iconBg} rounded-lg`}>
        {downloading
          ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          : <Icon size={16} className={iconColor} />
        }
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-slate-500">Download CSV report</p>
      </div>
    </button>
  )
}
