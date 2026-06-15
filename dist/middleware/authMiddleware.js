import { verifyAccessToken, isBlacklisted } from '../services/tokenService.js';
export const authenticate = async (req, res, next) => {
    try {
        const token = req.cookies?.access_token;
        if (!token) {
            res.status(401).json({ message: 'No access token provided' });
            return;
        }
        // Check if token is blacklisted in Redis
        const blacklisted = await isBlacklisted(token);
        if (blacklisted) {
            res.status(401).json({ message: 'Token has been revoked' });
            return;
        }
        // Verify JWT signature and expiry
        const decoded = verifyAccessToken(token);
        req.user = decoded;
        next();
    }
    catch (err) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};
// src/middlewares/validate.middleware.ts
export function validateSendOtp(req, res, next) {
    const email = req.body?.email;
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
export function validateVerifyOtp(req, res, next) {
    const code = req.body?.code;
    const email = req.body?.email;
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
export default authenticate;
//# sourceMappingURL=authMiddleware.js.map