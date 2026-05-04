// src/tests/otp.test.ts

import { jest } from '@jest/globals'  // ← ajouter cette ligne
import request from 'supertest'
import app from '../src/app'
import { otpStore } from '../src/models/otp.entity.js'

// ✅ jest est maintenant défini
jest.mock('../src/utils/mailer', () => ({
  sendOtpEmail: () => Promise.resolve(),
}))

describe('POST /otp/send', () => {

  // ✅ CAS 1 : Email valide → succès
  it('✅ doit envoyer un OTP pour un email valide', async () => {
    const res = await request(app)
      .post('/otp/send')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('test@example.com');
    // Vérifie que l'OTP est bien stocké en mémoire
    expect(otpStore.has('test@example.com')).toBe(true);
  });

  // ❌ CAS 2 : Email manquant
  it('❌ doit rejeter si email manquant', async () => {
    const res = await request(app)
      .post('/otp/send')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Email requis.');
  });

  // ❌ CAS 3 : Email invalide (format incorrect)
  it('❌ doit rejeter un email mal formaté', async () => {
    const res = await request(app)
      .post('/otp/send')
      .send({ email: 'pas-un-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Email invalide.');
  });

  // ❌ CAS 4 : Body vide
  it('❌ doit rejeter un body vide', async () => {
    const res = await request(app)
      .post('/otp/send')
      .send();

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────

describe('POST /otp/verify', () => {

  const testEmail = 'verify@example.com';

  // Avant chaque test, injecte un OTP frais dans le store
  beforeEach(() => {
    otpStore.set(testEmail, {
      email: testEmail,
      code: '123456',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // +10 min
      verified: false,
    });
  });

  afterEach(() => {
    otpStore.delete(testEmail);
  });

  // ✅ CAS 1 : Code correct
  it('✅ doit vérifier un OTP valide', async () => {
    const res = await request(app)
      .post('/otp/verify')
      .send({ email: testEmail, code: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Authentification réussie !');
  });

  // ❌ CAS 2 : Code incorrect
  it('❌ doit rejeter un code incorrect', async () => {
    const res = await request(app)
      .post('/otp/verify')
      .send({ email: testEmail, code: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Code incorrect.');
  });

  // ❌ CAS 3 : OTP expiré
  it('❌ doit rejeter un OTP expiré', async () => {
    // Injecte un OTP déjà expiré
    otpStore.set(testEmail, {
      email: testEmail,
      code: '123456',
      expiresAt: new Date(Date.now() - 1000), // expiré il y a 1 sec
      verified: false,
    });

    const res = await request(app)
      .post('/otp/verify')
      .send({ email: testEmail, code: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('expiré');
  });

  // ❌ CAS 4 : Email sans OTP dans le store
  it('❌ doit rejeter un email sans OTP enregistré', async () => {
    const res = await request(app)
      .post('/otp/verify')
      .send({ email: 'inconnu@example.com', code: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Aucun OTP');
  });

  // ❌ CAS 5 : Code non numérique
  it('❌ doit rejeter un code non numérique', async () => {
    const res = await request(app)
      .post('/otp/verify')
      .send({ email: testEmail, code: 'abcdef' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('6 chiffres');
  });

  // ❌ CAS 6 : Code déjà utilisé (double vérification)
  it('❌ doit rejeter un OTP déjà utilisé', async () => {
    otpStore.set(testEmail, {
      email: testEmail,
      code: '123456',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verified: true, // déjà vérifié
    });

    const res = await request(app)
      .post('/otp/verify')
      .send({ email: testEmail, code: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('déjà été utilisé');
  });

  // ❌ CAS 7 : Body incomplet
  it('❌ doit rejeter si code manquant', async () => {
    const res = await request(app)
      .post('/otp/verify')
      .send({ email: testEmail });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});