const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Timetable = sequelize.define('Timetable', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    dayOfWeek: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'day_of_week'
    },
    period: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    timeSlot: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'time_slot'
    },
    subjectCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'subject_code'
    },
    subjectName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'subject_name'
    },
    room: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'L3 Hall'
    }
  }, {
    tableName: 'timetable',
    timestamps: true,
    underscored: true
  });

  return Timetable;
};
