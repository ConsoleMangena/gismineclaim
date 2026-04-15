import { useState, useEffect } from 'react'
import { disputesApi, analysisApi } from '../services/api'
import StatusBadge from '../components/StatusBadge'

export default function DisputesPage() {
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    runAutoDetection()
  }, [])

  async function fetchDisputes() {
    setLoading(true)
    try {
      const res = await disputesApi.list()
      const data = res.data
      const featuresArray = data.results?.features || data.features || data.results || data || []
      setDisputes(featuresArray)
    } catch {
      // API not available
    } finally {
      setLoading(false)
    }
  }

  async function runAutoDetection() {
    setDetecting(true)
    setMessage('')
    try {
      const res = await analysisApi.runConflictDetection()
      setMessage(res.data.message)
      await fetchDisputes()
    } catch {
      setMessage('Failed to auto-detect conflicts.')
      await fetchDisputes()
    } finally {
      setDetecting(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Disputes</h1>
      </div>

      {detecting && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Auto-detecting conflicts...
        </div>
      )}

      {message && (
        <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          {message}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : disputes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          No disputes found after automatic conflict scan.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Claim</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Parcel</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Conflict Area (ha)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Detected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {disputes.map((d) => {
                const props = d.properties || d
                return (
                  <tr key={props.id || d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{props.mine_claim_code}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{props.farm_parcel_code}</td>
                    <td className="px-4 py-3"><StatusBadge value={props.status} /></td>
                    <td className="px-4 py-3 text-sm text-slate-600">{props.conflict_area || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {props.detected_at ? new Date(props.detected_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
