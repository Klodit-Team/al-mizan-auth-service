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
      await prisma.session.deleteMany({ where: { token: refreshToken } })
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

// ─── Password Reset ────────────────────────────────────────────────────────
import crypto from 'crypto'
const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex')
}
const RESET_TOKEN_EXPIRY = 1 * 60 * 60 * 1000 // 1 heure

const getValidResetRecord = async (token: string) => {
  const resetRecord = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!resetRecord) throw new Error('Invalid or expired token')
  if (resetRecord.expiresAt < new Date()) throw new Error('Token has expired')
  if (resetRecord.used) throw new Error('Token has already been used')

  return resetRecord
}
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body

    if (!email) {
      res.status(400).json({ message: 'Email required' })
      return
    }

    const user = await userService.findByEmail(email)

    if (!user) {
      // Sécurité : on ne révèle pas si l'email existe
      res.status(200).json({ message: 'If email exists, a reset link has been sent' })
      return
    }

    const token = generateResetToken()
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY)

    await prisma.passwordReset.create({
      data: {
        token,
        expiresAt,
        userId: user.id,
      },
    })

    // TODO: await sendResetEmail(user.email, token)

    res.status(200).json({
      message: 'If email exists, a reset link has been sent',
      token, 
    
    })
  } catch (err: any) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const verifyResetToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body

    if (!token) {
      res.status(400).json({ message: 'Token required' })
      return
    }

    const resetRecord = await getValidResetRecord(token) 

    res.status(200).json({
      message: 'Token is valid',
      email: resetRecord.user.email,
    })
  } catch (err: any) {
    res.status(400).json({ message: err.message })
  }
}
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword, confirmeNewPassword } = req.body

    // ── Validations ──────────────────────────────────────
    if (!token || !newPassword || !confirmeNewPassword) {
      res.status(400).json({ message: 'Token and new password required' })
      return
    }

    if (newPassword.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters' })
      return
    }

    if (newPassword !== confirmeNewPassword) {
      res.status(400).json({ message: 'Password and confirm password do not match' })
      return
    }

    // ── Vérifier le token ────────────────────────────────
    const resetRecord = await getValidResetRecord(token)

    // ── Transaction ──────────────────────────────────────
    await prisma.$transaction(async (t) => {
      const hashedPassword = await bcrypt.hash(newPassword, 12)

      // 1. Mettre à jour le mot de passe
      await t.user.update({
        where: { id: resetRecord.userId },
        data: { password: hashedPassword },
      })

      // 2. Marquer le token comme utilisé
      await t.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true },
      })

      // 3. Supprimer tous les sessions (sécurité)
      await t.session.deleteMany({
        where: { userId: resetRecord.userId },
      })
    })
     res.status(200).json({ message: 'Password reset successfully. Please login with your new password.' })
  } catch (err: any) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}
export default { register, login, refresh, logout, logoutAll, me, sessions, deleteSession, forgotPassword, verifyResetToken, resetPassword }