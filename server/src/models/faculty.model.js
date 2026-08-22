const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Faculty = sequelize.define('Faculty', {
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
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  employeeId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    field: 'employee_id'
  },
  designation: {
    type: DataTypes.STRING(150),
    allowNull: false,
    defaultValue: 'Assistant Professor'
  },
  department: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Computer Science & Engineering'
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  photoPath: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'photo_path'
  },
  qualification: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  researchArea: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'research_area'
  },
  publications: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'faculty',
  timestamps: true,
  underscored: true
});

module.exports = Faculty;
