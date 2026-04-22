import { MapContainer, TileLayer, GeoJSON, LayersControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Kwekwe district centre — zoomed out to show outskirt mining/farm areas
const INITIAL_CENTER = [-18.93, 29.78]
const INITIAL_ZOOM = 10

const claimStyle = { color: '#eab308', weight: 2, fillOpacity: 0.35 }
const parcelStyle = { color: '#22c55e', weight: 2, fillOpacity: 0.3 }
const mineFarmDisputeStyle = { color: '#f97316', weight: 3, fillOpacity: 0.50, dashArray: '5,5' }
const mineMineDisputeStyle = { color: '#dc2626', weight: 3, fillOpacity: 0.55, dashArray: '4,4' }
const boundaryStyle = { color: '#818cf8', weight: 1.5, fillOpacity: 0.08, dashArray: '8,4' }

function filterValid(geojson) {
  if (!geojson?.features) return null
  const valid = geojson.features.filter((f) => f.geometry)
  return valid.length > 0 ? { ...geojson, features: valid } : null
}

function mineFarmPopup(feature, layer) {
  layer.bindPopup(
    `<strong>Mine ↔ Farm Dispute</strong><br/>` +
    `Claim: ${feature.properties.mine_claim_code}<br/>` +
    `Parcel: ${feature.properties.farm_parcel_code}<br/>` +
    `Overlap: ${feature.properties.conflict_area ?? '—'} ha<br/>` +
    `Status: ${feature.properties.status}`
  )
}

function mineMinePopup(feature, layer) {
  layer.bindPopup(
    `<strong style="color:#dc2626">Mine ↔ Mine Dispute</strong><br/>` +
    `Claim A: ${feature.properties.mine_claim_a_code}<br/>` +
    `Claim B: ${feature.properties.mine_claim_b_code}<br/>` +
    `Overlap: ${feature.properties.conflict_area ?? '—'} ha<br/>` +
    `Status: ${feature.properties.status}`
  )
}

export default function MapView({ claims, parcels, disputes, mineDisputes, boundaries }) {
  const validClaims = filterValid(claims)
  const validParcels = filterValid(parcels)
  const validDisputes = filterValid(disputes)
  const validMineDisputes = filterValid(mineDisputes)
  const validBoundaries = filterValid(boundaries)

  return (
    <MapContainer center={INITIAL_CENTER} zoom={INITIAL_ZOOM} className="h-full w-full rounded-lg">
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
              onEachFeature={(feature, layer) => {
                layer.bindPopup(
                  `<strong>${feature.properties.claim_code}</strong><br/>` +
                  `Owner: ${feature.properties.owner_name}<br/>` +
                  `Area: ${feature.properties.area ?? '—'} ha<br/>` +
                  `CRS: ${feature.properties.coordinate_system || '—'}<br/>` +
                  `<span style="color:${feature.properties.status === 'ACTIVE' ? '#22c55e' : '#ef4444'}">● ${feature.properties.status}</span>`
                )
              }}
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
          <LayersControl.Overlay checked name="Mine ↔ Mine Disputes">
            <GeoJSON
              key={'mmd-' + validMineDisputes.features.length}
              data={validMineDisputes}
              style={mineMineDisputeStyle}
              onEachFeature={mineMinePopup}
            />
          </LayersControl.Overlay>
        )}
        {validDisputes && (
          <LayersControl.Overlay checked name="Mine ↔ Farm Disputes">
            <GeoJSON
              key={'mfd-' + validDisputes.features.length}
              data={validDisputes}
              style={mineFarmDisputeStyle}
              onEachFeature={mineFarmPopup}
            />
          </LayersControl.Overlay>
        )}
      </LayersControl>
    </MapContainer>
  )
}
