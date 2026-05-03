import { Router } from 'express'
import * as authController from '../controllers/authController.js'
import authenticate from '../middleware/authMiddleware.js'
import { validateSendOtp, validateVerifyOtp } from '../middleware/authMiddleware.js';
import { OtpController } from '../controllers/authController.js';

const router = Router()

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/RegisterServiceContractantRequest'
 *               - $ref: '#/components/schemas/RegisterOperateurEconomiqueRequest'
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Account created. Verify your email.
 *                 user_id:
 *                   type: string
 *                   example: uuid-xxxx-xxxx
 *       400:
 *         description: Email already exists or missing fields
 *       500:
 *         description: Server error
 */
router.post('/api/v1/auth/register', authController.register)

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterBase:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - role
 *         - nom
 *         - prenom
 *         - denomination
 *         - type
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: user@example.com
 *         password:
 *           type: string
 *           minLength: 8
 *           example: MyPassword123
 *         role:
 *           type: string
 *           enum: [SERVICE_CONTRACTANT, OPERATEUR_ECONOMIQUE]
 *           example: SERVICE_CONTRACTANT
 *         langue:
 *           type: string
 *           enum: [fr, ar]
 *           example: fr
 *         nom:
 *           type: string
 *           example: Benali
 *         prenom:
 *           type: string
 *           example: Ahmed
 *         telephone:
 *           type: string
 *           example: "0550000000"
 *         denomination:
 *           type: string
 *           example: Ministère des Finances
 *         nif:
 *           type: string
 *           example: "123456789"
 *         nis:
 *           type: string
 *           example: "987654321"
 *         registre_commerce:
 *           type: string
 *           example: "RC-2024-001"
 *         adresse:
 *           type: string
 *           example: Rue Didouche Mourad, Alger
 *         wilaya:
 *           type: string
 *           example: Alger
 *         commune:
 *           type: string
 *           example: Sidi M'Hamed
 *         type:
 *           type: string
 *           enum: [EPA, EPIC, MINISTERE, ENTREPRISE_PRIVEE, ENTREPRISE_PUBLIQUE, GROUPEMENT]
 *           example: MINISTERE
 *
 *     RegisterServiceContractantRequest:
 *       allOf:
 *         - $ref: '#/components/schemas/RegisterBase'
 *         - type: object
 *           required:
 *             - code_service
 *           properties:
 *             code_service:
 *               type: string
 *               example: "SC-001"
 *             secteur_activite:
 *               type: string
 *               example: Travaux publics
 *             ordonnateur:
 *               type: string
 *               example: Mohamed Larbi
 *
 *     RegisterOperateurEconomiqueRequest:
 *       allOf:
 *         - $ref: '#/components/schemas/RegisterBase'
 *         - type: object
 *           properties:
 *             qualifications:
 *               type: string
 *               example: BTP, génie civil
 *             categories:
 *               type: string
 *               example: Catégorie 1
 */

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Authentifier un utilisateur et créer une session
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 user:
 *                   $ref: '#/components/schemas/UserResponse'
 *       401:
 *         description: Identifiants invalides (email ou mot de passe incorrect)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erreur serveur
 */
router.post('/api/v1/auth/login', authController.login)
router.post('/api/v1/auth/refresh', authController.refresh)

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout current session
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/api/v1/auth/logout', authenticate, authController.logout)

/**
 * @swagger
 * /api/v1/auth/logout-all:
 *   post:
 *     summary: Logout all sessions
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out from all devices
 */
router.post('/api/v1/auth/logout-all', authenticate, authController.logoutAll)

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user info
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 */
router.get('/api/v1/auth/me', authenticate, authController.me)

/**
 * @swagger
 * /api/v1/auth/sessions:
 *   get:
 *     summary: Get all active sessions
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of active sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SessionResponse'
 */
router.get('/api/v1/auth/sessions', authenticate, authController.sessions)

/**
 * @swagger
 * /api/v1/auth/sessions/{id}:
 *   delete:
 *     summary: Revoke a specific session
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session revoked
 */
router.delete('/api/v1/auth/sessions/:id', authenticate, authController.deleteSession)


router.post('/api/v1/auth/forgot-password', authController.forgotPassword)

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent (if user exists)
 *       400:
 *         description: Invalid email format
 */
router.post('/api/v1/auth/verify-token', authController.verifyResetToken)

/**
 * @swagger
 * /api/v1/auth/verify-token:
 *   post:
 *     summary: Verify password reset token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token is valid
 *       400:
 *         description: Invalid or expired token
 */

router.post('/api/v1/auth/reset-password', authController.resetPassword)

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password using token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *               - confirmeNewPassword
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               confirmeNewPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid token or password criteria not met
 */

// src/routes/otp.routes.ts

const otpController = new OtpController();

// Middleware de validation → Controller
router.post('/otp/send',   validateSendOtp,   (req, res) => otpController.send(req, res));
router.post('/otp/verify', validateVerifyOtp, (req, res) => otpController.verify(req, res));
// src/routes/authRoutes.ts

/**
 * @swagger
 * tags:
 *   name: OTP
 *   description: Authentification par code OTP envoyé par email
 */

/**
 * @swagger
 * /otp/send:
 *   post:
 *     summary: Envoyer un code OTP par email
 *     tags: [OTP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: OTP envoyé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Code OTP envoyé à user@example.com"
 *       400:
 *         description: Email invalide ou manquant
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Email invalide."
 *       500:
 *         description: Erreur serveur lors de l'envoi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Échec de l'envoi du code OTP."
 */

/**
 * @swagger
 * /otp/verify:
 *   post:
 *     summary: Vérifier le code OTP soumis par l'utilisateur
 *     tags: [OTP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 example: "482931"
 *     responses:
 *       200:
 *         description: OTP vérifié avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Authentification réussie !"
 *       400:
 *         description: Code incorrect / expiré / déjà utilisé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Code incorrect."
 */

export default router