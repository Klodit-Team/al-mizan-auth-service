export declare const generateAccessToken: (userId: string, email: string) => string;
export declare const generateRefreshToken: (userId: string, deviceInfo?: string | null, ipAddress?: string | null, tx?: any) => Promise<string>;
export declare const verifyAccessToken: (token: string) => any;
export declare const blacklistToken: (token: string) => Promise<void>;
export declare const isBlacklisted: (token: string) => Promise<boolean>;
export declare const rotateRefreshToken: (oldToken: string, userId: string, deviceInfo?: string | null, ipAddress?: string | null) => Promise<string>;
export declare const validateRefreshToken: (token: string) => Promise<{
    id: string;
    created_at: Date;
    userId: string;
    token: string;
    deviceInfo: string | null;
    ipAddress: string | null;
    expiresAt: Date;
} | null>;
export declare const revokeAllRefreshTokens: (userId: string) => Promise<void>;
export declare const getActiveSessions: (userId: string) => Promise<{
    id: string;
    created_at: Date;
    deviceInfo: string | null;
    ipAddress: string | null;
    expiresAt: Date;
}[]>;
export declare const revokeSession: (sessionId: string, userId: string) => Promise<void>;
declare const _default: {
    generateAccessToken: (userId: string, email: string) => string;
    generateRefreshToken: (userId: string, deviceInfo?: string | null, ipAddress?: string | null, tx?: any) => Promise<string>;
    verifyAccessToken: (token: string) => any;
    blacklistToken: (token: string) => Promise<void>;
    isBlacklisted: (token: string) => Promise<boolean>;
    rotateRefreshToken: (oldToken: string, userId: string, deviceInfo?: string | null, ipAddress?: string | null) => Promise<string>;
    validateRefreshToken: (token: string) => Promise<{
        id: string;
        created_at: Date;
        userId: string;
        token: string;
        deviceInfo: string | null;
        ipAddress: string | null;
        expiresAt: Date;
    } | null>;
    revokeAllRefreshTokens: (userId: string) => Promise<void>;
    getActiveSessions: (userId: string) => Promise<{
        id: string;
        created_at: Date;
        deviceInfo: string | null;
        ipAddress: string | null;
        expiresAt: Date;
    }[]>;
    revokeSession: (sessionId: string, userId: string) => Promise<void>;
};
export default _default;
//# sourceMappingURL=tokenService.d.ts.map