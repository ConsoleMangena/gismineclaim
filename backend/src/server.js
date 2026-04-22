const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')
const { z } = require('zod')

dotenv.config()

const app = express()

const PORT = Number(process.env.PORT || 3000)
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'change-me-access-secret'
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'change-me-refresh-secret'
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '1d'
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean)

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSLMODE === 'disable' ? false : { rejectUnauthorized: false },
})

app.use(cors({
  origin(origin, callback) {
    if (!origin || CORS_ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    return callback(new Error('Not allowed by CORS'))
  },
}))
app.use(express.json({ limit: '2mb' }))

function getPagination(req) {
  const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1)
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.page_size || '20', 10), 1), 1000)
  return { page, pageSize, offset: (page - 1) * pageSize }
}

function toFeature(row, properties) {
  return {
    type: 'Feature',
    id: row.id,
    geometry: row.geometry || null,
    properties,
  }
}

function geoCollectionResponse(count, features) {
  return {
    count,
    next: null,
    previous: null,
    results: {
      type: 'FeatureCollection',
      features,
    },
  }
}

function sendError(res, status, message, details = null) {
  if (details) return res.status(status).json({ detail: message, errors: details })
  return res.status(status).json({ detail: message })
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const [scheme, token] = authHeader.split(' ')
  if (scheme !== 'Bearer' || !token) return sendError(res, 401, 'Authentication credentials were not provided.')

  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET)
    req.user = payload
    return next()
  } catch {
    return sendError(res, 401, 'Invalid or expired token.')
  }
}

function createAccessToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  )
}

function createRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role, type: 'refresh' },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  )
}

async function ensureNodeUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS node_users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(150) UNIQUE NOT NULL,
      email VARCHAR(254),
      password_hash TEXT NOT NULL,
      first_name VARCHAR(150) DEFAULT '',
      last_name VARCHAR(150) DEFAULT '',
      role VARCHAR(20) NOT NULL DEFAULT 'USER',
      date_joined TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
}

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

app.get('/api/health/', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok' })
  } catch {
    sendError(res, 500, 'Database unavailable')
  }
})

