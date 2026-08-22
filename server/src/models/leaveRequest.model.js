const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LeaveRequest = sequelize.define('LeaveRequest', {
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
    leaveType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'leave_type'
    },
    fromDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'from_date'
    },
    toDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'to_date'
    },
    numberOfDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'number_of_days'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    supportingDocument: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'supporting_document'
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'PENDING_CLASS_INCHARGE'
    },
    hodRemarks: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'hod_remarks'
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'rejection_reason'
    },
    processedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'processed_by'
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'processed_at'
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'submitted_at'
    }
  }, {
    tableName: 'leave_requests',
    timestamps: true,
    underscored: true
  });

  return LeaveRequest;
};
