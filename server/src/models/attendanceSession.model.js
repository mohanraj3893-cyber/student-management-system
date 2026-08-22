const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const AttendanceSession = sequelize.define('AttendanceSession', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  facultyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'faculty_id'
  },
  department: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Computer Science & Engineering'
  },
  year: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  semester: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  section: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'A'
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  }
}, {
  tableName: 'attendance_sessions',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: false,
      fields: ['department', 'year', 'semester', 'section', 'date'],
      name: 'unique_daily_session_per_class_date'
    }
  ]
});

module.exports = AttendanceSession;
