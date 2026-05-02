import proj4 from 'proj4'

// ── Proj4 CRS definitions ─────────────────────────────────────
// Map our CRS preset values → proj4 definition strings.
// WGS84 (EPSG:4326) is built-in to proj4.

const CRS_DEFS = {
  'WGS84':         'EPSG:4326',
  'UTM36S':        '+proj=utm +zone=36 +south +datum=WGS84 +units=m +no_defs',
  'EPSG:32736':    '+proj=utm +zone=36 +south +datum=WGS84 +units=m +no_defs',
  'EPSG:32735':    '+proj=utm +zone=35 +south +datum=WGS84 +units=m +no_defs',
  'EPSG:20936':    '+proj=utm +zone=36 +south +a=6378249.145 +rf=293.465 +towgs84=-143,-90,-294,0,0,0,0 +units=m +no_defs',
  'EPSG:4210':     '+proj=longlat +a=6378249.145 +rf=293.465 +towgs84=-160,-6,-302,0,0,0,0 +no_defs',
  'EPSG:4222':     '+proj=longlat +a=6378249.145326 +rf=293.4663077 +towgs84=-136,-108,-292,0,0,0,0 +no_defs',
  'Harare_Datum':  '+proj=longlat +a=6378249.145 +rf=293.465 +towgs84=-125.733,-111.248,268.409,0,0,0,0 +no_defs',
  'Cape_Datum':    '+proj=longlat +a=6378249.145326 +rf=293.4663077 +towgs84=-136,-108,-292,0,0,0,0 +no_defs',
}

// Human-readable labels
export const CRS_LABELS = {
  'WGS84':         'WGS 84 (EPSG:4326)',
  'UTM36S':        'UTM Zone 36S (EPSG:32736)',
  'EPSG:32735':    'UTM Zone 35S (EPSG:32735)',
  'EPSG:20936':    'Arc 1950 / UTM 36S (EPSG:20936)',
  'EPSG:4210':     'Arc 1960 (EPSG:4210)',
  'EPSG:4222':     'Cape (EPSG:4222)',
  'Harare_Datum':  'Harare Datum',
  'Cape_Datum':    'Cape Datum',
}

export const CRS_OPTIONS = Object.entries(CRS_LABELS).map(([value, label]) => ({ value, label }))

/**
 * Register a custom EPSG definition with proj4.
 * Called at runtime when user enters a custom code.
 */
export function registerCustomCRS(key, proj4String) {
  CRS_DEFS[key] = proj4String
  proj4.defs(key, proj4String)
}

/**
 * Fetch a proj4 definition string from epsg.io for a given EPSG code.
 * Uses the .proj4 endpoint for the definition and .json for the name.
 * @param {number|string} code – e.g. 32736 or "32736"
 * @returns {Promise<{proj4: string, name: string}>}
 */
export async function fetchEpsgDefinition(code) {
  const num = String(code).replace(/\D/g, '')
  if (!num) throw new Error('Invalid EPSG code.')

  // Fetch proj4 definition string
  const proj4Res = await fetch(`https://epsg.io/${num}.proj4`)
  if (!proj4Res.ok) throw new Error(`EPSG:${num} not found.`)

  const proj4String = (await proj4Res.text()).trim()
  if (!proj4String || proj4String.length < 5) {
    throw new Error(`No proj4 definition available for EPSG:${num}.`)
  }

  // Fetch name from PROJJSON
  let name = `EPSG:${num}`
  try {
    const jsonRes = await fetch(`https://epsg.io/${num}.json`)
    if (jsonRes.ok) {
      const data = await jsonRes.json()
      if (data.name) name = data.name
    }
  } catch { /* name is optional, fall back to code */ }

  // Auto-register it so it can be used immediately
  const key = `EPSG:${num}`
  registerCustomCRS(key, proj4String)

  return { proj4: proj4String, name }
}

/**
 * Get the proj4 definition string for a CRS key.
 */
function getProj(crsKey) {
  const def = CRS_DEFS[crsKey]
  if (!def) throw new Error(`Unknown CRS: "${crsKey}". Register it first or use a custom EPSG code.`)
  return def
}

/**
 * Transform a single [x, y] coordinate pair.
 */
function transformCoord(coord, fromProj, toProj) {
  const [x, y] = proj4(fromProj, toProj, [coord[0], coord[1]])
  // Preserve any extra values (e.g. z altitude)
  return coord.length > 2 ? [x, y, ...coord.slice(2)] : [x, y]
}

/**
 * Recursively transform all coordinates in a nested array structure.
 */
function transformCoords(coords, fromProj, toProj) {
  if (typeof coords[0] === 'number') {
    return transformCoord(coords, fromProj, toProj)
  }
  return coords.map(c => transformCoords(c, fromProj, toProj))
}

/**
 * Transform a GeoJSON geometry object from one CRS to another.
 * Returns a NEW geometry object (does not mutate the original).
 *
 * @param {object} geometry  – GeoJSON geometry { type, coordinates }
 * @param {string} fromCRS   – source CRS key (e.g. "UTM36S", "WGS84")
 * @param {string} toCRS     – target CRS key
 * @returns {object}         – transformed geometry
 */
export function transformGeometry(geometry, fromCRS, toCRS) {
  if (!geometry || !geometry.coordinates) {
    throw new Error('No geometry coordinates to transform.')
  }
  if (fromCRS === toCRS) {
    return { ...geometry } // no-op
  }

  const fromProj = getProj(fromCRS)
  const toProj = getProj(toCRS)

  return {
    type: geometry.type,
    coordinates: transformCoords(geometry.coordinates, fromProj, toProj),
  }
}

/**
 * Check if a CRS key is supported (either built-in or previously registered).
 */
export function isCrsSupported(crsKey) {
  return crsKey in CRS_DEFS
}
