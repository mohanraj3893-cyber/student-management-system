const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const AttendanceRecord = sequelize.define('AttendanceRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sessionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'session_id'
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'student_id'
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(50), // 'Present' or 'Absent'
    allowNull: false,
    validate: {
      isIn: [['Present', 'Absent']]
    }
  },
  markedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'marked_at'
  }
}, {
  tableName: 'attendance_records',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: false,
      fields: ['student_id', 'date'],
      name: 'unique_attendance_per_student_per_day'
    }
  ]
});

module.exports = AttendanceRecord;
