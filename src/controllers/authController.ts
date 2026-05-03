import bcrypt from 'bcryptjs'
import type { Request, Response } from 'express'
import prisma from '../config/db.js'
import * as userService from '../services/userService.js'
import * as tokenService from '../services/tokenService.js'
import { client as redis } from '../config/redis.js'
import { publishToExchange } from '../rabbitmq.js'
import { OtpService } from '../services/otpService.js';


const MAX_ATTEMPTS = 5
const BLOCK_DURATION = 15 * 60 // 15 minutes
const SUPPORTED_LANGUAGES = new Set(['fr', 'ar'])
const SUPPORTED_ORGANISATION_TYPES = new Set([
  'EPA',
  'EPIC',
  'MINISTERE',
  'ENTREPRISE_PRIVEE',
  'ENTREPRISE_PUBLIQUE',
  'GROUPEMENT',
])

type RegisterRole = 'SERVICE_CONTRACTANT' | 'OPERATEUR_ECONOMIQUE'
type AuthRoleName =
  | 'ADMIN'
  | 'SERVICE_CONTRACTANT'
  | 'OPERATEUR_ECONOMIQUE'
  | 'MEMBRE_COMMISSION'
  | 'CONTROLEUR'
type DashboardUserType = 'admin' | 'contractant' | 'operateur'

interface UsersServiceUserRoleAssignment {
  role?: {
    name?: string
  }
}

interface UserRegisteredEventPayload {
  event_id: string
  user_id: string
  email: string
  role: RegisterRole
  langue?: string
  timestamp: string
  nom: string
  prenom: string
  telephone?: string
  denomination: string
  nif?: string
  nis?: string
  registre_commerce?: string
  adresse?: string
  wilaya?: string
  commune?: string
  type: string
  code_service?: string
  secteur_activite?: string
  ordonnateur?: string
  qualifications?: string
  categories?: string
}

interface UsersServiceRole {
  id: string
  name: string
}

class UsersServiceRequestError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'UsersServiceRequestError'
  }
}

const USERS_SERVICE_BASE_URL = (process.env.USERS_SERVICE_URL ?? 'http://localhost:3002').replace(/\/+$/, '')
const USERS_SERVICE_PREFIX = (() => {
  const prefix = (process.env.USERS_SERVICE_PREFIX ?? '/api/v1').trim()
  if (!prefix) return ''
  return prefix.startsWith('/') ? prefix.replace(/\/+$/, '') : `/${prefix.replace(/\/+$/, '')}`
})()

const usersServiceUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${USERS_SERVICE_BASE_URL}${USERS_SERVICE_PREFIX}${normalizedPath}`
}

const getUsersServiceErrorMessage = (payload: unknown, fallback: string): string => {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message
    if (Array.isArray(message)) {
      return message.join(', ')
    }
    if (typeof message === 'string') {
      return message
    }
  }
  return fallback
}

const usersServiceRequest = async <T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> => {
  const headers = new Headers()
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(usersServiceUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const raw = await response.text()
  let payload: unknown = null
  if (raw) {
    try {
      payload = JSON.parse(raw)
    } catch {
      payload = raw
    }
  }

  if (!response.ok) {
    const fallbackMessage = typeof payload === 'string' ? payload : response.statusText
    throw new UsersServiceRequestError(
      response.status,
      getUsersServiceErrorMessage(payload, fallbackMessage),
    )
  }

  return payload as T
}

const resolveFallbackLanguage = (langue: string | undefined): 'fr' | 'ar' => {
  if (langue === 'ar') {
    return 'ar'
  }
  return 'fr'
}

const resolveFallbackOrganisationType = (type: string | undefined): string => {
  if (typeof type !== 'string' || !type.trim()) {
    return 'ENTREPRISE_PRIVEE'
  }
  return type.trim().toUpperCase()
}

const getRoleIdForFallback = async (roleName: RegisterRole): Promise<string> => {
  const findRole = (roles: UsersServiceRole[]): UsersServiceRole | undefined =>
    roles.find((role) => role.name === roleName)

  let roles = await usersServiceRequest<UsersServiceRole[]>('GET', '/roles')
  let targetRole = findRole(roles)

  if (!targetRole) {
    await usersServiceRequest<UsersServiceRole[]>('POST', '/roles/seed-defaults')
    roles = await usersServiceRequest<UsersServiceRole[]>('GET', '/roles')
    targetRole = findRole(roles)
  }

  if (!targetRole) {
    throw new Error(`Role ${roleName} not found in users-service`)
  }

  return targetRole.id
}

const normalizeAuthRoleName = (value: unknown): AuthRoleName | null => {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')
    .toUpperCase()

  if (normalized === 'ADMIN') return 'ADMIN'
  if (normalized === 'SERVICE_CONTRACTANT' || normalized === 'CONTRACTANT' || normalized === 'SERVICECONTRACTANT') {
    return 'SERVICE_CONTRACTANT'
  }
  if (
    normalized === 'OPERATEUR_ECONOMIQUE' ||
    normalized === 'OPERATEUR' ||
    normalized === 'OPERATEURECONOMIQUE' ||
    (normalized.includes('OPERATEUR') && normalized.includes('ECONOM'))
  ) {
    return 'OPERATEUR_ECONOMIQUE'
  }
  if (normalized === 'MEMBRE_COMMISSION') return 'MEMBRE_COMMISSION'
  if (normalized === 'CONTROLEUR') return 'CONTROLEUR'

  return null
}

const mapRoleToDashboardUserType = (role: AuthRoleName | null): DashboardUserType | null => {
  if (!role) {
    return null
  }

  if (role === 'ADMIN') {
    return 'admin'
  }

  if (role === 'OPERATEUR_ECONOMIQUE') {
    return 'operateur'
  }

  if (role === 'SERVICE_CONTRACTANT') {
    return 'contractant'
  }

  return null
}

const resolvePrimaryUserRole = async (userId: string): Promise<AuthRoleName | null> => {
  try {
    const assignments = await usersServiceRequest<UsersServiceUserRoleAssignment[]>('GET', `/user-roles/${userId}`)
    if (!Array.isArray(assignments)) {
      return null
    }

    for (const assignment of assignments) {
      const normalized = normalizeAuthRoleName(assignment.role?.name)
      if (normalized) {
        return normalized
      }
    }

    return null
  } catch (error) {
    console.warn(`[AUTH] Unable to resolve roles for user_id=${userId}:`, error)
    return null
  }
}

const provisionRegistrationFallback = async (
  event: UserRegisteredEventPayload,
  canonicalRole: RegisterRole,
): Promise<void> => {
  const organisation = await usersServiceRequest<{ id: string }>('POST', '/organisations', {
    userId: event.user_id,
    eventId: event.event_id,
    denomination: event.denomination,
    nif: event.nif,
    nis: event.nis,
    registreCommerce: event.registre_commerce,
    adresse: event.adresse,
    wilaya: event.wilaya,
    commune: event.commune,
    email: event.email,
    type: resolveFallbackOrganisationType(event.type),
  })

  try {
    await usersServiceRequest('POST', '/profiles', {
      userId: event.user_id,
      nom: event.nom,
      prenom: event.prenom,
      telephone: event.telephone,
      langue: resolveFallbackLanguage(event.langue),
    })
  } catch (error) {
    if (!(error instanceof UsersServiceRequestError) || error.status !== 409) {
      throw error
    }

    await usersServiceRequest('GET', `/profiles/user/${event.user_id}`)
  }

  if (canonicalRole === 'SERVICE_CONTRACTANT') {
    await usersServiceRequest('POST', '/services-contractants', {
      organisationId: organisation.id,
      userId: event.user_id,
      codeService: event.code_service,
      secteurActivite: event.secteur_activite,
      ordonateur: event.ordonnateur,
    })
  }

  if (canonicalRole === 'OPERATEUR_ECONOMIQUE') {
    await usersServiceRequest('POST', '/operateurs-economiques', {
      organisationId: organisation.id,
      userId: event.user_id,
      qualifications: event.qualifications,
      categories: event.categories,
      isEligible: true,
    })
  }

  const roleId = await getRoleIdForFallback(canonicalRole)
  try {
    await usersServiceRequest('POST', '/user-roles', {
      userId: event.user_id,
      roleId,
    })
  } catch (error) {
    if (!(error instanceof UsersServiceRequestError) || error.status !== 409) {
      throw error
    }
  }
}

const normalizeRegistrationRole = (role: unknown): RegisterRole | null => {
  if (typeof role !== 'string') {
    return null
  }

  const normalized = role
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')
    .toUpperCase()

  if (
    normalized === 'SERVICE_CONTRACTANT' ||
    normalized === 'CONTRACTANT' ||
    normalized === 'SERVICECONTRACTANT'
  ) {
    return 'SERVICE_CONTRACTANT'
  }

  if (
    normalized === 'OPERATEUR_ECONOMIQUE' ||
    normalized === 'OPERATEUR' ||
    normalized === 'OPERATEURECONOMIQUE' ||
    (normalized.includes('OPERATEUR') && normalized.includes('ECONOM'))
  ) {
    return 'OPERATEUR_ECONOMIQUE'
  }

  return null
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const validateRegisterPayload = (
  payload: Record<string, unknown>,
  canonicalRole: RegisterRole,
): string | null => {
  const requiredFields = ['email', 'password', 'nom', 'prenom', 'denomination', 'type']

  for (const field of requiredFields) {
    if (!isNonEmptyString(payload[field])) {
      return `${field} is required`
    }
  }

  if ((payload.password as string).length < 8) {
    return 'password must be at least 8 characters'
  }

  if (!SUPPORTED_ORGANISATION_TYPES.has((payload.type as string).trim().toUpperCase())) {
    return 'Invalid organisation type'
  }

  if (payload.langue !== undefined && !SUPPORTED_LANGUAGES.has(String(payload.langue).trim())) {
    return 'Invalid langue. Allowed values: fr or ar'
  }

  if (payload.telephone !== undefined) {
    const telephone = String(payload.telephone).trim()
    if (telephone.length < 8 || telephone.length > 20) {
      return 'telephone must be between 8 and 20 characters'
    }
  }

  if (canonicalRole === 'SERVICE_CONTRACTANT' && !isNonEmptyString(payload.code_service)) {
    return 'code_service is required for SERVICE_CONTRACTANT'
  }

  return null
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  // Secure doit être false en développement (HTTP) et true en production (HTTPS)
  secure: process.env.NODE_ENV === 'production',
  // On force le type pour que TypeScript soit content
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  // Utilise la variable d'environnement ou rien du tout pour localhost
  domain: process.env.DOMAIN || undefined,
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

// auth.controller.ts
 export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body as Record<string, unknown>

    const {
      email, password, role, langue,
      nom, prenom, telephone,
      denomination, nif, nis, registre_commerce,
      adresse, wilaya, commune, type,
      // SERVICE_CONTRACTANT
      code_service, secteur_activite, ordonnateur,
      // OPERATEUR_ECONOMIQUE
      qualifications, categories,
    } = req.body

    if (!email || !password || !role) {
      res.status(400).json({ message: 'Email, password and role are required' })
      return
    }

    const canonicalRole = normalizeRegistrationRole(role)
    if (!canonicalRole) {
      res.status(400).json({
        message:
          'Invalid role. Allowed values: SERVICE_CONTRACTANT or OPERATEUR_ECONOMIQUE',
      })
      return
    }

    const validationError = validateRegisterPayload(payload, canonicalRole)
    if (validationError) {
      res.status(400).json({ message: validationError })
      return
    }

    const user = await prisma.$transaction(async (t) => {
      const exists = await t.user.findUnique({ where: { email } })
      if (exists) throw new Error('EMAIL_EXISTS')
      const hashed = await bcrypt.hash(password, 12)
      return t.user.create({ data: { email, password: hashed } })
    })

    const registrationEvent: UserRegisteredEventPayload = {
      event_id: crypto.randomUUID(),
      user_id: user.id,
      email: user.email,
      role: canonicalRole,
      langue,
      timestamp: new Date().toISOString(),
      // Profil
      nom,
      prenom,
      telephone,
      // Organisation
      denomination,
      nif,
      nis,
      registre_commerce,
      adresse,
      wilaya,
      commune,
      type,
      // Conditionnel selon role
      ...(canonicalRole === 'SERVICE_CONTRACTANT' && { code_service, secteur_activite, ordonnateur }),
      ...(canonicalRole === 'OPERATEUR_ECONOMIQUE' && { qualifications, categories }),
    }

    const published = await publishToExchange('user.registered', registrationEvent)

    if (!published) {
      try {
        await provisionRegistrationFallback(registrationEvent, canonicalRole)
        console.warn('[REGISTER] RabbitMQ unavailable: provisioned user directly via users-service fallback')
      } catch (fallbackError) {
        console.error('[REGISTER] RabbitMQ publish and users-service fallback both failed:', fallbackError)
        await prisma.user.delete({ where: { id: user.id } }).catch((cleanupError) => {
          console.error('[REGISTER] Failed to rollback auth user after provisioning failure:', cleanupError)
        })

        res.status(503).json({
          message: 'Registration temporarily unavailable. Please try again.',
        })
        return
      }
    }

    res.status(201).json({ message: 'Account created. Verify your email.', user_id: user.id })

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

    const resolvedRole = await resolvePrimaryUserRole(user.id)
    const resolvedUserType = mapRoleToDashboardUserType(resolvedRole)

    res.cookie('access_token', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 })
    res.cookie('refresh_token', refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth/refresh',
    })

    res.json({
      message: 'Logged in successfully',
      role: resolvedRole,
      userType: resolvedUserType,
      user: {
        userId: user.id,
        email: user.email,
        role: resolvedRole,
        userType: resolvedUserType,
      },
    })
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
  path: '/api/v1/auth/refresh',
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

    res.clearCookie('access_token', COOKIE_OPTIONS)
    res.clearCookie('refresh_token', { ...COOKIE_OPTIONS, path: '/api/v1/auth/refresh' })
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

    res.clearCookie('access_token', COOKIE_OPTIONS)
    res.clearCookie('refresh_token', { ...COOKIE_OPTIONS, path: '/api/v1/auth/refresh' })
    res.json({ message: 'Logged out from all devices' })
  } catch (err: any) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

export const me = async (req: Request, res: Response): Promise<void> => {
  const identity = (req as any).user as { userId?: string; email?: string; iat?: number; exp?: number }
  if (!identity?.userId || !identity?.email) {
    res.status(401).json({ message: 'Invalid user context' })
    return
  }

  const resolvedRole = await resolvePrimaryUserRole(identity.userId)
  const resolvedUserType = mapRoleToDashboardUserType(resolvedRole)

  res.json({
    user: {
      ...identity,
      role: resolvedRole,
      userType: resolvedUserType,
    },
  })
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

// Otp controller
// src/controllers/otp.controller.ts


const otpService = new OtpService();

export class OtpController {

  // POST /otp/send
  async send(req: Request, res: Response): Promise<void> {
    const { email } = req.body;

    try {
      await otpService.sendOtp(email);
      res.status(200).json({
        success: true,
        message: `Code OTP envoyé à ${email}`,
      });
    } catch (error) {
      console.error('Erreur envoi OTP:', error);
      res.status(500).json({
        success: false,
        message: "Échec de l'envoi du code OTP.",
      });
    }
  }

  // POST /otp/verify
  verify(req: Request, res: Response): void {
    const { email, code } = req.body;

    const result = otpService.verifyOtp(email, code);

    res.status(result.success ? 200 : 400).json(result);
  }
}
export default { register,OtpController, login, refresh, logout, logoutAll, me, sessions, deleteSession, forgotPassword, verifyResetToken, resetPassword }