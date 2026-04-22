const { Router } = require('express')
const { pool } = require('../config/db')
const { sendError, getPagination, toFeature, geoCollectionResponse } = require('../helpers/utils')
const { authMiddleware } = require('../middleware/auth')

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  const { pageSize, offset } = getPagination(req)
  try {
    const [countResult, rowsResult] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM disputes_hotspot'),
      pool.query(
        `SELECT id, intensity, dispute_count, created_at, ST_AsGeoJSON(geom)::json AS geometry
         FROM disputes_hotspot
         ORDER BY intensity DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      ),
    ])
    const features = rowsResult.rows.map((row) => toFeature(row, {
      id: row.id,
      intensity: row.intensity,
      dispute_count: row.dispute_count,
      created_at: row.created_at,
    }))
    return res.json(geoCollectionResponse(countResult.rows[0].count, features))
  } catch {
    return sendError(res, 500, 'Failed to fetch hotspots.')
  }
})

module.exports = router
