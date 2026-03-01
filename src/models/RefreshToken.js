const { DataTypes } = require('sequelize')
const sequelize = require('../config/db')
const User = require('./User')

const RefreshToken = sequelize.define('RefreshToken', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE',
  },
  token: {
    type: DataTypes.TEXT,
    unique: true,
    allowNull: false,
  },
  deviceInfo: {
    type: DataTypes.STRING,
    field: 'device_info',
  },
  ipAddress: {
    type: DataTypes.STRING,
    field: 'ip_address',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at',
  },
}, {
  tableName: 'refresh_tokens',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
})

// Association
User.hasMany(RefreshToken, { foreignKey: 'user_id', onDelete: 'CASCADE' })
RefreshToken.belongsTo(User, { foreignKey: 'user_id' })

module.exports = RefreshToken