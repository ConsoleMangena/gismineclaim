import { MapContainer, TileLayer, GeoJSON, LayersControl, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Kwekwe district centre — zoomed out to show outskirt mining/farm areas
const INITIAL_CENTER = [-18.93, 29.78]
const INITIAL_ZOOM = 10

const trigIcon = L.divIcon({
  className: 'custom-trig-icon',
  html: `<div style="
    width: 0; 
    height: 0; 
    border-left: 8px solid transparent; 
    border-right: 8px solid transparent; 
    border-bottom: 14px solid #3b82f6; 
    filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.4));
  "></div>`,
  iconSize: [16, 14],
  iconAnchor: [8, 14],
  popupAnchor: [0, -14],
})

const claimStyle = (feature) => {
  const isDis = feature.properties?.status === 'DISPUTED'
  return {
    color: isDis ? '#f97316' : '#eab308',
    weight: isDis ? 3 : 2,
    fillOpacity: isDis ? 0.45 : 0.35,
    fillColor: isDis ? '#f97316' : '#eab308',
    dashArray: isDis ? '6,3' : undefined,
  }
}
const parcelStyle = { color: '#22c55e', weight: 2, fillOpacity: 0.3 }

// Dispute overlap styles — bright red, high visibility
const mineFarmDisputeStyle = {
  color: '#dc2626',
  weight: 3,
  fillOpacity: 0.55,
  fillColor: '#ef4444',
  dashArray: '5,5',
}
const mineMineDisputeStyle = {
  color: '#b91c1c',
  weight: 3,
  fillOpacity: 0.60,
  fillColor: '#dc2626',
  dashArray: '4,4',
}
const boundaryStyle = { color: '#818cf8', weight: 1.5, fillOpacity: 0.08, dashArray: '8,4' }

function filterValid(geojson) {
  if (!geojson?.features) return null
  const valid = geojson.features.filter((f) => f.geometry)
  return valid.length > 0 ? { ...geojson, features: valid } : null
}

function formatArea(val) {
  if (val == null) return '—'
  const n = Number(val)
  if (n < 0.01) return `${(n * 10000).toFixed(1)} m²`
  return `${n.toFixed(4)} ha`
}

function mineFarmPopup(feature, layer) {
  const p = feature.properties
  layer.bindPopup(
    `<div style="font-family:system-ui; min-width:180px;">` +
    `<div style="font-weight:700; color:#dc2626; font-size:13px; margin-bottom:6px; border-bottom:2px solid #fca5a5; padding-bottom:4px;">⚠ Mine ↔ Farm Overlap</div>` +
    `<table style="font-size:12px; line-height:1.6;">` +
    `<tr><td style="color:#64748b; padding-right:8px;">Mine Claim:</td><td style="font-weight:600;">${p.mine_claim_code}</td></tr>` +
    `<tr><td style="color:#64748b;">Farm Parcel:</td><td style="font-weight:600;">${p.farm_parcel_code}</td></tr>` +
    `<tr><td style="color:#64748b;">Overlap Area:</td><td style="color:#dc2626; font-weight:700;">${formatArea(p.conflict_area)}</td></tr>` +
    `<tr><td style="color:#64748b;">Status:</td><td><span style="display:inline-block; padding:1px 8px; border-radius:9999px; font-size:11px; font-weight:600; ${p.status === 'OPEN' ? 'background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;' : 'background:#f0fdf4;color:#16a34a;border:1px solid #86efac;'}">${p.status}</span></td></tr>` +
    `<tr><td style="color:#64748b;">Detected:</td><td>${p.detected_at ? new Date(p.detected_at).toLocaleDateString() : '—'}</td></tr>` +
    `</table></div>`
  )
}

function mineMinePopup(feature, layer) {
  const p = feature.properties
  layer.bindPopup(
    `<div style="font-family:system-ui; min-width:180px;">` +
    `<div style="font-weight:700; color:#b91c1c; font-size:13px; margin-bottom:6px; border-bottom:2px solid #fca5a5; padding-bottom:4px;">⛏ Mine ↔ Mine Overlap</div>` +
    `<table style="font-size:12px; line-height:1.6;">` +
    `<tr><td style="color:#64748b; padding-right:8px;">Claim A:</td><td style="font-weight:600;">${p.mine_claim_a_code}</td></tr>` +
    `<tr><td style="color:#64748b;">Claim B:</td><td style="font-weight:600;">${p.mine_claim_b_code}</td></tr>` +
    `<tr><td style="color:#64748b;">Overlap Area:</td><td style="color:#dc2626; font-weight:700;">${formatArea(p.conflict_area)}</td></tr>` +
    `<tr><td style="color:#64748b;">Status:</td><td><span style="display:inline-block; padding:1px 8px; border-radius:9999px; font-size:11px; font-weight:600; ${p.status === 'OPEN' ? 'background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;' : 'background:#f0fdf4;color:#16a34a;border:1px solid #86efac;'}">${p.status}</span></td></tr>` +
    `<tr><td style="color:#64748b;">Detected:</td><td>${p.detected_at ? new Date(p.detected_at).toLocaleDateString() : '—'}</td></tr>` +
    `</table></div>`
  )
}

function claimPopup(feature, layer) {
  const p = feature.properties
  layer.bindPopup(
    `<div style="font-family:system-ui;">` +
    `<strong>${p.claim_code}</strong><br/>` +
    `Owner: ${p.owner_name}<br/>` +
    `Area: ${p.area ?? '—'} ha<br/>` +
    `CRS: ${p.coordinate_system || '—'}<br/>` +
    `<span style="color:${p.status === 'ACTIVE' ? '#22c55e' : p.status === 'DISPUTED' ? '#f97316' : '#ef4444'}">● ${p.status}</span>` +
    `</div>`
  )
}

export default function MapView({ claims, parcels, disputes, mineDisputes, boundaries, trigStations, onDeleteTrig }) {
  const validClaims = filterValid(claims)
  const validParcels = filterValid(parcels)
  const validDisputes = filterValid(disputes)
  const validMineDisputes = filterValid(mineDisputes)
  const validBoundaries = filterValid(boundaries)
  const validTrigStations = filterValid(trigStations)

  return (
    <MapContainer center={INITIAL_CENTER} zoom={INITIAL_ZOOM} className="h-full w-full rounded-lg">
      {/* Custom CSS for animated overlap glow */}
      <style>{`
        .leaflet-overlay-pane .dispute-overlay path {
          filter: drop-shadow(0 0 6px rgba(220, 38, 38, 0.6));
          animation: dispute-pulse 2s ease-in-out infinite;
        }
        @keyframes dispute-pulse {
          0%, 100% { fill-opacity: 0.45; }
          50% { fill-opacity: 0.70; }
        }
      `}</style>

      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="OpenStreetMap">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite (Esri)">
          <TileLayer
            attribution='&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Terrain (OpenTopoMap)">
          <TileLayer
            attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors'
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        {validBoundaries && (
          <LayersControl.Overlay checked name="Province Boundaries">
            <GeoJSON
              key={'b-' + validBoundaries.features.length}
              data={validBoundaries}
              style={boundaryStyle}
              onEachFeature={(feature, layer) => {
                layer.bindPopup(`<strong>${feature.properties.name}</strong><br/>${feature.properties.boundary_type}`)
              }}
            />
          </LayersControl.Overlay>
        )}
        {validClaims && (
          <LayersControl.Overlay checked name="Mine Claims">
            <GeoJSON
              key={'c-' + validClaims.features.length}
              data={validClaims}
              style={claimStyle}
              onEachFeature={claimPopup}
            />
          </LayersControl.Overlay>
        )}
        {validParcels && (
          <LayersControl.Overlay checked name="Farm Parcels">
            <GeoJSON
              key={'p-' + validParcels.features.length}
              data={validParcels}
              style={parcelStyle}
              onEachFeature={(feature, layer) => {
                layer.bindPopup(
                  `<strong>${feature.properties.parcel_code}</strong><br/>` +
                  `Owner: ${feature.properties.owner_name}<br/>` +
                  `Land Use: ${feature.properties.land_use || '—'}<br/>` +
                  `Area: ${feature.properties.area ?? '—'} ha<br/>` +
                  `CRS: ${feature.properties.coordinate_system || '—'}`
                )
              }}
            />
          </LayersControl.Overlay>
        )}
        {validMineDisputes && (
          <LayersControl.Overlay checked name="⚠ Mine ↔ Mine Overlaps">
            <GeoJSON
              key={'mmd-' + validMineDisputes.features.length}
              data={validMineDisputes}
              style={mineMineDisputeStyle}
              className="dispute-overlay"
              onEachFeature={mineMinePopup}
            />
          </LayersControl.Overlay>
        )}
        {validDisputes && (
          <LayersControl.Overlay checked name="⚠ Mine ↔ Farm Overlaps">
            <GeoJSON
              key={'mfd-' + validDisputes.features.length}
              data={validDisputes}
              style={mineFarmDisputeStyle}
              className="dispute-overlay"
              onEachFeature={mineFarmPopup}
            />
          </LayersControl.Overlay>
        )}
        {validTrigStations && (
          <LayersControl.Overlay checked name="Trig Stations">
            <GeoJSON
              key={'trig-' + validTrigStations.features.length}
              data={validTrigStations}
              pointToLayer={(feature, latlng) => {
                const desc = feature.properties.description 
                  ? feature.properties.description.replace(/\\n|\n/g, '<br/>') 
                  : 'No additional information available.'
                const trigId = feature.id
                
                const marker = L.marker(latlng, { icon: trigIcon })
                const popupContent = document.createElement('div')
                popupContent.style.cssText = 'font-family:system-ui; max-width:220px;'
                popupContent.innerHTML = 
                  `<div style="font-weight:700; color:#3b82f6; font-size:12px; margin-bottom:4px;">▲ Trig Station</div>` +
                  `<strong style="font-size:14px; display:block; margin-bottom:8px;">${feature.properties.name}</strong>` +
                  `<div style="font-size:11px; color:#475569; background:#f1f5f9; padding:8px; border-radius:4px; border:1px solid #e2e8f0; line-height:1.4; margin-bottom:8px;">${desc}</div>`
                
                const deleteBtn = document.createElement('button')
                deleteBtn.textContent = '🗑 Delete'
                deleteBtn.style.cssText = 'display:block; width:100%; padding:5px 0; margin-top:4px; background:#fef2f2; color:#dc2626; border:1px solid #fca5a5; border-radius:4px; font-size:11px; font-weight:600; cursor:pointer;'
                deleteBtn.addEventListener('click', () => {
                  if (onDeleteTrig) onDeleteTrig(trigId)
                })
                popupContent.appendChild(deleteBtn)
                
                marker.bindPopup(popupContent)
                return marker
              }}
            />
          </LayersControl.Overlay>
        )}
      </LayersControl>
    </MapContainer>
  )
}
