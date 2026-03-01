require('dotenv').config()
const express = require('express')
const cookieParser = require('cookie-parser')
const swaggerUi = require('swagger-ui-express')
const swaggerSpec = require('./config/swagger')
const { init } = require('./config/db')
const { connect } = require('./config/redis')
const authRoutes = require('./routes/authRoutes')

const app = express()

app.use(express.json())
app.use(cookieParser())

// ── SWAGGER UI ─────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Auth Service API Docs',
  swaggerOptions: {
    persistAuthorization: true, // garder l'auth entre les refreshes
  },
}))

// ── ROUTES ─────────────────────────────────────────────────────
app.use('/auth', authRoutes)

// ── HEALTH CHECK ───────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }))

const start = async () => {
  await connect()
  await init()
  app.listen(process.env.PORT, () => {
    console.log(`🚀 Auth service running on port ${process.env.PORT}`)
    console.log(`📚 Swagger UI available at http://localhost:${process.env.PORT}/api-docs`)
  })
}

start()