import { useState, useEffect } from 'react'
import { claimsApi } from '../services/api'
import StatusBadge from '../components/StatusBadge'

export default function ClaimsPage() {
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchClaims() {
      try {
        const res = await claimsApi.list()
        const data = res.data
        const featuresArray = data.results?.features || data.features || []
        setClaims(featuresArray)
      } catch {
        // API not available
      } finally {
        setLoading(false)
      }
    }
    fetchClaims()
  }, [])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Mine Claims</h1>

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : claims.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          No mine claims found. Add claims via the backend API.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Claim Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Area (ha)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {claims.map((claim) => {
                const props = claim.properties || claim
                return (
                  <tr key={props.id || claim.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{props.claim_code}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{props.owner_name}</td>
                    <td className="px-4 py-3"><StatusBadge value={props.status} /></td>
                    <td className="px-4 py-3 text-sm text-slate-600">{props.area || '—'}</td>
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
