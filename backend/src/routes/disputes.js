const { Router } = require('express')
const { pool } = require('../config/db')
const { sendError, getPagination, toFeature, geoCollectionResponse } = require('../helpers/utils')
const { authMiddleware } = require('../middleware/auth')

const router = Router()

function disputeFeature(row) {
  return toFeature(row, {
    id: row.id,
    mine_claim: row.mine_claim,
    farm_parcel: row.farm_parcel,
    mine_claim_code: row.mine_claim_code,
    farm_parcel_code: row.farm_parcel_code,
    conflict_area: row.conflict_area,
    status: row.status,
    detected_at: row.detected_at,
    resolved_at: row.resolved_at,
  })
}

const SELECT_DISPUTE = `
  SELECT d.id, d.mine_claim_id AS mine_claim, d.farm_parcel_id AS farm_parcel,
         mc.claim_code AS mine_claim_code, fp.parcel_code AS farm_parcel_code,
         d.conflict_area, d.status, d.detected_at, d.resolved_at,
         ST_AsGeoJSON(d.geom)::json AS geometry
  FROM disputes_dispute d
  JOIN spatial_data_mineclaim mc ON mc.id = d.mine_claim_id
  JOIN spatial_data_farmparcel fp ON fp.id = d.farm_parcel_id
`

router.get('/', authMiddleware, async (req, res) => {
  const { pageSize, offset } = getPagination(req)
  const status = req.query.status || null
  const where = []
  const params = []
  if (status) {
    params.push(status)
    where.push(`d.status = $${params.length}`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  try {
    const countQuery = `SELECT COUNT(*)::int AS count FROM disputes_dispute d ${whereSql}`
    const dataQuery = `
      ${SELECT_DISPUTE}
      ${whereSql}
      ORDER BY d.detected_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    const [countResult, rowsResult] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, [...params, pageSize, offset]),
    ])
    const features = rowsResult.rows.map(disputeFeature)
    return res.json(geoCollectionResponse(countResult.rows[0].count, features))
  } catch {
    return sendError(res, 500, 'Failed to fetch disputes.')
  }
})

router.get('/:id/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `${SELECT_DISPUTE} WHERE d.id = $1`,
      [req.params.id]
    )
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    return res.json(disputeFeature(result.rows[0]))
  } catch {
    return sendError(res, 500, 'Failed to fetch dispute.')
  }
})

// Update dispute status
router.put('/:id/', authMiddleware, async (req, res) => {
  const { status } = req.body || {}
  if (!status || !['OPEN', 'RESOLVED', 'DISMISSED'].includes(status)) {
    return sendError(res, 400, 'Valid status is required (OPEN, RESOLVED, or DISMISSED).')
  }

  try {
    const resolvedAt = status === 'RESOLVED' ? 'NOW()' : 'NULL'
    const result = await pool.query(
      `UPDATE disputes_dispute SET status = $1, resolved_at = ${resolvedAt} WHERE id = $2 RETURNING id`,
      [status, req.params.id]
    )
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    const response = await pool.query(`${SELECT_DISPUTE} WHERE d.id = $1`, [req.params.id])
    return res.json(disputeFeature(response.rows[0]))
  } catch {
    return sendError(res, 500, 'Failed to update dispute.')
  }
})

// Delete dispute
router.delete('/:id/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM disputes_dispute WHERE id = $1', [req.params.id])
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    return res.status(204).send()
  } catch {
    return sendError(res, 500, 'Failed to delete dispute.')
  }
})

module.exports = router
