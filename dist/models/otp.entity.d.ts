export interface OtpRecord {
    email: string;
    code: string;
    expiresAt: Date;
    verified: boolean;
}
export declare const otpStore: Map<string, OtpRecord>;
//# sourceMappingURL=otp.entity.d.ts.map