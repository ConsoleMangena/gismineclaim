const { Router } = require('express')
const { pool } = require('../config/db')
const { sendError } = require('../helpers/utils')
const { authMiddleware } = require('../middleware/auth')

const router = Router()

router.post('/run-conflict-detection/', authMiddleware, async (_req, res) => {
  try {
    // Detect mine↔farm overlaps and insert new disputes
    const result = await pool.query(
      `
      WITH new_disputes AS (
        INSERT INTO disputes_dispute (
          mine_claim_id, farm_parcel_id, conflict_area, status, detected_at, geom
        )
        SELECT
          mc.id,
          fp.id,
          ST_Area(ST_Intersection(mc.geom, fp.geom)::geography) / 10000.0 AS conflict_area,
          'OPEN',
          NOW(),
          ST_Intersection(mc.geom, fp.geom) AS geom
        FROM spatial_data_mineclaim mc
        JOIN spatial_data_farmparcel fp
          ON ST_Intersects(mc.geom, fp.geom)
          AND NOT ST_Touches(mc.geom, fp.geom)
        LEFT JOIN disputes_dispute d
          ON d.mine_claim_id = mc.id AND d.farm_parcel_id = fp.id
        WHERE mc.geom IS NOT NULL
          AND fp.geom IS NOT NULL
          AND d.id IS NULL
        RETURNING mine_claim_id
      )
      SELECT COUNT(*)::int AS created_count FROM new_disputes;
      `
    )
    const count = result.rows[0]?.created_count || 0

    // Mark all mines that have open disputes as DISPUTED
    if (count > 0) {
      await pool.query(`
        UPDATE spatial_data_mineclaim
        SET status = 'DISPUTED'
        WHERE id IN (
          SELECT DISTINCT mine_claim_id FROM disputes_dispute WHERE status = 'OPEN'
        )
        AND status != 'DISPUTED'
      `)
    }

    return res.json({
      message: `${count} new conflict(s) detected.`,
      new_disputes: count,
    })
  } catch {
    return sendError(res, 500, 'Failed to run conflict detection.')
  }
})

router.get('/buffer-risks/', authMiddleware, async (req, res) => {
  const threshold = Math.max(Number.parseInt(req.query.threshold || '500', 10), 1)

  try {
    const result = await pool.query(
      `
      SELECT mc.claim_code AS mine_claim, fp.parcel_code AS farm_parcel, 'proximity_risk' AS status
      FROM spatial_data_mineclaim mc
      JOIN spatial_data_farmparcel fp
        ON ST_DWithin(mc.geom::geography, fp.geom::geography, $1)
      WHERE mc.status IN ('ACTIVE', 'DISPUTED')
        AND NOT ST_Intersects(mc.geom, fp.geom)
      ORDER BY mc.claim_code, fp.parcel_code
      `,
      [threshold]
    )
    return res.json(result.rows)
  } catch {
    return sendError(res, 500, 'Failed to run buffer analysis.')
  }
})

router.post('/run-hotspot-analysis/', authMiddleware, async (req, res) => {
  const gridSize = Number.parseFloat(req.query.grid_size || '0.01')
  if (!Number.isFinite(gridSize) || gridSize <= 0) return sendError(res, 400, 'grid_size must be a positive number.')

  try {
    await pool.query('DELETE FROM disputes_hotspot')
    await pool.query(
      `
      INSERT INTO disputes_hotspot (intensity, dispute_count, geom, created_at)
      SELECT
        COUNT(*)::float AS intensity,
        COUNT(*)::int AS dispute_count,
        ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
          ST_SnapToGrid(ST_Centroid(geom), $1),
          ST_Translate(ST_SnapToGrid(ST_Centroid(geom), $1), $1, 0),
          ST_Translate(ST_SnapToGrid(ST_Centroid(geom), $1), $1, $1),
          ST_Translate(ST_SnapToGrid(ST_Centroid(geom), $1), 0, $1),
          ST_SnapToGrid(ST_Centroid(geom), $1)
        ])), 4326) AS geom,
        NOW() AS created_at
      FROM disputes_dispute
      WHERE geom IS NOT NULL
      GROUP BY ST_SnapToGrid(ST_Centroid(geom), $1)
      HAVING COUNT(*) > 1
      `,
      [gridSize]
    )
    const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM disputes_hotspot')
    const count = countResult.rows[0]?.count || 0
    return res.json({
      message: `${count} hotspot(s) identified.`,
      hotspots: count,
    })
  } catch {
    return sendError(res, 500, 'Failed to run hotspot analysis.')
  }
})

module.exports = router
