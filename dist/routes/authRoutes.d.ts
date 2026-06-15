declare const router: import("express-serve-static-core").Router;
/**
 * @swagger
 * tags:
 *   name: OTP
 *   description: Authentification par code OTP envoyé par email
 */
/**
 * @swagger
 * /api/v1/auth/otp/send:
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
 *       500:
 *         description: Erreur serveur lors de l'envoi
 */
/**
 * @swagger
 * /api/v1/auth/otp/verify:
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
 */
export default router;
//# sourceMappingURL=authRoutes.d.ts.map