const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Announcement = sequelize.define('Announcement', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Academic'
    },
    postedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'posted_by'
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'published'
    },
    targetDepartment: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'all',
      field: 'target_department'
    },
    targetYear: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'all',
      field: 'target_year'
    },
    targetSemester: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'all',
      field: 'target_semester'
    },
    targetSection: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'all',
      field: 'target_section'
    }
  }, {
    tableName: 'announcements',
    timestamps: true,
    underscored: true
  });

  return Announcement;
};
