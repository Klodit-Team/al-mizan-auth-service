const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { Op } = require('sequelize')
const sequelize = require('../config/db')
const RefreshToken = require('../models/RefreshToken')
const { client: redis } = require('../config/redis')

const MAX_SESSIONS = 3

// ── GENERATE ACCESS TOKEN ──────────────────────────────────────
const generateAccessToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY } // 15min
  )
}

// ── GENERATE REFRESH TOKEN avec session limit ──────────────────
const generateRefreshToken = async (userId, deviceInfo, ipAddress, transaction) => {
  // Compter sessions actives
  const activeCount = await RefreshToken.count({
    where: {
      userId,
      expiresAt: { [Op.gt]: new Date() },
    },
    transaction,
  })

  // Si limite atteinte → kick le plus ancien
  if (activeCount >= MAX_SESSIONS) {
    const oldest = await RefreshToken.findOne({
      where: { userId },
      order: [['created_at', 'ASC']],
      transaction,
    })

    if (oldest) await oldest.destroy({ transaction })
  }

  const token = crypto.randomBytes(64).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await RefreshToken.create({
    userId,
    token,
    expiresAt,
    deviceInfo,
    ipAddress,
  }, { transaction })

  return token
}

// ── VERIFY ACCESS TOKEN ────────────────────────────────────────
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
}

// ── BLACKLIST ACCESS TOKEN in Redis ───────────────────────────
const blacklistToken = async (token) => {
  const decoded = jwt.decode(token)
  const ttl = decoded.exp - Math.floor(Date.now() / 1000)
  if (ttl > 0) {
    await redis.setEx(`blacklist:${token}`, ttl, 'true')
  }
}

// ── CHECK BLACKLIST ────────────────────────────────────────────
const isBlacklisted = async (token) => {
  const result = await redis.get(`blacklist:${token}`)
  return result !== null
}

// ── ROTATE REFRESH TOKEN avec transaction ─────────────────────
const rotateRefreshToken = async (oldToken, userId, deviceInfo, ipAddress) => {
  // Transaction — delete + create doivent réussir ensemble
  return await sequelize.transaction(async (t) => {
    await RefreshToken.destroy({
      where: { token: oldToken },
      transaction: t,
    })

    return await generateRefreshToken(userId, deviceInfo, ipAddress, t)
  })
}

// ── VALIDATE REFRESH TOKEN ─────────────────────────────────────
const validateRefreshToken = async (token) => {
  return await RefreshToken.findOne({
    where: {
      token,
      expiresAt: { [Op.gt]: new Date() },
    },
  })
}

// ── REVOKE ALL TOKENS (logout all devices) ────────────────────
const revokeAllRefreshTokens = async (userId) => {
  await RefreshToken.destroy({ where: { userId } })
}

// ── GET ACTIVE SESSIONS ────────────────────────────────────────
const getActiveSessions = async (userId) => {
  return await RefreshToken.findAll({
    where: {
      userId,
      expiresAt: { [Op.gt]: new Date() },
    },
    attributes: ['id', 'deviceInfo', 'ipAddress', 'createdAt', 'expiresAt'],
    order: [['created_at', 'DESC']],
  })
}

// ── REVOKE ONE SESSION ─────────────────────────────────────────
const revokeSession = async (sessionId, userId) => {
  await RefreshToken.destroy({
    where: { id: sessionId, userId },
  })
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  blacklistToken,
  isBlacklisted,
  rotateRefreshToken,
  validateRefreshToken,
  revokeAllRefreshTokens,
  getActiveSessions,
  revokeSession,
}