app.post('/api/users/', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body || {})
  if (!parsed.success) return sendError(res, 400, 'Validation error', parsed.error.flatten())

  const data = parsed.data

  try {
    const passwordHash = await bcrypt.hash(data.password, 12)
    const role = data.role === 'ADMIN' ? 'USER' : data.role
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

app.post('/api/users/login/', async (req, res) => {
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

app.post('/api/users/token/refresh/', async (req, res) => {
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

app.get('/api/users/me/', authMiddleware, async (req, res) => {
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

app.get('/api/owners/', authMiddleware, async (req, res) => {
  const { pageSize, offset } = getPagination(req)
  try {
    const [countResult, rowsResult] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM spatial_data_owner'),
      pool.query(
        `SELECT id, name, national_id, contact_info, created_at
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

app.post('/api/owners/', authMiddleware, async (req, res) => {
  const { name, national_id, contact_info = '' } = req.body || {}
  if (!name || !national_id) return sendError(res, 400, 'name and national_id are required.')

  try {
    const result = await pool.query(
      `INSERT INTO spatial_data_owner (name, national_id, contact_info, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, name, national_id, contact_info, created_at`,
      [name, national_id, contact_info]
    )
    return res.status(201).json(result.rows[0])
  } catch (error) {
    if (error.code === '23505') return sendError(res, 400, 'Owner with this national ID already exists.')
    return sendError(res, 500, 'Failed to create owner.')
  }
})

app.put('/api/owners/:id/', authMiddleware, async (req, res) => {
  const { id } = req.params
  const { name, national_id, contact_info = '' } = req.body || {}
  if (!name || !national_id) return sendError(res, 400, 'name and national_id are required.')

  try {
    const result = await pool.query(
      `UPDATE spatial_data_owner
       SET name = $1, national_id = $2, contact_info = $3
       WHERE id = $4
       RETURNING id, name, national_id, contact_info, created_at`,
      [name, national_id, contact_info, id]
    )
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    return res.json(result.rows[0])
  } catch {
    return sendError(res, 500, 'Failed to update owner.')
  }
})

app.delete('/api/owners/:id/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM spatial_data_owner WHERE id = $1', [req.params.id])
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    return res.status(204).send()
  } catch {
    return sendError(res, 500, 'Failed to delete owner.')
  }
})

async function listMineClaims(req, res) {
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
      SELECT mc.id, mc.claim_code, mc.owner_id AS owner, o.name AS owner_name, mc.area, mc.status, mc.created_at,
             ST_AsGeoJSON(mc.geom)::json AS geometry
      FROM spatial_data_mineclaim mc
      JOIN spatial_data_owner o ON o.id = mc.owner_id
      ${whereSql}
      ORDER BY mc.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    const [countResult, rowsResult] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, [...params, pageSize, offset]),
    ])
    const features = rowsResult.rows.map((row) => toFeature(row, {
      id: row.id,
      claim_code: row.claim_code,
      owner: row.owner,
      owner_name: row.owner_name,
      area: row.area,
      status: row.status,
      created_at: row.created_at,
    }))
    return res.json(geoCollectionResponse(countResult.rows[0].count, features))
  } catch {
    return sendError(res, 500, 'Failed to fetch mine claims.')
  }
}

app.get('/api/mine-claims/', authMiddleware, listMineClaims)

app.get('/api/mine-claims/:id/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT mc.id, mc.claim_code, mc.owner_id AS owner, o.name AS owner_name, mc.area, mc.status, mc.created_at,
              ST_AsGeoJSON(mc.geom)::json AS geometry
       FROM spatial_data_mineclaim mc
       JOIN spatial_data_owner o ON o.id = mc.owner_id
       WHERE mc.id = $1`,
      [req.params.id]
    )
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    const row = result.rows[0]
    return res.json(toFeature(row, {
      id: row.id,
      claim_code: row.claim_code,
      owner: row.owner,
      owner_name: row.owner_name,
      area: row.area,
      status: row.status,
      created_at: row.created_at,
    }))
  } catch {
    return sendError(res, 500, 'Failed to fetch mine claim.')
  }
})

app.post('/api/mine-claims/', authMiddleware, async (req, res) => {
  const { claim_code, owner, area, status = 'ACTIVE', geom } = req.body || {}
  if (!claim_code || !owner || area === undefined || !geom) {
    return sendError(res, 400, 'claim_code, owner, area, and geom are required.')
  }

  try {
    const inserted = await pool.query(
      `INSERT INTO spatial_data_mineclaim (claim_code, owner_id, area, status, created_at, geom)
       VALUES ($1, $2, $3, $4, NOW(), ST_SetSRID(ST_GeomFromGeoJSON($5), 4326))
       RETURNING id`,
      [claim_code, owner, area, status, JSON.stringify(geom)]
    )
    const id = inserted.rows[0].id
    const result = await pool.query(
      `SELECT mc.id, mc.claim_code, mc.owner_id AS owner, o.name AS owner_name, mc.area, mc.status, mc.created_at,
              ST_AsGeoJSON(mc.geom)::json AS geometry
       FROM spatial_data_mineclaim mc
       JOIN spatial_data_owner o ON o.id = mc.owner_id
       WHERE mc.id = $1`,
      [id]
    )
    const row = result.rows[0]
    return res.status(201).json(toFeature(row, {
      id: row.id,
      claim_code: row.claim_code,
      owner: row.owner,
      owner_name: row.owner_name,
      area: row.area,
      status: row.status,
      created_at: row.created_at,
    }))
  } catch (error) {
    if (error.code === '23505') return sendError(res, 400, 'A mine claim with this code already exists.')
    return sendError(res, 500, 'Failed to create mine claim.')
  }
})

app.put('/api/mine-claims/:id/', authMiddleware, async (req, res) => {
  const { claim_code, owner, area, status, geom } = req.body || {}
  const updates = []
  const values = []

  if (claim_code !== undefined) { values.push(claim_code); updates.push(`claim_code = $${values.length}`) }
  if (owner !== undefined) { values.push(owner); updates.push(`owner_id = $${values.length}`) }
  if (area !== undefined) { values.push(area); updates.push(`area = $${values.length}`) }
  if (status !== undefined) { values.push(status); updates.push(`status = $${values.length}`) }
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

    const response = await pool.query(
      `SELECT mc.id, mc.claim_code, mc.owner_id AS owner, o.name AS owner_name, mc.area, mc.status, mc.created_at,
              ST_AsGeoJSON(mc.geom)::json AS geometry
       FROM spatial_data_mineclaim mc
       JOIN spatial_data_owner o ON o.id = mc.owner_id
       WHERE mc.id = $1`,
      [req.params.id]
    )
    const row = response.rows[0]
    return res.json(toFeature(row, {
      id: row.id,
      claim_code: row.claim_code,
      owner: row.owner,
      owner_name: row.owner_name,
      area: row.area,
      status: row.status,
      created_at: row.created_at,
    }))
  } catch {
    return sendError(res, 500, 'Failed to update mine claim.')
  }
})

app.delete('/api/mine-claims/:id/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM spatial_data_mineclaim WHERE id = $1', [req.params.id])
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    return res.status(204).send()
  } catch {
    return sendError(res, 500, 'Failed to delete mine claim.')
  }
})

app.get('/api/farm-parcels/', authMiddleware, async (req, res) => {
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
      SELECT fp.id, fp.parcel_code, fp.owner_id AS owner, o.name AS owner_name, fp.land_use, fp.area, fp.created_at,
             ST_AsGeoJSON(fp.geom)::json AS geometry
      FROM spatial_data_farmparcel fp
      JOIN spatial_data_owner o ON o.id = fp.owner_id
      ${whereSql}
      ORDER BY fp.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    const [countResult, rowsResult] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, [...params, pageSize, offset]),
    ])
    const features = rowsResult.rows.map((row) => toFeature(row, {
      id: row.id,
      parcel_code: row.parcel_code,
      owner: row.owner,
      owner_name: row.owner_name,
      land_use: row.land_use,
      area: row.area,
      created_at: row.created_at,
    }))
    return res.json(geoCollectionResponse(countResult.rows[0].count, features))
  } catch {
    return sendError(res, 500, 'Failed to fetch farm parcels.')
  }
})

