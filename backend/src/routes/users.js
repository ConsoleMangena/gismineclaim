const { Router } = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { z } = require('zod')
const { pool } = require('../config/db')
const { sendError } = require('../helpers/utils')
const { authMiddleware, createAccessToken, createRefreshToken, REFRESH_TOKEN_SECRET } = require('../middleware/auth')
const { authLimiter } = require('../middleware/rateLimiter')

const router = Router()

const registerSchema = z.object({
  username: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(8),
  first_name: z.string().optional().default(''),
  last_name: z.string().optional().default(''),
  role: z.enum(['ADMIN', 'USER']).optional().default('USER'),
})

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

router.post('/', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body || {})
  if (!parsed.success) return sendError(res, 400, 'Validation error', parsed.error.flatten())

  const data = parsed.data

  try {
    const passwordHash = await bcrypt.hash(data.password, 12)
    if (data.role === 'ADMIN') return sendError(res, 403, 'Self-registration as ADMIN is not allowed.')
    const role = data.role
    const result = await pool.query(
      `INSERT INTO node_users (username, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, first_name, last_name, role, date_joined`,
      [data.username, data.email || null, passwordHash, data.first_name || '', data.last_name || '', role]
    )
    return res.status(201).json(result.rows[0])
  } catch (error) {
    if (error.code === '23505') return sendError(res, 400, 'A user with that username already exists.')
    return sendError(res, 500, 'Failed to create user.')
  }
})

router.post('/login/', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body || {})
  if (!parsed.success) return sendError(res, 400, 'Validation error', parsed.error.flatten())

  try {
    const result = await pool.query(
      `SELECT id, username, role, password_hash FROM node_users WHERE username = $1 LIMIT 1`,
      [parsed.data.username]
    )
    const user = result.rows[0]
    if (!user) return sendError(res, 401, 'No active account found with the given credentials.')

    const match = await bcrypt.compare(parsed.data.password, user.password_hash)
    if (!match) return sendError(res, 401, 'No active account found with the given credentials.')

    const access = createAccessToken(user)
    const refresh = createRefreshToken(user)
    return res.json({ access, refresh })
  } catch {
    return sendError(res, 500, 'Login failed.')
  }
})

router.post('/token/refresh/', authLimiter, async (req, res) => {
  const refresh = req.body?.refresh
  if (!refresh) return sendError(res, 400, 'Refresh token is required.')

  try {
    const payload = jwt.verify(refresh, REFRESH_TOKEN_SECRET)
    if (payload.type !== 'refresh') return sendError(res, 401, 'Invalid refresh token.')
    const userResult = await pool.query('SELECT id, username, role FROM node_users WHERE id = $1', [payload.sub])
    const user = userResult.rows[0]
    if (!user) return sendError(res, 401, 'Invalid refresh token.')
    const access = createAccessToken(user)
    return res.json({ access })
  } catch {
    return sendError(res, 401, 'Invalid refresh token.')
  }
})

// Admin: list all users
router.get('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'ADMIN') return sendError(res, 403, 'Admin access required.')
  try {
    const result = await pool.query(
      `SELECT id, username, email, first_name, last_name, role, date_joined
       FROM node_users ORDER BY date_joined DESC`
    )
    return res.json({ count: result.rowCount, results: result.rows })
  } catch {
    return sendError(res, 500, 'Failed to fetch users.')
  }
})

// Current user profile — MUST be above /:id/ routes
router.get('/me/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, first_name, last_name, role, date_joined
       FROM node_users WHERE id = $1`,
      [req.user.sub]
    )
    if (result.rowCount === 0) return sendError(res, 404, 'User not found.')
    return res.json(result.rows[0])
  } catch {
    return sendError(res, 500, 'Failed to fetch profile.')
  }
})

// Admin: update user role
router.put('/:id/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'ADMIN') return sendError(res, 403, 'Admin access required.')
  const { role } = req.body || {}
  if (!role || !['ADMIN', 'USER'].includes(role)) return sendError(res, 400, 'Valid role is required (ADMIN or USER).')
  try {
    const result = await pool.query(
      `UPDATE node_users SET role = $1 WHERE id = $2
       RETURNING id, username, email, first_name, last_name, role, date_joined`,
      [role, req.params.id]
    )
    if (result.rowCount === 0) return sendError(res, 404, 'User not found.')
    return res.json(result.rows[0])
  } catch {
    return sendError(res, 500, 'Failed to update user.')
  }
})

// Admin: delete user
router.delete('/:id/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'ADMIN') return sendError(res, 403, 'Admin access required.')
  if (Number(req.params.id) === req.user.sub) return sendError(res, 400, 'Cannot delete your own account.')
  try {
    const result = await pool.query('DELETE FROM node_users WHERE id = $1', [req.params.id])
    if (result.rowCount === 0) return sendError(res, 404, 'User not found.')
    return res.status(204).send()
  } catch {
    return sendError(res, 500, 'Failed to delete user.')
  }
})

module.exports = router
