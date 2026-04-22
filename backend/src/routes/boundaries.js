const { Router } = require('express')
const { pool } = require('../config/db')
const { sendError, getPagination, toFeature, geoCollectionResponse } = require('../helpers/utils')
const { authMiddleware } = require('../middleware/auth')

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  const { pageSize, offset } = getPagination(req)
  try {
    const [countResult, rowsResult] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM spatial_data_boundary'),
      pool.query(
        `SELECT id, name, boundary_type, ST_AsGeoJSON(geom)::json AS geometry
         FROM spatial_data_boundary
         ORDER BY boundary_type, name
         LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      ),
    ])
    const features = rowsResult.rows.map((row) => toFeature(row, {
      id: row.id,
      name: row.name,
      boundary_type: row.boundary_type,
    }))
    return res.json(geoCollectionResponse(countResult.rows[0].count, features))
  } catch {
    return sendError(res, 500, 'Failed to fetch boundaries.')
  }
})

module.exports = router
