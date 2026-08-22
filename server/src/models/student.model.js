const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Student = sequelize.define('Student', {
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
  registerNumber: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    field: 'register_number'
  },
  department: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Computer Science & Engineering'
  },
  year: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  semester: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  section: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'A'
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
  guardianName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'guardian_name'
  },
  guardianPhone: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'guardian_phone'
  },
  course: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'B.E'
  },
  branch: {
    type: DataTypes.STRING(150),
    allowNull: false,
    defaultValue: 'Computer Science & Engineering'
  },
  batch: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: '2024-2028'
  },
  bloodGroup: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'Unknown',
    field: 'blood_group'
  },
  dob: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  aadhaarNo: {
    type: DataTypes.STRING(12),
    allowNull: true,
    field: 'aadhaar_no'
  }
}, {
  tableName: 'students',
  timestamps: true,
  underscored: true
});

module.exports = Student;
