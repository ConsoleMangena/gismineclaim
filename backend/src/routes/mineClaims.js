const { Router } = require('express')
const { pool } = require('../config/db')
const { sendError, getPagination, toFeature, geoCollectionResponse } = require('../helpers/utils')
const { authMiddleware } = require('../middleware/auth')

const router = Router()

function claimFeature(row) {
  return toFeature(row, {
    id: row.id,
    claim_code: row.claim_code,
    claim_name: row.claim_name,
    claim_reg_no: row.claim_reg_no,
    mine_type: row.mine_type,
    owner: row.owner,
    owner_name: row.owner_name,
    owner_phone: row.owner_phone,
    owner_email: row.owner_email,
    area: row.area,
    status: row.status,
    district: row.district,
    surveyed_date: row.surveyed_date,
    surveyor: row.surveyor,
    coordinate_system: row.coordinate_system,
    created_at: row.created_at,
  })
}

const SELECT_CLAIM = `
  SELECT mc.id, mc.claim_code, mc.claim_name, mc.claim_reg_no, mc.mine_type,
         mc.owner_id AS owner, o.name AS owner_name, o.phone AS owner_phone, o.email AS owner_email,
         mc.area, mc.status, mc.district, mc.surveyed_date, mc.surveyor, mc.coordinate_system,
         mc.created_at, ST_AsGeoJSON(mc.geom)::json AS geometry
  FROM spatial_data_mineclaim mc
  JOIN spatial_data_owner o ON o.id = mc.owner_id
`

router.get('/', authMiddleware, async (req, res) => {
  const { pageSize, offset } = getPagination(req)
  const status = req.query.status || null

  const where = []
  const params = []
  if (status) {
    params.push(status)
    where.push(`mc.status = $${params.length}`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  try {
    const countQuery = `SELECT COUNT(*)::int AS count FROM spatial_data_mineclaim mc ${whereSql}`
    const dataQuery = `
      ${SELECT_CLAIM}
      ${whereSql}
      ORDER BY mc.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    const [countResult, rowsResult] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, [...params, pageSize, offset]),
    ])
    const features = rowsResult.rows.map(claimFeature)
    return res.json(geoCollectionResponse(countResult.rows[0].count, features))
  } catch {
    return sendError(res, 500, 'Failed to fetch mine claims.')
  }
})

router.get('/:id/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `${SELECT_CLAIM} WHERE mc.id = $1`,
      [req.params.id]
    )
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    return res.json(claimFeature(result.rows[0]))
  } catch {
    return sendError(res, 500, 'Failed to fetch mine claim.')
  }
})

router.post('/', authMiddleware, async (req, res) => {
  const {
    claim_code, claim_name = '', claim_reg_no = '', mine_type = '',
    owner, area, status = 'ACTIVE', district = '',
    surveyed_date = null, surveyor = '', coordinate_system = 'WGS84', geom,
  } = req.body || {}
  if (!claim_code || !owner) {
    return sendError(res, 400, 'claim_code and owner are required.')
  }

  try {
    const geomSql = geom ? 'ST_SetSRID(ST_GeomFromGeoJSON($12), 4326)' : 'NULL'
    const inserted = await pool.query(
      `INSERT INTO spatial_data_mineclaim
         (claim_code, claim_name, claim_reg_no, mine_type, owner_id, area, status, district, surveyed_date, surveyor, coordinate_system, ${geom ? 'geom, ' : ''}created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11${geom ? ', ' + geomSql : ''}, NOW())
       RETURNING id`,
      [
        claim_code, claim_name, claim_reg_no, mine_type, owner, area || null, status,
        district, surveyed_date || null, surveyor, coordinate_system,
        ...(geom ? [JSON.stringify(geom)] : []),
      ]
    )
    const id = inserted.rows[0].id
    const result = await pool.query(`${SELECT_CLAIM} WHERE mc.id = $1`, [id])
    return res.status(201).json(claimFeature(result.rows[0]))
  } catch (error) {
    if (error.code === '23505') return sendError(res, 400, 'A mine claim with this code already exists.')
    return sendError(res, 500, 'Failed to create mine claim.')
  }
})

router.put('/:id/', authMiddleware, async (req, res) => {
  const { claim_code, claim_name, claim_reg_no, mine_type, owner, area, status, district, surveyed_date, surveyor, coordinate_system, geom } = req.body || {}
  const updates = []
  const values = []

  if (claim_code !== undefined) { values.push(claim_code); updates.push(`claim_code = $${values.length}`) }
  if (claim_name !== undefined) { values.push(claim_name); updates.push(`claim_name = $${values.length}`) }
  if (claim_reg_no !== undefined) { values.push(claim_reg_no); updates.push(`claim_reg_no = $${values.length}`) }
  if (mine_type !== undefined) { values.push(mine_type); updates.push(`mine_type = $${values.length}`) }
  if (owner !== undefined) { values.push(owner); updates.push(`owner_id = $${values.length}`) }
  if (area !== undefined) { values.push(area); updates.push(`area = $${values.length}`) }
  if (status !== undefined) { values.push(status); updates.push(`status = $${values.length}`) }
  if (district !== undefined) { values.push(district); updates.push(`district = $${values.length}`) }
  if (surveyed_date !== undefined) { values.push(surveyed_date || null); updates.push(`surveyed_date = $${values.length}`) }
  if (surveyor !== undefined) { values.push(surveyor); updates.push(`surveyor = $${values.length}`) }
  if (coordinate_system !== undefined) { values.push(coordinate_system); updates.push(`coordinate_system = $${values.length}`) }
  if (geom !== undefined) {
    values.push(JSON.stringify(geom))
    updates.push(`geom = ST_SetSRID(ST_GeomFromGeoJSON($${values.length}), 4326)`)
  }

  if (!updates.length) return sendError(res, 400, 'No fields supplied for update.')

  try {
    values.push(req.params.id)
    const result = await pool.query(
      `UPDATE spatial_data_mineclaim
       SET ${updates.join(', ')}
       WHERE id = $${values.length}
       RETURNING id`,
      values
    )
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')

    const response = await pool.query(`${SELECT_CLAIM} WHERE mc.id = $1`, [req.params.id])
    return res.json(claimFeature(response.rows[0]))
  } catch {
    return sendError(res, 500, 'Failed to update mine claim.')
  }
})

router.delete('/:id/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM spatial_data_mineclaim WHERE id = $1', [req.params.id])
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    return res.status(204).send()
  } catch {
    return sendError(res, 500, 'Failed to delete mine claim.')
  }
})

module.exports = router
