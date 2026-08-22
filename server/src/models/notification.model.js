const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Notification = sequelize.define('Notification', {
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
  message: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_read'
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  relatedId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'related_id'
  }
}, {
  tableName: 'notifications',
  timestamps: true,
  underscored: true
});

module.exports = Notification;
