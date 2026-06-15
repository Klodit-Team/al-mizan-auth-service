export declare class OtpService {
    sendOtp(email: string): Promise<void>;
    verifyOtp(email: string, code: string): {
        success: boolean;
        message: string;
    };
}
//# sourceMappingURL=otpService.d.ts.map