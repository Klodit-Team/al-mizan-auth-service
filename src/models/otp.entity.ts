// src/models/otp.entity.ts

// ✅ Le type et le store bien séparés
export interface OtpRecord {
  email: string;
  code: string;
  expiresAt: Date;
  verified: boolean;
}

// ✅ Valeur exportée séparément (pas inline avec l'interface)
export const otpStore = new Map<string, OtpRecord>();