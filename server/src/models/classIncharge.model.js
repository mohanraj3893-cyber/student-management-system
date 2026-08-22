const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const ClassIncharge = sequelize.define('ClassIncharge', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
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
  facultyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'faculty_id'
  }
}, {
  tableName: 'class_incharges',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['department', 'year', 'semester', 'section'],
      name: 'unique_class_incharge_per_class'
    }
  ]
});

module.exports = ClassIncharge;
