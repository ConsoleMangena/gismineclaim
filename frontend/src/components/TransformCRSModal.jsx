import { useState } from 'react'
import { X, ArrowRightLeft, Check, AlertTriangle, Search, Globe } from 'lucide-react'
import { transformGeometry, CRS_OPTIONS, isCrsSupported, fetchEpsgDefinition } from '../services/crsTransform'

/**
 * Modal that lets the user pick a target CRS (preset or custom EPSG)
 * and preview the transformed coordinates before saving.
 */
export default function TransformCRSModal({ feature, onClose, onSave }) {
  const fromCRS = feature.coordinate_system || 'WGS84'
  const [toCRS, setToCRS] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [customCode, setCustomCode] = useState('')
  const [customName, setCustomName] = useState('')
  const [customLoading, setCustomLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSelectChange = (e) => {
    const val = e.target.value
    if (val === '__custom__') {
      setUseCustom(true)
      setToCRS('')
      setCustomCode('')
      setCustomName('')
    } else {
      setUseCustom(false)
      setToCRS(val)
      setCustomCode('')
      setCustomName('')
    }
    setPreview(null)
    setError('')
  }

  const handleLookupEpsg = async () => {
    if (!customCode.trim()) { setError('Enter an EPSG code (e.g. 32736).'); return }
    setCustomLoading(true)
    setError('')
    setCustomName('')
    try {
      const result = await fetchEpsgDefinition(customCode.trim())
      const key = `EPSG:${customCode.trim().replace(/\D/g, '')}`
      setToCRS(key)
      setCustomName(result.name)
    } catch (err) {
      setError(err.message || 'Failed to look up EPSG code.')
      setToCRS('')
    } finally {
      setCustomLoading(false)
    }
  }

  const handlePreview = () => {
    setError('')
    setPreview(null)
    if (!toCRS) { setError('Please select or look up a target CRS.'); return }
    if (toCRS === fromCRS) { setError('Target CRS is the same as the source.'); return }
    if (!feature.geometry) { setError('This record has no geometry to transform.'); return }
    if (!isCrsSupported(fromCRS)) { setError(`Source CRS "${fromCRS}" is not supported. Try setting a known CRS first.`); return }

    try {
      const transformed = transformGeometry(feature.geometry, fromCRS, toCRS)
      setPreview(transformed)
    } catch (err) {
      setError(err.message || 'Transformation failed.')
    }
  }

  const handleSave = async () => {
    if (!preview) return
    setSaving(true)
    try {
      await onSave({
        geom: preview,
        coordinate_system: toCRS,
      })
      onClose()
    } catch {
      setError('Failed to save transformed coordinates.')
    } finally {
      setSaving(false)
    }
  }

  // Flatten preview coords for display
  const getDisplayCoords = (geom) => {
    if (!geom?.coordinates) return []
    const { type, coordinates: coords } = geom
    if (type === 'Point') return [coords]
    if (type === 'LineString') return coords
    if (type === 'Polygon') return coords[0] || []
    if (type === 'MultiPolygon') return coords.flatMap(p => p[0] || [])
    return []
  }

  const sourceCoords = getDisplayCoords(feature.geometry)
  const targetCoords = preview ? getDisplayCoords(preview) : []

  const isProjected = (crs) => {
    if (!crs) return false
    // Known projected CRS
    if (['UTM36S', 'EPSG:32736', 'EPSG:32735', 'EPSG:20936'].includes(crs)) return true
    // Heuristic: UTM zones are projected
    const num = parseInt(crs.replace(/\D/g, ''), 10)
    if (num >= 32600 && num <= 32760) return true
    if (num >= 20000 && num <= 20999) return true
    return false
  }
  const srcIsProj = isProjected(fromCRS)
  const tgtIsProj = toCRS ? isProjected(toCRS) : false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-violet-400" />
            <h3 className="text-base font-bold text-white">Transform Coordinate System</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Record info */}
          <div className="bg-slate-800/50 rounded-lg p-3 text-sm text-slate-300 space-y-1">
            <p><strong className="text-white">{feature.claim_code || feature.parcel_code}</strong> — {feature.claim_name || feature.farm_name || '—'}</p>
            <p>Current CRS: <span className="text-emerald-400 font-semibold">{fromCRS}</span></p>
          </div>

          {/* Target CRS selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Transform To</label>
            <select
              value={useCustom ? '__custom__' : toCRS}
              onChange={handleSelectChange}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="" className="bg-slate-800">— Select target CRS —</option>
              {CRS_OPTIONS.filter(o => o.value !== fromCRS).map(o => (
                <option key={o.value} value={o.value} className="bg-slate-800">{o.label}</option>
              ))}
              <option value="__custom__" className="bg-slate-800">✦ Custom EPSG Code…</option>
            </select>
          </div>

          {/* Custom EPSG input */}
          {useCustom && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-violet-400 font-semibold">
                <Globe size={15} /> Enter Custom EPSG Code
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-mono">EPSG:</span>
                  <input
                    type="text"
                    value={customCode}
                    onChange={(e) => { setCustomCode(e.target.value); setCustomName(''); setPreview(null); setError('') }}
                    placeholder="e.g. 32736"
                    className="w-full pl-16 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-mono placeholder-slate-500 outline-none focus:border-violet-500 transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && handleLookupEpsg()}
                  />
                </div>
                <button
                  onClick={handleLookupEpsg}
                  disabled={customLoading || !customCode.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {customLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Search size={14} />
                  )}
                  {customLoading ? 'Looking up…' : 'Look Up'}
                </button>
              </div>
              {customName && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-emerald-400">
                  <Check size={14} />
                  <span>Found: <strong>{customName}</strong> ({toCRS})</span>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Definitions are fetched from <span className="font-mono">epsg.io</span>. Enter just the numeric code.
              </p>
            </div>
          )}

          {/* Preview button */}
          <button
            onClick={handlePreview}
            disabled={!toCRS}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowRightLeft size={15} /> Preview Transformation
          </button>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-400">
              <AlertTriangle size={15} /> {error}
            </div>
          )}

          {/* Preview table */}
          {preview && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-300">
                Coordinate Preview
                <span className="ml-2 text-xs text-slate-500 font-normal">{fromCRS} → {toCRS}</span>
              </h4>
              <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-700/50">
                      <th className="px-3 py-2 text-left text-slate-400 font-semibold">#</th>
                      <th className="px-3 py-2 text-left text-slate-400 font-semibold">
                        Source {srcIsProj ? 'Easting (m)' : 'Longitude'}
                      </th>
                      <th className="px-3 py-2 text-left text-slate-400 font-semibold">
                        Source {srcIsProj ? 'Northing (m)' : 'Latitude'}
                      </th>
                      <th className="px-3 py-2 text-left text-emerald-400 font-semibold">→</th>
                      <th className="px-3 py-2 text-left text-emerald-400 font-semibold">
                        Target {tgtIsProj ? 'Easting (m)' : 'Longitude'}
                      </th>
                      <th className="px-3 py-2 text-left text-emerald-400 font-semibold">
                        Target {tgtIsProj ? 'Northing (m)' : 'Latitude'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {sourceCoords.slice(0, 30).map((c, i) => (
                      <tr key={i} className="hover:bg-slate-700/30">
                        <td className="px-3 py-1.5 font-medium text-slate-500">{i + 1}</td>
                        <td className="px-3 py-1.5 font-mono text-slate-300">{c[0]?.toFixed(srcIsProj ? 2 : 6)}</td>
                        <td className="px-3 py-1.5 font-mono text-slate-300">{c[1]?.toFixed(srcIsProj ? 2 : 6)}</td>
                        <td className="px-3 py-1.5 text-emerald-500">→</td>
                        <td className="px-3 py-1.5 font-mono text-emerald-300">{targetCoords[i]?.[0]?.toFixed(tgtIsProj ? 2 : 6)}</td>
                        <td className="px-3 py-1.5 font-mono text-emerald-300">{targetCoords[i]?.[1]?.toFixed(tgtIsProj ? 2 : 6)}</td>
                      </tr>
                    ))}
                    {sourceCoords.length > 30 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-2 text-center text-slate-500 italic">
                          …and {sourceCoords.length - 30} more points
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Check size={16} />
                )}
                {saving ? 'Saving…' : 'Apply Transformation & Save'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
