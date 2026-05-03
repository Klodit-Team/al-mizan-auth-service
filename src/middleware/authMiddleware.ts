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
// src/middlewares/validate.middleware.ts


export function validateSendOtp(req: Request, res: Response, next: NextFunction): void {
  const  email  = req.body?.email;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ success: false, message: 'Email requis.' });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ success: false, message: 'Email invalide.' });
    return;
  }

  next();
}

export function validateVerifyOtp(req: Request, res: Response, next: NextFunction): void {
  const code  = req.body?.code;
   const email = req.body?.email

  if (!email || !code) {
    res.status(400).json({ success: false, message: 'Email et code requis.' });
    return;
  }

  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ success: false, message: 'Le code doit contenir 6 chiffres.' });
    return;
  }

  next();
}

export default authenticate
