// src/utils/mailer.ts

import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.RESEND_API_KEY;
const isMailEnabled = apiKey && apiKey.startsWith('re_') && apiKey.length > 10;

export const resend = isMailEnabled ? new Resend(apiKey) : null;

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  if (!resend) {
    console.warn(`[MAILER] Resend not configured. OTP for ${to}: ${code}`);
    return;
  }

  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'noreply@localhost',
    to,
    subject: '🔐 Votre code OTP - Klodit',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
        <h2 style="color: #2563eb;">Votre code de vérification</h2>
        <p>Utilisez ce code pour vous authentifier :</p>
        <div style="
          font-size: 36px;
          font-weight: bold;
          letter-spacing: 8px;
          color: #1e40af;
          background: #eff6ff;
          padding: 20px;
          text-align: center;
          border-radius: 8px;
          margin: 20px 0;
        ">
          ${code}
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          Ce code expire dans <strong>10 minutes</strong>.<br/>
          Si vous n'avez pas demandé ce code, ignorez cet email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb;" />
        <p style="color: #9ca3af; font-size: 12px;">Klodit — noreply@klodit.app</p>
      </div>
    `,
  });
}