app.get('/api/farm-parcels/:id/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT fp.id, fp.parcel_code, fp.owner_id AS owner, o.name AS owner_name, fp.land_use, fp.area, fp.created_at,
              ST_AsGeoJSON(fp.geom)::json AS geometry
       FROM spatial_data_farmparcel fp
       JOIN spatial_data_owner o ON o.id = fp.owner_id
       WHERE fp.id = $1`,
      [req.params.id]
    )
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    const row = result.rows[0]
    return res.json(toFeature(row, {
      id: row.id,
      parcel_code: row.parcel_code,
      owner: row.owner,
      owner_name: row.owner_name,
      land_use: row.land_use,
      area: row.area,
      created_at: row.created_at,
    }))
  } catch {
    return sendError(res, 500, 'Failed to fetch farm parcel.')
  }
})

app.post('/api/farm-parcels/', authMiddleware, async (req, res) => {
  const { parcel_code, owner, land_use = '', area = null, geom } = req.body || {}
  if (!parcel_code || !owner || !geom) {
    return sendError(res, 400, 'parcel_code, owner, and geom are required.')
  }

  try {
    const inserted = await pool.query(
      `INSERT INTO spatial_data_farmparcel (parcel_code, owner_id, land_use, area, created_at, geom)
       VALUES ($1, $2, $3, $4, NOW(), ST_SetSRID(ST_GeomFromGeoJSON($5), 4326))
       RETURNING id`,
      [parcel_code, owner, land_use, area, JSON.stringify(geom)]
    )
    const id = inserted.rows[0].id
    const result = await pool.query(
      `SELECT fp.id, fp.parcel_code, fp.owner_id AS owner, o.name AS owner_name, fp.land_use, fp.area, fp.created_at,
              ST_AsGeoJSON(fp.geom)::json AS geometry
       FROM spatial_data_farmparcel fp
       JOIN spatial_data_owner o ON o.id = fp.owner_id
       WHERE fp.id = $1`,
      [id]
    )
    const row = result.rows[0]
    return res.status(201).json(toFeature(row, {
      id: row.id,
      parcel_code: row.parcel_code,
      owner: row.owner,
      owner_name: row.owner_name,
      land_use: row.land_use,
      area: row.area,
      created_at: row.created_at,
    }))
  } catch (error) {
    if (error.code === '23505') return sendError(res, 400, 'A farm parcel with this code already exists.')
    return sendError(res, 500, 'Failed to create farm parcel.')
  }
})

app.put('/api/farm-parcels/:id/', authMiddleware, async (req, res) => {
  const { parcel_code, owner, land_use, area, geom } = req.body || {}
  const updates = []
  const values = []

  if (parcel_code !== undefined) { values.push(parcel_code); updates.push(`parcel_code = $${values.length}`) }
  if (owner !== undefined) { values.push(owner); updates.push(`owner_id = $${values.length}`) }
  if (land_use !== undefined) { values.push(land_use); updates.push(`land_use = $${values.length}`) }
  if (area !== undefined) { values.push(area); updates.push(`area = $${values.length}`) }
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
    const response = await pool.query(
      `SELECT fp.id, fp.parcel_code, fp.owner_id AS owner, o.name AS owner_name, fp.land_use, fp.area, fp.created_at,
              ST_AsGeoJSON(fp.geom)::json AS geometry
       FROM spatial_data_farmparcel fp
       JOIN spatial_data_owner o ON o.id = fp.owner_id
       WHERE fp.id = $1`,
      [req.params.id]
    )
    const row = response.rows[0]
    return res.json(toFeature(row, {
      id: row.id,
      parcel_code: row.parcel_code,
      owner: row.owner,
      owner_name: row.owner_name,
      land_use: row.land_use,
      area: row.area,
      created_at: row.created_at,
    }))
  } catch {
    return sendError(res, 500, 'Failed to update farm parcel.')
  }
})

app.delete('/api/farm-parcels/:id/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM spatial_data_farmparcel WHERE id = $1', [req.params.id])
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    return res.status(204).send()
  } catch {
    return sendError(res, 500, 'Failed to delete farm parcel.')
  }
})

app.get('/api/boundaries/', authMiddleware, async (req, res) => {
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

app.get('/api/disputes/', authMiddleware, async (req, res) => {
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
      SELECT d.id, d.mine_claim_id AS mine_claim, d.farm_parcel_id AS farm_parcel,
             mc.claim_code AS mine_claim_code, fp.parcel_code AS farm_parcel_code,
             d.conflict_area, d.status, d.detected_at, d.resolved_at,
             ST_AsGeoJSON(d.geom)::json AS geometry
      FROM disputes_dispute d
      JOIN spatial_data_mineclaim mc ON mc.id = d.mine_claim_id
      JOIN spatial_data_farmparcel fp ON fp.id = d.farm_parcel_id
      ${whereSql}
      ORDER BY d.detected_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    const [countResult, rowsResult] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, [...params, pageSize, offset]),
    ])
    const features = rowsResult.rows.map((row) => toFeature(row, {
      id: row.id,
      mine_claim: row.mine_claim,
      farm_parcel: row.farm_parcel,
      mine_claim_code: row.mine_claim_code,
      farm_parcel_code: row.farm_parcel_code,
      conflict_area: row.conflict_area,
      status: row.status,
      detected_at: row.detected_at,
      resolved_at: row.resolved_at,
    }))
    return res.json(geoCollectionResponse(countResult.rows[0].count, features))
  } catch {
    return sendError(res, 500, 'Failed to fetch disputes.')
  }
})

app.get('/api/disputes/:id/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.mine_claim_id AS mine_claim, d.farm_parcel_id AS farm_parcel,
              mc.claim_code AS mine_claim_code, fp.parcel_code AS farm_parcel_code,
              d.conflict_area, d.status, d.detected_at, d.resolved_at,
              ST_AsGeoJSON(d.geom)::json AS geometry
       FROM disputes_dispute d
       JOIN spatial_data_mineclaim mc ON mc.id = d.mine_claim_id
       JOIN spatial_data_farmparcel fp ON fp.id = d.farm_parcel_id
       WHERE d.id = $1`,
      [req.params.id]
    )
    if (result.rowCount === 0) return sendError(res, 404, 'Not found.')
    const row = result.rows[0]
    return res.json(toFeature(row, {
      id: row.id,
      mine_claim: row.mine_claim,
      farm_parcel: row.farm_parcel,
      mine_claim_code: row.mine_claim_code,
      farm_parcel_code: row.farm_parcel_code,
      conflict_area: row.conflict_area,
      status: row.status,
      detected_at: row.detected_at,
      resolved_at: row.resolved_at,
    }))
  } catch {
    return sendError(res, 500, 'Failed to fetch dispute.')
  }
})

