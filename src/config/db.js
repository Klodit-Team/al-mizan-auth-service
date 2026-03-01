const { Sequelize } = require('sequelize')
require('dotenv').config()
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: true, 
})

const init = async () => {
  // Importer les models ici pour les enregistrer sur sequelize
  require('../models/User')
  require('../models/RefreshToken')

  await sequelize.authenticate()
  console.log('✅ PostgreSQL connected via Sequelize')

  await sequelize.sync({ alter: true })
  console.log('✅ Tables synced')
}

module.exports = sequelize        
module.exports.init = init        