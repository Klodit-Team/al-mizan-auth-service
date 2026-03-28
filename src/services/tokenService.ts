import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import prisma from '../config/db.js'
import { client as redis } from '../config/redis.js'

const MAX_SESSIONS = 3

export const generateAccessToken = (userId: string, email: string): string => {
  const opts: any = { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  return jwt.sign({ userId, email }, process.env.ACCESS_TOKEN_SECRET as string, opts)
}

export const generateRefreshToken = async (
  userId: string,
  deviceInfo?: string | null,
  ipAddress?: string | null,
  tx?: any
): Promise<string> => {
  const client = tx ?? prisma

  // Count active sessions
  const activeCount = await client.session.count({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
  })

  if (activeCount >= MAX_SESSIONS) {
    const oldest = await client.session.findFirst({
      where: { userId },
      orderBy: { created_at: 'asc' },
    })

    if (oldest) {
      await client.session.delete({ where: { id: oldest.id } })
    }
  }

  const token = crypto.randomBytes(64).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await client.session.create({
    data: { userId, token, expiresAt, deviceInfo, ipAddress },
  })

  return token
}

export const verifyAccessToken = (token: string): any => {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string)
}

export const blacklistToken = async (token: string): Promise<void> => {
  const decoded: any = jwt.decode(token) as any
  if (!decoded || !decoded.exp) return
  const ttl = decoded.exp - Math.floor(Date.now() / 1000)
  if (ttl > 0) {
    await redis.setEx(`blacklist:${token}`, ttl, 'true')
  }
}

export const isBlacklisted = async (token: string): Promise<boolean> => {
  const result = await redis.get(`blacklist:${token}`)
  return result !== null
}

export const rotateRefreshToken = async (
  oldToken: string,
  userId: string,
  deviceInfo?: string | null,
  ipAddress?: string | null
): Promise<string> => {
  return await prisma.$transaction(async (t: any) => {
    await t.session.deleteMany({ where: { token: oldToken } })
    return await generateRefreshToken(userId, deviceInfo, ipAddress, t)
  })
}

export const validateRefreshToken = async (token: string) => {
  return await prisma.session.findFirst({
    where: { token, expiresAt: { gt: new Date() } },
  })
}

export const revokeAllRefreshTokens = async (userId: string): Promise<void> => {
  await prisma.session.deleteMany({ where: { userId } })
}

export const getActiveSessions = async (userId: string) => {
  return await prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: { id: true, deviceInfo: true, ipAddress: true, created_at: true, expiresAt: true },
    orderBy: { created_at: 'desc' },
  })
}

export const revokeSession = async (sessionId: string, userId: string): Promise<void> => {
  await prisma.session.deleteMany({ where: { id: sessionId, userId } })
}

export default {
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
