import { useState, useRef } from 'react'
import { Upload, FileCheck, AlertCircle, X } from 'lucide-react'
import shp from 'shpjs'
import { kml as kmlToGeoJSON } from '@tmcw/togeojson'

const ACCEPT = '.geojson,.json,.zip,.kml,.gpx,.shp'
const FORMATS = 'GeoJSON, Shapefile (.zip), KML, GPX'

function extractFirstGeometry(geojson) {
  if (!geojson) return null

  if (geojson.type === 'FeatureCollection' && geojson.features?.length > 0) {
    return geojson.features[0].geometry
  }
  if (geojson.type === 'Feature') {
    return geojson.geometry
  }
  if (['Polygon', 'MultiPolygon', 'Point', 'LineString', 'MultiPoint', 'MultiLineString', 'GeometryCollection'].includes(geojson.type)) {
    return geojson
  }
  return null
}

async function parseGeoJSON(file) {
  const text = await file.text()
  const parsed = JSON.parse(text)
  return extractFirstGeometry(parsed)
}

async function parseShapefile(file) {
  const buffer = await file.arrayBuffer()
  const parsed = await shp(buffer)
  return extractFirstGeometry(parsed)
}

async function parseKML(file) {
  const text = await file.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/xml')
  const converted = kmlToGeoJSON(doc)
  return extractFirstGeometry(converted)
}

async function parseGPX(file) {
  const { gpx: gpxToGeoJSON } = await import('@tmcw/togeojson')
  const text = await file.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/xml')
  const converted = gpxToGeoJSON(doc)
  return extractFirstGeometry(converted)
}

async function parseFile(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.geojson') || name.endsWith('.json')) return parseGeoJSON(file)
  if (name.endsWith('.zip') || name.endsWith('.shp')) return parseShapefile(file)
  if (name.endsWith('.kml')) return parseKML(file)
  if (name.endsWith('.gpx')) return parseGPX(file)
  throw new Error('Unsupported file format.')
}

export default function GeoFileUpload({ value, onChange }) {
  const [status, setStatus] = useState(null) // null | 'success' | 'error'
  const [message, setMessage] = useState('')
  const [fileName, setFileName] = useState('')
  const inputRef = useRef(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setStatus(null)
    setMessage('')

    try {
      const geometry = await parseFile(file)
      if (!geometry) throw new Error('No geometry found in file.')
      onChange(JSON.stringify(geometry))
      setStatus('success')
      setMessage(`${geometry.type} extracted from ${file.name}`)
    } catch (err) {
      setStatus('error')
      setMessage(err.message || 'Failed to parse file.')
      onChange('')
    }

    if (inputRef.current) inputRef.current.value = ''
  }

  const handleClear = () => {
    onChange('')
    setStatus(null)
    setMessage('')
    setFileName('')
  }

  const hasGeometry = value && value.length > 2

  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">Geometry</label>

      {/* Upload Zone */}
      <label className="flex items-center justify-center gap-3 px-4 py-4 bg-slate-800 border border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-emerald-500 hover:bg-slate-800/80 transition-colors">
        <Upload size={18} className="text-slate-400" />
        <div className="text-sm">
          <span className="text-emerald-400 font-medium">Upload GIS file</span>
          <span className="text-slate-500 ml-1">— {FORMATS}</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFile}
          className="hidden"
        />
      </label>

      {/* Status Message */}
      {status && (
        <div className={`flex items-center gap-2 mt-2 text-xs font-medium ${
          status === 'success' ? 'text-emerald-400' : 'text-red-400'
        }`}>
          {status === 'success' ? <FileCheck size={14} /> : <AlertCircle size={14} />}
          {message}
        </div>
      )}

      {/* Geometry Preview / Manual Edit */}
      <div className="mt-2 relative">
        <textarea
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition-colors h-20 font-mono"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setStatus(null)
            setMessage('')
          }}
          placeholder='Or paste GeoJSON geometry, e.g. {"type":"Polygon","coordinates":[[[29.8,-19.4],...]]}'
        />
        {hasGeometry && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 p-1 bg-slate-700 rounded hover:bg-slate-600 transition-colors"
            title="Clear geometry"
          >
            <X size={12} className="text-slate-400" />
          </button>
        )}
      </div>
    </div>
  )
}
