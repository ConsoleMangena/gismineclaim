const { Router } = require('express')
const { pool } = require('../config/db')
const { sendError, getPagination, toFeature, geoCollectionResponse } = require('../helpers/utils')
const { authMiddleware } = require('../middleware/auth')

const router = Router()

async function checkAndCreateDisputes(parcelId) {
  try {
    // Check for intersections between this newly created/updated farm parcel and existing mine claims.
    await pool.query(`
      INSERT INTO disputes_dispute (mine_claim_id, farm_parcel_id, conflict_area, status, geom)
      SELECT 
        mc.id AS mine_claim_id,
        fp.id AS farm_parcel_id,
        (ST_Area(ST_Intersection(mc.geom::geography, fp.geom::geography)) / 10000.0) AS conflict_area,
        'OPEN' AS status,
        ST_Intersection(mc.geom, fp.geom) AS geom
      FROM spatial_data_mineclaim mc
      JOIN spatial_data_farmparcel fp ON ST_Intersects(mc.geom, fp.geom) AND ST_GeometryType(ST_Intersection(mc.geom, fp.geom)) IN ('ST_Polygon', 'ST_MultiPolygon')
      WHERE fp.id = $1
      ON CONFLICT (mine_claim_id, farm_parcel_id) 
      DO UPDATE SET
        conflict_area = EXCLUDED.conflict_area,
        geom = EXCLUDED.geom,
        status = 'OPEN',
        resolved_at = NULL
    `, [parcelId])
  } catch (err) {
    console.error('Error detecting overlaps for farm parcel:', err)
  }
}

function parcelFeature(row) {
  return toFeature(row, {
    id: row.id,
    parcel_code: row.parcel_code,
    farm_name: row.farm_name,
    deed_no: row.deed_no,
    lease_type: row.lease_type,
    owner: row.owner,
    owner_name: row.owner_name,
    owner_phone: row.owner_phone,
    owner_email: row.owner_email,
    land_use: row.land_use,
    area: row.area,
    survey_date: row.survey_date,
    surveyor: row.surveyor,
    coordinate_system: row.coordinate_system,
    created_at: row.created_at,
  })
}

const SELECT_PARCEL = `
  SELECT fp.id, fp.parcel_code, fp.farm_name, fp.deed_no, fp.lease_type,
         fp.owner_id AS owner, o.name AS owner_name, o.phone AS owner_phone, o.email AS owner_email,
         fp.land_use, fp.area, fp.survey_date, fp.surveyor, fp.coordinate_system,
         fp.created_at, ST_AsGeoJSON(fp.geom)::json AS geometry
  FROM spatial_data_farmparcel fp
  JOIN spatial_data_owner o ON o.id = fp.owner_id
`

router.get('/', authMiddleware, async (req, res) => {
  const { pageSize, offset } = getPagination(req)
  const landUse = req.query.land_use || null
  const where = []
  const params = []
  if (landUse) {
    params.push(landUse)
    where.push(`fp.land_use = $${params.length}`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  try {
    const countQuery = `SELECT COUNT(*)::int AS count FROM spatial_data_farmparcel fp ${whereSql}`
    const dataQuery = `
      ${SELECT_PARCEL}
      ${whereSql}
      ORDER BY fp.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    const [countResult, rowsResult] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, [...params, pageSize, offset]),
    ])
    const features = rowsResult.rows.map(parcelFeature)
    return res.json(geoCollectionResponse(countResult.rows[0].count, features))
  } catch {
    return sendError(res, 500, 'Failed to fetch farm parcels.')
  }
})

router.get('/:id/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `${SELECT_PARCEL} WHERE fp.id = $1`,
      [req.params.id]
    )
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    return res.json(parcelFeature(result.rows[0]))
  } catch {
    return sendError(res, 500, 'Failed to fetch farm parcel.')
  }
})

router.post('/', authMiddleware, async (req, res) => {
  const {
    parcel_code, farm_name = '', deed_no = '', lease_type = '',
    owner, land_use = '', area = null,
    survey_date = null, surveyor = '', coordinate_system = 'WGS84', geom,
  } = req.body || {}
  if (!parcel_code || !owner) {
    return sendError(res, 400, 'parcel_code and owner are required.')
  }

  try {
    const geomSql = geom ? 'ST_SetSRID(ST_GeomFromGeoJSON($10), 4326)' : 'NULL'
    const inserted = await pool.query(
      `INSERT INTO spatial_data_farmparcel
         (parcel_code, farm_name, deed_no, lease_type, owner_id, land_use, area, survey_date, surveyor, ${geom ? 'geom, ' : ''}coordinate_system, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9${geom ? ', ' + geomSql : ''}, $${geom ? 11 : 10}, NOW())
       RETURNING id`,
      [
        parcel_code, farm_name, deed_no, lease_type, owner, land_use, area,
        survey_date || null, surveyor,
        ...(geom ? [JSON.stringify(geom)] : []),
        coordinate_system,
      ]
    )
    const id = inserted.rows[0].id
    
    if (geom) {
      await checkAndCreateDisputes(id)
    }

    const result = await pool.query(`${SELECT_PARCEL} WHERE fp.id = $1`, [id])
    return res.status(201).json(parcelFeature(result.rows[0]))
  } catch (error) {
    if (error.code === '23505') return sendError(res, 400, 'A farm parcel with this code already exists.')
    return sendError(res, 500, 'Failed to create farm parcel.')
  }
})

router.put('/:id/', authMiddleware, async (req, res) => {
  const { parcel_code, farm_name, deed_no, lease_type, owner, land_use, area, survey_date, surveyor, coordinate_system, geom } = req.body || {}
  const updates = []
  const values = []

  if (parcel_code !== undefined) { values.push(parcel_code); updates.push(`parcel_code = $${values.length}`) }
  if (farm_name !== undefined) { values.push(farm_name); updates.push(`farm_name = $${values.length}`) }
  if (deed_no !== undefined) { values.push(deed_no); updates.push(`deed_no = $${values.length}`) }
  if (lease_type !== undefined) { values.push(lease_type); updates.push(`lease_type = $${values.length}`) }
  if (owner !== undefined) { values.push(owner); updates.push(`owner_id = $${values.length}`) }
  if (land_use !== undefined) { values.push(land_use); updates.push(`land_use = $${values.length}`) }
  if (area !== undefined) { values.push(area); updates.push(`area = $${values.length}`) }
  if (survey_date !== undefined) { values.push(survey_date || null); updates.push(`survey_date = $${values.length}`) }
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
      `UPDATE spatial_data_farmparcel
       SET ${updates.join(', ')}
       WHERE id = $${values.length}
       RETURNING id`,
      values
    )
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    
    if (geom !== undefined) {
      await checkAndCreateDisputes(req.params.id)
    }

    const response = await pool.query(`${SELECT_PARCEL} WHERE fp.id = $1`, [req.params.id])
    return res.json(parcelFeature(response.rows[0]))
  } catch {
    return sendError(res, 500, 'Failed to update farm parcel.')
  }
})

router.delete('/:id/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM spatial_data_farmparcel WHERE id = $1', [req.params.id])
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    return res.status(204).send()
  } catch {
    return sendError(res, 500, 'Failed to delete farm parcel.')
  }
})

module.exports = router
