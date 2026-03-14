import { Router } from 'express'
import * as authController from '../controllers/authController.js'
import authenticate from '../middleware/authMiddleware.js'

const router = Router()

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Email already exists
 */
router.post('/register', authController.register)

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Logged in successfully
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Account locked
 */
router.post('/login', authController.login)

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Token refreshed
 *       403:
 *         description: Invalid refresh token
 */
router.post('/refresh', authController.refresh)

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout current session
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', authenticate, authController.logout)

/**
 * @swagger
 * /auth/logout-all:
 *   post:
 *     summary: Logout all sessions
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out from all devices
 */
router.post('/logout-all', authenticate, authController.logoutAll)

/**
 * @swagger
 * /auth/me:
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
router.get('/me', authenticate, authController.me)

/**
 * @swagger
 * /auth/sessions:
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
router.get('/sessions', authenticate, authController.sessions)

/**
 * @swagger
 * /auth/sessions/{id}:
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
router.delete('/sessions/:id', authenticate, authController.deleteSession)

export default router