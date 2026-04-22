const { Router } = require('express')
const { pool } = require('../config/db')
const { sendError, getPagination } = require('../helpers/utils')
const { authMiddleware } = require('../middleware/auth')

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  const { pageSize, offset } = getPagination(req)
  try {
    const [countResult, rowsResult] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM spatial_data_owner'),
      pool.query(
        `SELECT id, name, national_id, phone, email, address, created_at
         FROM spatial_data_owner
         ORDER BY name ASC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      ),
    ])
    return res.json({
      count: countResult.rows[0].count,
      next: null,
      previous: null,
      results: rowsResult.rows,
    })
  } catch {
    return sendError(res, 500, 'Failed to fetch owners.')
  }
})

router.post('/', authMiddleware, async (req, res) => {
  const { name, national_id, phone = '', email = '', address = '' } = req.body || {}
  if (!name || !national_id) return sendError(res, 400, 'name and national_id are required.')

  try {
    const result = await pool.query(
      `INSERT INTO spatial_data_owner (name, national_id, phone, email, address, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, name, national_id, phone, email, address, created_at`,
      [name, national_id, phone, email, address]
    )
    return res.status(201).json(result.rows[0])
  } catch (error) {
    if (error.code === '23505') return sendError(res, 400, 'Owner with this national ID already exists.')
    return sendError(res, 500, 'Failed to create owner.')
  }
})

router.put('/:id/', authMiddleware, async (req, res) => {
  const { id } = req.params
  const { name, national_id, phone = '', email = '', address = '' } = req.body || {}
  if (!name || !national_id) return sendError(res, 400, 'name and national_id are required.')

  try {
    const result = await pool.query(
      `UPDATE spatial_data_owner
       SET name = $1, national_id = $2, phone = $3, email = $4, address = $5
       WHERE id = $6
       RETURNING id, name, national_id, phone, email, address, created_at`,
      [name, national_id, phone, email, address, id]
    )
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    return res.json(result.rows[0])
  } catch {
    return sendError(res, 500, 'Failed to update owner.')
  }
})

router.delete('/:id/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM spatial_data_owner WHERE id = $1', [req.params.id])
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    return res.status(204).send()
  } catch {
    return sendError(res, 500, 'Failed to delete owner.')
  }
})

module.exports = router
