import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, isBlacklisted } from '../services/tokenService.js'

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token: string | undefined = (req as any).cookies?.access_token

    if (!token) {
      res.status(401).json({ message: 'No access token provided' })
      return
    }

    // Check if token is blacklisted in Redis
    const blacklisted = await isBlacklisted(token)
    if (blacklisted) {
      res.status(401).json({ message: 'Token has been revoked' })
      return
    }

    // Verify JWT signature and expiry
    const decoded = verifyAccessToken(token)
    ;(req as any).user = decoded

    next()
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}

export default authenticate
