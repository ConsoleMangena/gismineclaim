const jwt = require('jsonwebtoken')
const { sendError } = require('../helpers/utils')

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '1d'
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'

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

function validateSecrets() {
  if (!ACCESS_TOKEN_SECRET || ACCESS_TOKEN_SECRET.length < 32) {
    throw new Error('ACCESS_TOKEN_SECRET must be set and at least 32 characters long.')
  }
  if (!REFRESH_TOKEN_SECRET || REFRESH_TOKEN_SECRET.length < 32) {
    throw new Error('REFRESH_TOKEN_SECRET must be set and at least 32 characters long.')
  }
  if (ACCESS_TOKEN_SECRET === REFRESH_TOKEN_SECRET) {
    throw new Error('ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be different.')
  }
}

module.exports = {
  authMiddleware,
  createAccessToken,
  createRefreshToken,
  validateSecrets,
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
}
