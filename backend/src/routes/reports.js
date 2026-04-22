const { Router } = require('express')
const { pool } = require('../config/db')
const { sendError, buildCsv } = require('../helpers/utils')
const { authMiddleware } = require('../middleware/auth')

const router = Router()

router.get('/summary/', authMiddleware, async (_req, res) => {
  try {
    const [claims, parcels, disputes, openDisputes, resolvedDisputes, hotspots] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM spatial_data_mineclaim'),
      pool.query('SELECT COUNT(*)::int AS count FROM spatial_data_farmparcel'),
      pool.query('SELECT COUNT(*)::int AS count FROM disputes_dispute'),
      pool.query(`SELECT COUNT(*)::int AS count FROM disputes_dispute WHERE status = 'OPEN'`),
      pool.query(`SELECT COUNT(*)::int AS count FROM disputes_dispute WHERE status = 'RESOLVED'`),
      pool.query('SELECT COUNT(*)::int AS count FROM disputes_hotspot'),
    ])

    return res.json({
      total_mine_claims: claims.rows[0].count,
      total_farm_parcels: parcels.rows[0].count,
      total_disputes: disputes.rows[0].count,
      open_disputes: openDisputes.rows[0].count,
      resolved_disputes: resolvedDisputes.rows[0].count,
      total_hotspots: hotspots.rows[0].count,
    })
  } catch {
    return sendError(res, 500, 'Failed to generate summary.')
  }
})

router.get('/disputes/csv/', authMiddleware, async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT d.id, mc.claim_code AS mine_claim, fp.parcel_code AS farm_parcel,
             COALESCE(d.conflict_area::text, '') AS conflict_area,
             d.status,
             COALESCE(TO_CHAR(d.detected_at, 'YYYY-MM-DD HH24:MI'), '') AS detected_at,
             COALESCE(TO_CHAR(d.resolved_at, 'YYYY-MM-DD HH24:MI'), '') AS resolved_at
      FROM disputes_dispute d
      JOIN spatial_data_mineclaim mc ON mc.id = d.mine_claim_id
      JOIN spatial_data_farmparcel fp ON fp.id = d.farm_parcel_id
      ORDER BY d.detected_at DESC
      `
    )

    const header = ['ID', 'Mine Claim', 'Farm Parcel', 'Conflict Area (ha)', 'Status', 'Detected At', 'Resolved At']
    const rows = result.rows.map((r) => [r.id, r.mine_claim, r.farm_parcel, r.conflict_area, r.status, r.detected_at, r.resolved_at])
    const csv = buildCsv(header, rows)

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="disputes_report.csv"')
    return res.send(csv)
  } catch {
    return sendError(res, 500, 'Failed to generate disputes CSV.')
  }
})

router.get('/mine-claims/csv/', authMiddleware, async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT mc.id, mc.claim_code, o.name AS owner, mc.area, mc.status,
             COALESCE(TO_CHAR(mc.created_at, 'YYYY-MM-DD HH24:MI'), '') AS created_at
      FROM spatial_data_mineclaim mc
      JOIN spatial_data_owner o ON o.id = mc.owner_id
      ORDER BY mc.created_at DESC
      `
    )

    const header = ['ID', 'Claim Code', 'Owner', 'Area (ha)', 'Status', 'Created At']
    const rows = result.rows.map((r) => [r.id, r.claim_code, r.owner, r.area, r.status, r.created_at])
    const csv = buildCsv(header, rows)

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="mine_claims_report.csv"')
    return res.send(csv)
  } catch {
    return sendError(res, 500, 'Failed to generate mine claims CSV.')
  }
})

router.get('/farm-parcels/csv/', authMiddleware, async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT fp.id, fp.parcel_code, o.name AS owner, fp.land_use,
             COALESCE(fp.area::text, '') AS area,
             COALESCE(TO_CHAR(fp.created_at, 'YYYY-MM-DD HH24:MI'), '') AS created_at
      FROM spatial_data_farmparcel fp
      JOIN spatial_data_owner o ON o.id = fp.owner_id
      ORDER BY fp.created_at DESC
      `
    )

    const header = ['ID', 'Parcel Code', 'Owner', 'Land Use', 'Area (ha)', 'Created At']
    const rows = result.rows.map((r) => [r.id, r.parcel_code, r.owner, r.land_use, r.area, r.created_at])
    const csv = buildCsv(header, rows)

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="farm_parcels_report.csv"')
    return res.send(csv)
  } catch {
    return sendError(res, 500, 'Failed to generate farm parcels CSV.')
  }
})

module.exports = router
