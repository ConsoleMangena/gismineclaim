import { useState, useEffect } from 'react'
import { AlertTriangle, Crosshair, Filter } from 'lucide-react'
import { disputesApi, analysisApi } from '../services/api'

const STATUS_COLORS = {
  OPEN: 'bg-red-500/10 text-red-400 border border-red-500/20',
  RESOLVED: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [message, setMessage] = useState(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    fetchDisputes()
  }, [filter])

  async function fetchDisputes() {
    setLoading(true)
    try {
      const params = { page_size: 100 }
      if (filter) params.status = filter
      const res = await disputesApi.list(params)
      const features = res.data?.results?.features || []
      setDisputes(features.map((f) => ({ id: f.id, ...f.properties })))
    } catch {
      setDisputes([])
    } finally {
      setLoading(false)
    }
  }

  async function runDetection() {
    setDetecting(true)
    setMessage(null)
    try {
      const res = await analysisApi.runConflictDetection()
      setMessage({ type: 'success', text: res.data.message })
      fetchDisputes()
    } catch {
      setMessage({ type: 'error', text: 'Failed to run conflict detection. Make sure spatial data exists.' })
    } finally {
      setDetecting(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <AlertTriangle size={20} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Disputes</h1>
            <p className="text-sm text-slate-400">Land conflict records between mine claims and farm parcels</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
            <Filter size={14} className="text-slate-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-transparent text-sm text-white outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-900">All statuses</option>
              <option value="OPEN" className="bg-slate-900">Open</option>
              <option value="RESOLVED" className="bg-slate-900">Resolved</option>
            </select>
          </div>
          {/* Run Detection Button */}
          <button
            onClick={runDetection}
            disabled={detecting}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {detecting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Crosshair size={16} />
            )}
            Detect Conflicts
          </button>
        </div>
      </div>

      {/* Action Result Banner */}
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs opacity-60 hover:opacity-100">dismiss</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center p-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <span className="ml-3 text-slate-400">Loading disputes...</span>
        </div>
      ) : disputes.length === 0 ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-10 text-center">
          <AlertTriangle size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            {filter ? `No ${filter.toLowerCase()} disputes found.` : 'No disputes found. Click "Detect Conflicts" to scan for overlaps.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-800">
            <thead>
              <tr className="bg-slate-800/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Mine Claim</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Farm Parcel</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Conflict Area</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Detected</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {disputes.map((d) => (
                <tr key={d.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-white">{d.mine_claim_code}</td>
                  <td className="px-5 py-3 text-sm text-slate-300">{d.farm_parcel_code}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[d.status] || 'bg-slate-700 text-slate-300'}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-300">
                    {d.conflict_area ? `${Number(d.conflict_area).toFixed(4)} ha` : '—'}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-400">
                    {d.detected_at ? new Date(d.detected_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-400">
                    {d.resolved_at ? new Date(d.resolved_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-slate-800 text-xs text-slate-500">
            Showing {disputes.length} dispute{disputes.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
