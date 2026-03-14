import bcrypt from 'bcryptjs'
import type { Request, Response } from 'express'
import prisma from '../config/db.js'
import * as userService from '../services/userService.js'
import * as tokenService from '../services/tokenService.js'
import { client as redis } from '../config/redis.js'

const MAX_ATTEMPTS = 5
const BLOCK_DURATION = 15 * 60 // 15 minutes

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
}

// ─── Brute force helpers ───────────────────────────────────────────────────

const isAccountBlocked = async (email: string): Promise<boolean> => {
  const blocked = await redis.get(`login:blocked:${email}`)
  return blocked !== null
}

const getBlockRemainingTime = async (email: string): Promise<number> => {
  const ttl = await redis.ttl(`login:blocked:${email}`)
  return Math.ceil(ttl / 60)
}

const recordFailedAttempt = async (email: string) => {
  const attemptsKey = `login:attempts:${email}`
  const attempts = await redis.incr(attemptsKey)

  if (attempts === 1) {
    await redis.expire(attemptsKey, BLOCK_DURATION)
  }

  if (attempts >= MAX_ATTEMPTS) {
    await redis.setEx(`login:blocked:${email}`, BLOCK_DURATION, 'true')
    await redis.del(attemptsKey)
    return { blocked: true as const }
  }

  return { blocked: false as const, remaining: MAX_ATTEMPTS - attempts }
}

const resetBruteForce = async (email: string): Promise<void> => {
  await redis.del(`login:attempts:${email}`)
  await redis.del(`login:blocked:${email}`)
}

// ─── Controllers ───────────────────────────────────────────────────────────

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ message: 'Email and password required' })
      return
    }

    const user = await prisma.$transaction(async (t) => {
      const exists = await t.user.findUnique({ where: { email } })
      if (exists) throw new Error('EMAIL_EXISTS')

      const hashed = await bcrypt.hash(password, 12)
      return t.user.create({ data: { email, password: hashed } })
    })

    res.status(201).json({ message: 'User created', user: { id: user.id, email: user.email } })
  } catch (err: any) {
    if (err.message === 'EMAIL_EXISTS') {
      res.status(400).json({ message: 'Email already exists' })
      return
    }
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ message: 'Email and password required' })
      return
    }

    if (await isAccountBlocked(email)) {
      const minutes = await getBlockRemainingTime(email)
      res.status(429).json({ message: `Account locked. Try again in ${minutes} minute(s)` })
      return
    }

    const user = await userService.findByEmail(email)
    const valid = user ? await bcrypt.compare(password, user.password) : false

    if (!user || !valid) {
      const result = await recordFailedAttempt(email)

      if (result.blocked) {
        res.status(429).json({ message: 'Too many failed attempts. Account locked for 15 minutes' })
        return
      }

      res.status(401).json({ message: 'Invalid credentials', attemptsRemaining: result.remaining })
      return
    }

    await resetBruteForce(email)

    const deviceInfo = req.headers['user-agent'] as string | undefined
     const ipAddress = req.ip ?? 'unknown'
    const { accessToken, refreshToken } = await prisma.$transaction(async (t) => {
      const accessToken = tokenService.generateAccessToken(user.id, user.email)
      const refreshToken = await tokenService.generateRefreshToken(user.id, deviceInfo, ipAddress, t)
      return { accessToken, refreshToken }
    })

    res.cookie('access_token', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 })
    res.cookie('refresh_token', refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth/refresh',
    })

    res.json({ message: 'Logged in successfully' })
  } catch (err: any) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = (req as any).cookies?.refresh_token
    if (!token) {
      res.status(401).json({ message: 'No refresh token' })
      return
    }

    const stored = await tokenService.validateRefreshToken(token)
    if (!stored) {
      res.status(403).json({ message: 'Invalid or expired refresh token' })
      return
    }

    const user = await userService.findById(stored.userId)
    const deviceInfo = req.headers['user-agent'] as string | undefined
     const ipAddress = req.ip ?? 'unknown'

    const { newAccessToken, newRefreshToken } = await prisma.$transaction(async (t) => {
      const newRefreshToken = await tokenService.rotateRefreshToken(token, stored.userId, deviceInfo, ipAddress)
      const newAccessToken = tokenService.generateAccessToken(user!.id, user!.email)
      return { newAccessToken, newRefreshToken }
    })

    res.cookie('access_token', newAccessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 })
    res.cookie('refresh_token', newRefreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth/refresh',
    })

    res.json({ message: 'Token refreshed' })
  } catch (err: any) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const accessToken = (req as any).cookies?.access_token
    const refreshToken = (req as any).cookies?.refresh_token

    if (accessToken) await tokenService.blacklistToken(accessToken)
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
    }

    res.clearCookie('access_token')
    res.clearCookie('refresh_token', { path: '/auth/refresh' })
    res.json({ message: 'Logged out successfully' })
  } catch (err: any) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const logoutAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const accessToken = (req as any).cookies?.access_token
    if (accessToken) {
      const decoded: any = tokenService.verifyAccessToken(accessToken)
      await tokenService.blacklistToken(accessToken)
      await tokenService.revokeAllRefreshTokens(decoded.userId)
    }

    res.clearCookie('access_token')
    res.clearCookie('refresh_token', { path: '/auth/refresh' })
    res.json({ message: 'Logged out from all devices' })
  } catch (err: any) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const me = async (req: Request, res: Response): Promise<void> => {
  res.json({ user: (req as any).user })
}

export const sessions = async (req: Request, res: Response): Promise<void> => {
  const active = await tokenService.getActiveSessions((req as any).user.userId)
  res.json({ sessions: active })
}

export const deleteSession = async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.params['id'] as string
  await tokenService.revokeSession(sessionId, (req as any).user.userId)
  res.json({ message: 'Session revoked' })
}

export default { register, login, refresh, logout, logoutAll, me, sessions, deleteSession }