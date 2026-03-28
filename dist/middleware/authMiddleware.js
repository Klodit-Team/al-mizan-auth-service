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
export default authenticate;
//# sourceMappingURL=authMiddleware.js.map