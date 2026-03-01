const express = require('express')
const router = express.Router()
const {
  register, login, refresh,
  logout, logoutAll, me,
  sessions, deleteSession,
} = require('../controllers/authController')
const { authenticate } = require('../middleware/authMiddleware')

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
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 user:
 *                   $ref: '#/components/schemas/UserResponse'
 *       400:
 *         description: Email already exists or missing fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register', register)

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login and get tokens as HttpOnly cookies
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Logged in successfully — tokens set as HttpOnly cookies
 *         headers:
 *           Set-Cookie:
 *             description: access_token and refresh_token cookies
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 attemptsRemaining: { type: number }
 *       429:
 *         description: Account locked due to too many failed attempts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 retryAfter: { type: number }
 */
router.post('/login', login)

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Rotate refresh token and get new access token
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: No refresh token provided
 *       403:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', refresh)

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout current device — blacklist access token + delete refresh token
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 */
router.post('/logout', authenticate, logout)

/**
 * @swagger
 * /auth/logout-all:
 *   post:
 *     summary: Logout from all devices — revoke all refresh tokens
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out from all devices
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 */
router.post('/logout-all', authenticate, logoutAll)

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/UserResponse'
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate, me)

/**
 * @swagger
 * /auth/sessions:
 *   get:
 *     summary: Get all active sessions for current user
 *     tags: [Sessions]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of active sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SessionResponse'
 *       401:
 *         description: Unauthorized
 */
router.get('/sessions', authenticate, sessions)

/**
 * @swagger
 * /auth/sessions/{id}:
 *   delete:
 *     summary: Revoke a specific session (logout specific device)
 *     tags: [Sessions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID to revoke
 *     responses:
 *       200:
 *         description: Session revoked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 */
router.delete('/sessions/:id', authenticate, deleteSession)

module.exports = router