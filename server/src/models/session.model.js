const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id'
  },
  refreshToken: {
    type: DataTypes.STRING(512),
    allowNull: false,
    unique: true,
    field: 'refresh_token'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at'
  }
}, {
  tableName: 'sessions',
  timestamps: true,
  underscored: true
});

module.exports = Session;
