import { useState, useEffect } from 'react'
import { Layers, Filter } from 'lucide-react'
import { claimsApi, parcelsApi } from '../services/api'

const STATUS_COLORS = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  EXPIRED: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  DISPUTED: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  REVOKED: 'bg-red-500/10 text-red-400 border border-red-500/20',
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState([])
  const [parcels, setParcels] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('claims')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
        const [claimsRes, parcelsRes] = await Promise.all([
          claimsApi.list({ page_size: 200 }),
          parcelsApi.list({ page_size: 200 }),
        ])
        setClaims((claimsRes.data?.results?.features || []).map((f) => ({ id: f.id, ...f.properties })))
        setParcels((parcelsRes.data?.results?.features || []).map((f) => ({ id: f.id, ...f.properties })))
      } catch {
        // API not available
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredClaims = statusFilter ? claims.filter((c) => c.status === statusFilter) : claims

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-500/10 rounded-lg">
            <Layers size={20} className="text-rose-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Claims & Parcels</h1>
            <p className="text-sm text-slate-400">Registered mine claims and farm parcels</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Tab toggle */}
          <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5">
            <button onClick={() => setTab('claims')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${tab === 'claims' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              Mine Claims ({claims.length})
            </button>
            <button onClick={() => setTab('parcels')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${tab === 'parcels' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              Farm Parcels ({parcels.length})
            </button>
          </div>
          {tab === 'claims' && (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
              <Filter size={14} className="text-slate-400" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent text-sm text-white outline-none cursor-pointer">
                <option value="" className="bg-slate-900">All statuses</option>
                <option value="ACTIVE" className="bg-slate-900">Active</option>
                <option value="EXPIRED" className="bg-slate-900">Expired</option>
                <option value="DISPUTED" className="bg-slate-900">Disputed</option>
                <option value="REVOKED" className="bg-slate-900">Revoked</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <span className="ml-3 text-slate-400">Loading data...</span>
        </div>
      ) : tab === 'claims' ? (
        /* Mine Claims Table */
        filteredClaims.length === 0 ? (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-10 text-center">
            <Layers size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">{statusFilter ? `No ${statusFilter.toLowerCase()} claims found.` : 'No mine claims found.'}</p>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead>
                <tr className="bg-slate-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Claim Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Claim Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Reg No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Mine Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Owner</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">District</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Area (ha)</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">CRS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Surveyor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Survey Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredClaims.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-white whitespace-nowrap">{c.claim_code}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{c.claim_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{c.claim_reg_no || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{c.mine_type || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">{c.owner_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{c.district || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[c.status] || 'bg-slate-700 text-slate-300'}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{c.area || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{c.coordinate_system || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{c.surveyor || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">{c.surveyed_date ? new Date(c.surveyed_date).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-500">
              Showing {filteredClaims.length} claim{filteredClaims.length !== 1 ? 's' : ''}
            </div>
          </div>
        )
      ) : (
        /* Farm Parcels Table */
        parcels.length === 0 ? (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-10 text-center">
            <Layers size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No farm parcels found.</p>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead>
                <tr className="bg-slate-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Parcel Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Farm Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Deed No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Lease/Offer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Owner</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Land Use</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Area (ha)</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">CRS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Surveyor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Survey Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {parcels.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-white whitespace-nowrap">{p.parcel_code}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{p.farm_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{p.deed_no || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{p.lease_type || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">{p.owner_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{p.land_use || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{p.area || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{p.coordinate_system || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{p.surveyor || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">{p.survey_date ? new Date(p.survey_date).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-500">
              Showing {parcels.length} parcel{parcels.length !== 1 ? 's' : ''}
            </div>
          </div>
        )
      )}
    </div>
  )
}