app.get('/api/hotspots/', authMiddleware, async (req, res) => {
  const { pageSize, offset } = getPagination(req)
  try {
    const [countResult, rowsResult] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM disputes_hotspot'),
      pool.query(
        `SELECT id, intensity, dispute_count, created_at, ST_AsGeoJSON(geom)::json AS geometry
         FROM disputes_hotspot
         ORDER BY intensity DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      ),
    ])
    const features = rowsResult.rows.map((row) => toFeature(row, {
      id: row.id,
      intensity: row.intensity,
      dispute_count: row.dispute_count,
      created_at: row.created_at,
    }))
    return res.json(geoCollectionResponse(countResult.rows[0].count, features))
  } catch {
    return sendError(res, 500, 'Failed to fetch hotspots.')
  }
})

app.post('/api/analysis/run-conflict-detection/', authMiddleware, async (_req, res) => {
  try {
    const result = await pool.query(
      `
      WITH inserted AS (
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
        LEFT JOIN disputes_dispute d
          ON d.mine_claim_id = mc.id AND d.farm_parcel_id = fp.id
        WHERE mc.status IN ('ACTIVE', 'DISPUTED')
          AND d.id IS NULL
      )
      SELECT COUNT(*)::int AS created_count FROM inserted;
      `
    )
    const count = result.rows[0]?.created_count || 0
    return res.json({
      message: `${count} new conflict(s) detected.`,
      new_disputes: count,
    })
  } catch {
    return sendError(res, 500, 'Failed to run conflict detection.')
  }
})

app.get('/api/analysis/buffer-risks/', authMiddleware, async (req, res) => {
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

app.post('/api/analysis/run-hotspot-analysis/', authMiddleware, async (req, res) => {
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

app.get('/api/reports/summary/', authMiddleware, async (_req, res) => {
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

app.get('/api/reports/disputes/csv/', authMiddleware, async (_req, res) => {
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
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="disputes_report.csv"')
    return res.send(csv)
  } catch {
    return sendError(res, 500, 'Failed to generate disputes CSV.')
  }
})

app.get('/api/reports/mine-claims/csv/', authMiddleware, async (_req, res) => {
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
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="mine_claims_report.csv"')
    return res.send(csv)
  } catch {
    return sendError(res, 500, 'Failed to generate mine claims CSV.')
  }
})

app.get('/api/reports/farm-parcels/csv/', authMiddleware, async (_req, res) => {
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
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="farm_parcels_report.csv"')
    return res.send(csv)
  } catch {
    return sendError(res, 500, 'Failed to generate farm parcels CSV.')
  }
})

app.use('/api', (_req, res) => sendError(res, 404, 'Not found.'))

app.use((err, _req, res, _next) => {
  if (err?.message === 'Not allowed by CORS') return sendError(res, 403, err.message)
  return sendError(res, 500, 'Internal server error.')
})

async function bootstrap() {
  await ensureNodeUsersTable()
  app.listen(PORT, () => {
    console.log(`Node backend running on http://localhost:${PORT}`)
  })
}

bootstrap().catch((error) => {
  console.error('Failed to start backend:', error.message)
  process.exit(1)
})
