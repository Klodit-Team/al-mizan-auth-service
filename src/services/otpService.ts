// src/services/otp.service.ts

import type { OtpRecord } from '../models/otp.entity.js';
import { otpStore } from '../models/otp.entity.js';
import { sendOtpEmail } from '../utils/mailer.js';

// Génère un code à 6 chiffres
function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export class OtpService {

  // Envoie un OTP par email
  async sendOtp(email: string): Promise<void> {
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // +10 min

    const record: OtpRecord = {
      email,
      code,
      expiresAt,
      verified: false,
    };

    // Sauvegarde dans le store (1 OTP actif par email)
    otpStore.set(email, record);

    // Envoi via Resend
    await sendOtpEmail(email, code);
  }

  // Vérifie le code soumis par l'utilisateur
  verifyOtp(email: string, code: string): { success: boolean; message: string } {
    const record = otpStore.get(email);

    if (!record) {
      return { success: false, message: 'Aucun OTP trouvé pour cet email.' };
    }

    if (record.verified) {
      return { success: false, message: 'Ce code a déjà été utilisé.' };
    }

    if (new Date() > record.expiresAt) {
      otpStore.delete(email);
      return { success: false, message: 'Code expiré. Demandez un nouveau code.' };
    }

    if (record.code !== code) {
      return { success: false, message: 'Code incorrect.' };
    }

    // Marquer comme vérifié
    record.verified = true;
    otpStore.set(email, record);
    otpStore.delete(email); // Nettoyage après succès

    return { success: true, message: 'Authentification réussie !' };
  }
}