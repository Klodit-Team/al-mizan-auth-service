const bcrypt = require('bcryptjs')
const sequelize = require('../config/db')
const User = require('../models/User')
const RefreshToken = require('../models/RefreshToken')
const {
  generateAccessToken,
  generateRefreshToken,
  blacklistToken,
  isBlacklisted,
  rotateRefreshToken,
  validateRefreshToken,
  revokeAllRefreshTokens,
  verifyAccessToken,
  getActiveSessions,
  revokeSession,
} = require('../services/tokenService')
const MAX_ATTEMPTS = 5
const BLOCK_DURATION = 15 * 60 // 15 minutes
const { client: redis } = require('../config/redis')


const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
}

// ── REGISTER ───────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' })

    // Transaction — si create fail, rien n'est sauvegardé
    const user = await sequelize.transaction(async (t) => {
      const exists = await User.findOne({ where: { email }, transaction: t })
      if (exists) throw new Error('EMAIL_EXISTS')

      const hashed = await bcrypt.hash(password, 12)
      return await User.create({ email, password: hashed }, { transaction: t })
    })

    res.status(201).json({
      message: 'User created',
      user: { id: user.id, email: user.email }
    })
  } catch (err) {
    if (err.message === 'EMAIL_EXISTS')
      return res.status(400).json({ message: 'Email already exists' })
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}


// ── BRUTE FORCE FUNCTIONS ──────────────────────────────────────

const isAccountBlocked = async (email) => {
  const blocked = await redis.get(`login:blocked:${email}`)
  return blocked !== null
}

const getBlockRemainingTime = async (email) => {
  const ttl = await redis.ttl(`login:blocked:${email}`)
  return Math.ceil(ttl / 60)
}

const recordFailedAttempt = async (email) => {
  const attemptsKey = `login:attempts:${email}`
  const attempts = await redis.incr(attemptsKey)

  if (attempts === 1) {
    await redis.expire(attemptsKey, BLOCK_DURATION)
  }

  if (attempts >= MAX_ATTEMPTS) {
    await redis.setEx(`login:blocked:${email}`, BLOCK_DURATION, 'true')
    await redis.del(attemptsKey)
    return { blocked: true }
  }

  return { blocked: false, remaining: MAX_ATTEMPTS - attempts }
}

const resetBruteForce = async (email) => {
  await redis.del(`login:attempts:${email}`)
  await redis.del(`login:blocked:${email}`)
}

// ── AUTH CONTROLLERS ───────────────────────────────────────────

const login = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' })

    // 1. Vérifier si bloqué
    if (await isAccountBlocked(email)) {
      const minutes = await getBlockRemainingTime(email)
      return res.status(429).json({
        message: `Account locked. Try again in ${minutes} minute(s)`,
      })
    }

    // 2. Vérifier user + password
    const user = await User.findOne({ where: { email } })
    const valid = user ? await bcrypt.compare(password, user.password) : false

    if (!user || !valid) {
      // 3. Enregistrer tentative échouée
      const result = await recordFailedAttempt(email)

      if (result.blocked) {
        return res.status(429).json({
          message: 'Too many failed attempts. Account locked for 15 minutes',
        })
      }

      return res.status(401).json({
        message: 'Invalid credentials',
        attemptsRemaining: result.remaining,
      })
    }

    // 4. Login réussi → reset brute force
    await resetBruteForce(email)

    // 5. Générer tokens
    const deviceInfo = req.headers['user-agent']
    const ipAddress = req.ip

    const { accessToken, refreshToken } = await sequelize.transaction(async (t) => {
      const accessToken = generateAccessToken(user.id, user.email)
      const refreshToken = await generateRefreshToken(user.id, deviceInfo, ipAddress, t)
      return { accessToken, refreshToken }
    })

    // 6. Set cookies
    res.cookie('access_token', accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000,
    })
    res.cookie('refresh_token', refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth/refresh',
    })

    res.json({ message: 'Logged in successfully' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}


// ── REFRESH ────────────────────────────────────────────────────
const refresh = async (req, res) => {
  try {
    const token = req.cookies.refresh_token
    if (!token) return res.status(401).json({ message: 'No refresh token' })

    const stored = await validateRefreshToken(token)
    if (!stored) return res.status(403).json({ message: 'Invalid or expired refresh token' })

    const user = await User.findByPk(stored.userId)
    const deviceInfo = req.headers['user-agent']
    const ipAddress = req.ip

    // Transaction — rotate refresh + new access token
    const { newAccessToken, newRefreshToken } = await sequelize.transaction(async (t) => {
      const newRefreshToken = await rotateRefreshToken(token, stored.userId, deviceInfo, ipAddress)
      const newAccessToken = generateAccessToken(user.id, user.email)
      return { newAccessToken, newRefreshToken }
    })

    res.cookie('access_token', newAccessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000,
    })
    res.cookie('refresh_token', newRefreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth/refresh',
    })

    res.json({ message: 'Token refreshed' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

// ── LOGOUT ────────────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    const accessToken = req.cookies.access_token
    const refreshToken = req.cookies.refresh_token

    // Blacklist access token in Redis + delete refresh token
    if (accessToken) await blacklistToken(accessToken)
    if (refreshToken) {
      await RefreshToken.destroy({ where: { token: refreshToken } })
    }

    res.clearCookie('access_token')
    res.clearCookie('refresh_token', { path: '/auth/refresh' })
    res.json({ message: 'Logged out successfully' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

// ── LOGOUT ALL ─────────────────────────────────────────────────
const logoutAll = async (req, res) => {
  try {
    const accessToken = req.cookies.access_token
    if (accessToken) {
      const decoded = verifyAccessToken(accessToken)
      await blacklistToken(accessToken)
      await revokeAllRefreshTokens(decoded.userId)
    }

    res.clearCookie('access_token')
    res.clearCookie('refresh_token', { path: '/auth/refresh' })
    res.json({ message: 'Logged out from all devices' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

// ── ME ─────────────────────────────────────────────────────────
const me = async (req, res) => {
  res.json({ user: req.user })
}

// ── SESSIONS ───────────────────────────────────────────────────
const sessions = async (req, res) => {
  const active = await getActiveSessions(req.user.userId)
  res.json({ sessions: active })
}

const deleteSession = async (req, res) => {
  await revokeSession(req.params.id, req.user.userId)
  res.json({ message: 'Session revoked' })
}

module.exports = { register, login, refresh, logout, logoutAll, me, sessions, deleteSession }