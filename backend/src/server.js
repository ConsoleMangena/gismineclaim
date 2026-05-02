const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')

dotenv.config()

const { pool, ensureNodeUsersTable } = require('./config/db')
const { sendError } = require('./helpers/utils')
const { validateSecrets } = require('./middleware/auth')
const { apiLimiter } = require('./middleware/rateLimiter')

const usersRouter = require('./routes/users')
const ownersRouter = require('./routes/owners')
const mineClaimsRouter = require('./routes/mineClaims')
const farmParcelsRouter = require('./routes/farmParcels')
const boundariesRouter = require('./routes/boundaries')
const disputesRouter = require('./routes/disputes')
const mineDisputesRouter = require('./routes/mineDisputes')
const hotspotsRouter = require('./routes/hotspots')
const analysisRouter = require('./routes/analysis')
const reportsRouter = require('./routes/reports')
const trigStationsRouter = require('./routes/trigStations')

const app = express()

const PORT = Number(process.env.PORT || 3000)
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean)

app.use(cors({
  origin(origin, callback) {
    if (!origin || CORS_ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    return callback(new Error('Not allowed by CORS'))
  },
}))
app.use(express.json({ limit: '2mb' }))
app.use('/api', apiLimiter)

app.get('/api/health/', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok' })
  } catch {
    sendError(res, 500, 'Database unavailable')
  }
})

app.use('/api/users', usersRouter)
app.use('/api/owners', ownersRouter)
app.use('/api/mine-claims', mineClaimsRouter)
app.use('/api/farm-parcels', farmParcelsRouter)
app.use('/api/boundaries', boundariesRouter)
app.use('/api/disputes', disputesRouter)
app.use('/api/mine-disputes', mineDisputesRouter)
app.use('/api/hotspots', hotspotsRouter)
app.use('/api/analysis', analysisRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/trig-stations', trigStationsRouter)

app.use('/api', (_req, res) => sendError(res, 404, 'Not found.'))

app.use((err, _req, res, _next) => {
  if (err?.message === 'Not allowed by CORS') return sendError(res, 403, err.message)
  return sendError(res, 500, 'Internal server error.')
})

async function bootstrap() {
  validateSecrets()
  await ensureNodeUsersTable()
  app.listen(PORT, () => {
    console.log(`Node backend running on http://localhost:${PORT}`)
  })
}

bootstrap().catch((error) => {
  console.error('Failed to start backend:', error.message)
  process.exit(1)
})
