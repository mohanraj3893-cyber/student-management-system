const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const InternalMark = sequelize.define('InternalMark', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    studentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'student_id'
    },
    subjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'subject_id'
    },
    examType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'exam_type'
    },
    marksObtained: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'marks_obtained'
    },
    maxMarks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
      field: 'max_marks'
    }
  }, {
    tableName: 'internal_marks',
    timestamps: true,
    underscored: true
  });

  return InternalMark;
};
