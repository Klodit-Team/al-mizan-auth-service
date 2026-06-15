import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/db.js';
import { client as redis } from '../config/redis.js';
const MAX_SESSIONS = 3;
function resolveAccessTokenSecret() {
    const raw = process.env.ACCESS_TOKEN_SECRET;
    const secret = typeof raw === 'string' ? raw.trim() : '';
    if (secret.length > 0) {
        return secret;
    }
    if (process.env.NODE_ENV !== 'production') {
        return 'al_mizan_access_secret_fallback_dev';
    }
    throw new Error('ACCESS_TOKEN_SECRET is required in production');
}
export const generateAccessToken = (userId, email) => {
    const opts = { expiresIn: process.env.ACCESS_TOKEN_EXPIRY };
    return jwt.sign({ userId, email }, resolveAccessTokenSecret(), opts);
};
export const generateRefreshToken = async (userId, deviceInfo, ipAddress, tx) => {
    const client = tx ?? prisma;
    // Count active sessions
    const activeCount = await client.session.count({
        where: {
            userId,
            expiresAt: { gt: new Date() },
        },
    });
    if (activeCount >= MAX_SESSIONS) {
        const oldest = await client.session.findFirst({
            where: { userId },
            orderBy: { created_at: 'asc' },
        });
        if (oldest) {
            await client.session.delete({ where: { id: oldest.id } });
        }
    }
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await client.session.create({
        data: { userId, token, expiresAt, deviceInfo, ipAddress },
    });
    return token;
};
export const verifyAccessToken = (token) => {
    return jwt.verify(token, resolveAccessTokenSecret());
};
export const blacklistToken = async (token) => {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp)
        return;
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
        await redis.setEx(`blacklist:${token}`, ttl, 'true');
    }
};
export const isBlacklisted = async (token) => {
    const result = await redis.get(`blacklist:${token}`);
    return result !== null;
};
export const rotateRefreshToken = async (oldToken, userId, deviceInfo, ipAddress) => {
    return await prisma.$transaction(async (t) => {
        await t.session.deleteMany({ where: { token: oldToken } });
        return await generateRefreshToken(userId, deviceInfo, ipAddress, t);
    });
};
export const validateRefreshToken = async (token) => {
    return await prisma.session.findFirst({
        where: { token, expiresAt: { gt: new Date() } },
    });
};
export const revokeAllRefreshTokens = async (userId) => {
    await prisma.session.deleteMany({ where: { userId } });
};
export const getActiveSessions = async (userId) => {
    return await prisma.session.findMany({
        where: { userId, expiresAt: { gt: new Date() } },
        select: { id: true, deviceInfo: true, ipAddress: true, created_at: true, expiresAt: true },
        orderBy: { created_at: 'desc' },
    });
};
export const revokeSession = async (sessionId, userId) => {
    await prisma.session.deleteMany({ where: { id: sessionId, userId } });
};
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
};
//# sourceMappingURL=tokenService.js.map