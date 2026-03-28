export interface CreateRefreshTokenDto {
    userId: string;
    token: string;
    deviceInfo?: string | null;
    ipAddress?: string | null;
    expiresAt: Date;
}
export interface RefreshTokenResponse {
    id: string;
    userId: string;
    token: string;
    deviceInfo?: string | null;
    ipAddress?: string | null;
    expiresAt: Date;
    created_at: Date;
}
//# sourceMappingURL=RefreshToken.d.ts.map