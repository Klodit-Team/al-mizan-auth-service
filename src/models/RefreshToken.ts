// Types for RefreshToken model (migrated from Sequelize to Prisma types)
export interface CreateRefreshTokenDto {
  userId: string
  token: string
  deviceInfo?: string | null
  ipAddress?: string | null
  expiresAt: Date
}

export interface RefreshTokenResponse {
  id: string
  userId: string
  token: string
  deviceInfo?: string | null
  ipAddress?: string | null
  expiresAt: Date
  created_at: Date
}

// NOTE: Database operations should use @prisma/client via services (e.g. tokenService)