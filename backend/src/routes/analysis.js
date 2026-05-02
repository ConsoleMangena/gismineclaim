const { Router } = require('express')
const { pool } = require('../config/db')
const { sendError } = require('../helpers/utils')
const { authMiddleware } = require('../middleware/auth')

const router = Router()

router.post('/run-conflict-detection/', authMiddleware, async (_req, res) => {
  try {
    // ── 1) Detect mine ↔ farm overlaps ──────────────────────────
    const mineFarmResult = await pool.query(
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
          AND ST_Area(ST_Intersection(mc.geom, fp.geom)::geography) > 1  -- ignore < 1 m² micro-overlaps
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
    const mineFarmCount = mineFarmResult.rows[0]?.created_count || 0

    // ── 2) Detect mine ↔ mine overlaps ──────────────────────────
    const mineMineResult = await pool.query(
      `
      WITH new_mine_disputes AS (
        INSERT INTO disputes_mine_mine (
          mine_claim_a_id, mine_claim_b_id, conflict_area, status, detected_at, geom
        )
        SELECT
          a.id,
          b.id,
          ST_Area(ST_Intersection(a.geom, b.geom)::geography) / 10000.0 AS conflict_area,
          'OPEN',
          NOW(),
          ST_Intersection(a.geom, b.geom) AS geom
        FROM spatial_data_mineclaim a
        JOIN spatial_data_mineclaim b
          ON a.id < b.id                             -- avoid duplicates & self-intersect
          AND ST_Intersects(a.geom, b.geom)
          AND NOT ST_Touches(a.geom, b.geom)
          AND ST_Area(ST_Intersection(a.geom, b.geom)::geography) > 1
        LEFT JOIN disputes_mine_mine d
          ON (d.mine_claim_a_id = a.id AND d.mine_claim_b_id = b.id)
          OR (d.mine_claim_a_id = b.id AND d.mine_claim_b_id = a.id)
        WHERE a.geom IS NOT NULL
          AND b.geom IS NOT NULL
          AND d.id IS NULL
        RETURNING mine_claim_a_id, mine_claim_b_id
      )
      SELECT COUNT(*)::int AS created_count FROM new_mine_disputes;
      `
    )
    const mineMineCount = mineMineResult.rows[0]?.created_count || 0

    // ── 3) Update conflict_area on existing disputes if geometries changed
    await pool.query(`
      UPDATE disputes_dispute d
      SET conflict_area = ST_Area(ST_Intersection(mc.geom, fp.geom)::geography) / 10000.0,
          geom = ST_Intersection(mc.geom, fp.geom)
      FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
      WHERE d.mine_claim_id = mc.id
        AND d.farm_parcel_id = fp.id
        AND d.status = 'OPEN'
        AND mc.geom IS NOT NULL
        AND fp.geom IS NOT NULL
        AND ST_Intersects(mc.geom, fp.geom)
    `)

    await pool.query(`
      UPDATE disputes_mine_mine d
      SET conflict_area = ST_Area(ST_Intersection(a.geom, b.geom)::geography) / 10000.0,
          geom = ST_Intersection(a.geom, b.geom)
      FROM spatial_data_mineclaim a, spatial_data_mineclaim b
      WHERE d.mine_claim_a_id = a.id
        AND d.mine_claim_b_id = b.id
        AND d.status = 'OPEN'
        AND a.geom IS NOT NULL
        AND b.geom IS NOT NULL
        AND ST_Intersects(a.geom, b.geom)
    `)

    // ── 4) Auto-resolve disputes where overlap no longer exists
    await pool.query(`
      UPDATE disputes_dispute d
      SET status = 'RESOLVED', resolved_at = NOW()
      FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
      WHERE d.mine_claim_id = mc.id
        AND d.farm_parcel_id = fp.id
        AND d.status = 'OPEN'
        AND (mc.geom IS NULL OR fp.geom IS NULL OR NOT ST_Intersects(mc.geom, fp.geom) OR ST_Touches(mc.geom, fp.geom))
    `)

    await pool.query(`
      UPDATE disputes_mine_mine d
      SET status = 'RESOLVED', resolved_at = NOW()
      FROM spatial_data_mineclaim a, spatial_data_mineclaim b
      WHERE d.mine_claim_a_id = a.id
        AND d.mine_claim_b_id = b.id
        AND d.status = 'OPEN'
        AND (a.geom IS NULL OR b.geom IS NULL OR NOT ST_Intersects(a.geom, b.geom) OR ST_Touches(a.geom, b.geom))
    `)

    // ── 5) Mark all mines with open disputes as DISPUTED
    const totalNew = mineFarmCount + mineMineCount
    if (totalNew > 0) {
      await pool.query(`
        UPDATE spatial_data_mineclaim
        SET status = 'DISPUTED'
        WHERE id IN (
          SELECT mine_claim_id FROM disputes_dispute WHERE status = 'OPEN'
          UNION
          SELECT mine_claim_a_id FROM disputes_mine_mine WHERE status = 'OPEN'
          UNION
          SELECT mine_claim_b_id FROM disputes_mine_mine WHERE status = 'OPEN'
        )
        AND status != 'DISPUTED'
      `)
    }

    // ── 6) Clear DISPUTED status for mines with no open disputes
    await pool.query(`
      UPDATE spatial_data_mineclaim
      SET status = 'ACTIVE'
      WHERE status = 'DISPUTED'
        AND id NOT IN (
          SELECT mine_claim_id FROM disputes_dispute WHERE status = 'OPEN'
          UNION
          SELECT mine_claim_a_id FROM disputes_mine_mine WHERE status = 'OPEN'
          UNION
          SELECT mine_claim_b_id FROM disputes_mine_mine WHERE status = 'OPEN'
        )
    `)

    return res.json({
      message: `${mineFarmCount} mine↔farm and ${mineMineCount} mine↔mine conflict(s) detected.`,
      new_mine_farm_disputes: mineFarmCount,
      new_mine_mine_disputes: mineMineCount,
      total_new: totalNew,
    })
  } catch (err) {
    console.error('Conflict detection error:', err)
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
      FROM (
        SELECT geom FROM disputes_dispute WHERE geom IS NOT NULL
        UNION ALL
        SELECT geom FROM disputes_mine_mine WHERE geom IS NOT NULL
      ) all_disputes
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
