import { useState, useEffect, useRef } from 'react'
import MapView from '../components/MapView'
import { claimsApi, parcelsApi, disputesApi, mineDisputesApi, boundariesApi, trigStationsApi } from '../services/api'
import { Upload } from 'lucide-react'

export default function MapPage() {
  const [claims, setClaims] = useState(null)
  const [parcels, setParcels] = useState(null)
  const [disputes, setDisputes] = useState(null)
  const [mineDisputes, setMineDisputes] = useState(null)
  const [boundaries, setBoundaries] = useState(null)
  const [trigStations, setTrigStations] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const fetchTrigStations = async () => {
    try {
      const res = await trigStationsApi.list()
      setTrigStations(res.data)
    } catch {
      // API not available
    }
  }

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
        await fetchTrigStations()
      } catch {
        // API not available
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleUploadKml = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      await trigStationsApi.upload(formData)
      await fetchTrigStations()
    } catch (err) {
      alert('Failed to upload trig stations KML.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteTrig = async (id) => {
    if (!confirm('Are you sure you want to delete this trig station?')) return
    try {
      await trigStationsApi.delete(id)
      await fetchTrigStations()
    } catch {
      alert('Failed to delete trig station.')
    }
  }

  // Count open disputes
  const openDisputes = (disputes?.features || []).filter(f => f.properties?.status === 'OPEN').length
  const openMineDisputes = (mineDisputes?.features || []).filter(f => f.properties?.status === 'OPEN').length
  const totalOverlaps = openDisputes + openMineDisputes

  const hasTrigStations = trigStations?.features?.length > 0

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-white">Zimbabwe Conflict Map</h1>
          {totalOverlaps > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs font-semibold text-red-400 animate-pulse">
              ⚠ {totalOverlaps} active overlap{totalOverlaps !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          {!loading && (
            <>
              <input 
                type="file" 
                accept=".kml" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleUploadKml} 
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded hover:bg-blue-500/20 transition-colors disabled:opacity-50"
              >
                {uploading ? <span className="animate-pulse">Uploading...</span> : <><Upload size={14} /> Import Trig Stations (KML)</>}
              </button>
            </>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-yellow-500 opacity-80" /> Mine Claims
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-green-500 opacity-80" /> Farm Parcels
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-600 opacity-90 border border-red-400" /> Mine↔Mine Overlaps
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-500 opacity-90 border border-red-300" /> Mine↔Farm Overlaps
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
          <MapView claims={claims} parcels={parcels} disputes={disputes} mineDisputes={mineDisputes} boundaries={boundaries} trigStations={trigStations} onDeleteTrig={handleDeleteTrig} />
        )}
      </div>
    </div>
  )
}
