const { verifyAccessToken, isBlacklisted } = require('../services/tokenService')

const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies.access_token

    if (!token)
      return res.status(401).json({ message: 'No access token provided' })

    // Check if token is blacklisted in Redis
    const blacklisted = await isBlacklisted(token)
    if (blacklisted)
      return res.status(401).json({ message: 'Token has been revoked' })

    // Verify JWT signature and expiry
    const decoded = verifyAccessToken(token)
    req.user = decoded

    next()
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

module.exports = { authenticate }