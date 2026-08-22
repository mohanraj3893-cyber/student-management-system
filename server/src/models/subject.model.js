const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Subject = sequelize.define('Subject', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  credits: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3
  },
  semester: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  year: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'III-Year'
  },
  section: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'A'
  },
  department: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Computer Science & Engineering'
  },
  facultyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'faculty_id'
  }
}, {
  tableName: 'subjects',
  timestamps: true,
  underscored: true
});

module.exports = Subject;
