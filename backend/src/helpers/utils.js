function getPagination(req) {
  const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1)
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.page_size || '20', 10), 1), 1000)
  return { page, pageSize, offset: (page - 1) * pageSize }
}

function toFeature(row, properties) {
  return {
    type: 'Feature',
    id: row.id,
    geometry: row.geometry || null,
    properties,
  }
}

function geoCollectionResponse(count, features) {
  return {
    count,
    next: null,
    previous: null,
    results: {
      type: 'FeatureCollection',
      features,
    },
  }
}

function sendError(res, status, message, details = null) {
  if (details) return res.status(status).json({ detail: message, errors: details })
  return res.status(status).json({ detail: message })
}

function buildCsv(header, rows) {
  return [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

module.exports = { getPagination, toFeature, geoCollectionResponse, sendError, buildCsv }
