import { MapContainer, TileLayer, GeoJSON, LayersControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Zimbabwe centre: approx -19.0, 29.8
const INITIAL_CENTER = [-19.0, 29.8]
const INITIAL_ZOOM = 7

const claimStyle = { color: '#ef4444', weight: 2, fillOpacity: 0.35 }
const parcelStyle = { color: '#22c55e', weight: 2, fillOpacity: 0.3 }
const disputeStyle = { color: '#f59e0b', weight: 3, fillOpacity: 0.55, dashArray: '5,5' }
const boundaryStyle = { color: '#818cf8', weight: 1.5, fillOpacity: 0.08, dashArray: '8,4' }

function filterValid(geojson) {
  if (!geojson?.features) return null
  const valid = geojson.features.filter((f) => f.geometry)
  return valid.length > 0 ? { ...geojson, features: valid } : null
}

export default function MapView({ claims, parcels, disputes, boundaries }) {
  const validClaims = filterValid(claims)
  const validParcels = filterValid(parcels)
  const validDisputes = filterValid(disputes)
  const validBoundaries = filterValid(boundaries)

  return (
    <MapContainer center={INITIAL_CENTER} zoom={INITIAL_ZOOM} className="h-full w-full rounded-lg">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LayersControl position="topright">
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
                  `Area: ${feature.properties.area ?? '—'} ha`
                )
              }}
            />
          </LayersControl.Overlay>
        )}
        {validDisputes && (
          <LayersControl.Overlay checked name="Disputes">
            <GeoJSON
              key={'d-' + validDisputes.features.length}
              data={validDisputes}
              style={disputeStyle}
              onEachFeature={(feature, layer) => {
                layer.bindPopup(
                  `<strong>Dispute</strong><br/>` +
                  `Claim: ${feature.properties.mine_claim_code}<br/>` +
                  `Parcel: ${feature.properties.farm_parcel_code}<br/>` +
                  `Overlap: ${feature.properties.conflict_area ?? '—'} ha<br/>` +
                  `Status: ${feature.properties.status}`
                )
              }}
            />
          </LayersControl.Overlay>
        )}
      </LayersControl>
    </MapContainer>
  )
}
