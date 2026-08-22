const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Resource = sequelize.define('Resource', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Lecture Notes'
  },
  subjectId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'subject_id'
  },
  facultyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'faculty_id'
  },
  fileName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'file_name'
  },
  filePath: {
    type: DataTypes.STRING(512),
    allowNull: false,
    field: 'file_path'
  },
  fileSize: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'N/A',
    field: 'file_size'
  }
}, {
  tableName: 'resources',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Resource;
