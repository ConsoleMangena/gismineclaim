const { Router } = require('express')
const { pool } = require('../config/db')
const { sendError, getPagination, toFeature, geoCollectionResponse } = require('../helpers/utils')
const { authMiddleware } = require('../middleware/auth')

const router = Router()

function mineDisputeFeature(row) {
  return toFeature(row, {
    id: row.id,
    mine_claim_a: row.mine_claim_a,
    mine_claim_b: row.mine_claim_b,
    mine_claim_a_code: row.mine_claim_a_code,
    mine_claim_b_code: row.mine_claim_b_code,
    conflict_area: row.conflict_area,
    status: row.status,
    detected_at: row.detected_at,
    resolved_at: row.resolved_at,
  })
}

const SELECT_MINE_DISPUTE = `
  SELECT d.id,
         d.mine_claim_a_id AS mine_claim_a, d.mine_claim_b_id AS mine_claim_b,
         a.claim_code AS mine_claim_a_code, b.claim_code AS mine_claim_b_code,
         d.conflict_area, d.status, d.detected_at, d.resolved_at,
         ST_AsGeoJSON(d.geom)::json AS geometry
  FROM disputes_mine_mine d
  JOIN spatial_data_mineclaim a ON a.id = d.mine_claim_a_id
  JOIN spatial_data_mineclaim b ON b.id = d.mine_claim_b_id
`

// List all mine-to-mine disputes
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
    const countQuery = `SELECT COUNT(*)::int AS count FROM disputes_mine_mine d ${whereSql}`
    const dataQuery = `
      ${SELECT_MINE_DISPUTE}
      ${whereSql}
      ORDER BY d.detected_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    const [countResult, rowsResult] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, [...params, pageSize, offset]),
    ])
    const features = rowsResult.rows.map(mineDisputeFeature)
    return res.json(geoCollectionResponse(countResult.rows[0].count, features))
  } catch {
    return sendError(res, 500, 'Failed to fetch mine-to-mine disputes.')
  }
})

// Get single mine-to-mine dispute
router.get('/:id/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `${SELECT_MINE_DISPUTE} WHERE d.id = $1`,
      [req.params.id]
    )
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    return res.json(mineDisputeFeature(result.rows[0]))
  } catch {
    return sendError(res, 500, 'Failed to fetch mine-to-mine dispute.')
  }
})

// Update status
router.put('/:id/', authMiddleware, async (req, res) => {
  const { status } = req.body || {}
  if (!status || !['OPEN', 'RESOLVED', 'DISMISSED'].includes(status)) {
    return sendError(res, 400, 'Valid status is required (OPEN, RESOLVED, or DISMISSED).')
  }

  try {
    const resolvedAt = status === 'RESOLVED' ? 'NOW()' : 'NULL'
    const result = await pool.query(
      `UPDATE disputes_mine_mine SET status = $1, resolved_at = ${resolvedAt} WHERE id = $2 RETURNING id`,
      [status, req.params.id]
    )
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    const response = await pool.query(`${SELECT_MINE_DISPUTE} WHERE d.id = $1`, [req.params.id])
    return res.json(mineDisputeFeature(response.rows[0]))
  } catch {
    return sendError(res, 500, 'Failed to update mine-to-mine dispute.')
  }
})

// Delete
router.delete('/:id/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM disputes_mine_mine WHERE id = $1', [req.params.id])
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    return res.status(204).send()
  } catch {
    return sendError(res, 500, 'Failed to delete mine-to-mine dispute.')
  }
})

module.exports = router
