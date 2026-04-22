import { useState, useEffect } from 'react'
import MapView from '../components/MapView'
import { claimsApi, parcelsApi, disputesApi, mineDisputesApi, boundariesApi } from '../services/api'

export default function MapPage() {
  const [claims, setClaims] = useState(null)
  const [parcels, setParcels] = useState(null)
  const [disputes, setDisputes] = useState(null)
  const [mineDisputes, setMineDisputes] = useState(null)
  const [boundaries, setBoundaries] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [claimsRes, parcelsRes, disputesRes, mineDisputesRes, boundariesRes] = await Promise.all([
          claimsApi.list({ page_size: 1000 }),
          parcelsApi.list({ page_size: 1000 }),
          disputesApi.list({ page_size: 1000 }),
          mineDisputesApi.list({ page_size: 1000 }),
          boundariesApi.list({ page_size: 100 }),
        ])
        setClaims(claimsRes.data.results || claimsRes.data)
        setParcels(parcelsRes.data.results || parcelsRes.data)
        setDisputes(disputesRes.data.results || disputesRes.data)
        setMineDisputes(mineDisputesRes.data.results || mineDisputesRes.data)
        setBoundaries(boundariesRes.data.results || boundariesRes.data)
      } catch {
        // API not available
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <h1 className="text-base font-semibold text-white">Zimbabwe Conflict Map</h1>
        <div className="flex gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-yellow-500 opacity-80" /> Mine Claims
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-green-500 opacity-80" /> Farm Parcels
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-600 opacity-90" /> Mine↔Mine Disputes
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-orange-500 opacity-90" /> Mine↔Farm Disputes
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-indigo-400 opacity-70" /> Provinces
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 gap-3">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            Loading Zimbabwe map data...
          </div>
        ) : (
          <MapView claims={claims} parcels={parcels} disputes={disputes} mineDisputes={mineDisputes} boundaries={boundaries} />
        )}
      </div>
    </div>
  )
}
