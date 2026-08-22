const sequelize = require('../config/db.config');
const Role = require('./role.model');
const User = require('./user.model');
const Session = require('./session.model');
const Student = require('./student.model');
const Faculty = require('./faculty.model');
const Subject = require('./subject.model');
const AttendanceSession = require('./attendanceSession.model');
const AttendanceRecord = require('./attendanceRecord.model');
const ClassIncharge = require('./classIncharge.model');
const InternalMark = require('./internalMark.model')(sequelize);
const LeaveRequest = require('./leaveRequest.model')(sequelize);
const Announcement = require('./announcement.model')(sequelize);
const Timetable = require('./timetable.model')(sequelize);
const Notification = require('./notification.model');
const Resource = require('./resource.model');

// Define Relationships
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });

Session.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Session, { foreignKey: 'user_id', as: 'sessions' });

User.hasOne(Student, { foreignKey: 'user_id', as: 'student' });
Student.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasOne(Faculty, { foreignKey: 'user_id', as: 'faculty' });
Faculty.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Faculty.hasMany(Subject, { foreignKey: 'faculty_id', as: 'subjects' });
Subject.belongsTo(Faculty, { foreignKey: 'faculty_id', as: 'faculty' });

// Class Incharge relations
Faculty.hasMany(ClassIncharge, { foreignKey: 'faculty_id', as: 'classInchargeAssignments' });
ClassIncharge.belongsTo(Faculty, { foreignKey: 'faculty_id', as: 'faculty' });

// Attendance relations
Faculty.hasMany(AttendanceSession, { foreignKey: 'faculty_id', as: 'attendanceSessions' });
AttendanceSession.belongsTo(Faculty, { foreignKey: 'faculty_id', as: 'faculty' });

AttendanceSession.hasMany(AttendanceRecord, { foreignKey: 'session_id', as: 'records' });
AttendanceRecord.belongsTo(AttendanceSession, { foreignKey: 'session_id', as: 'session' });

Student.hasMany(AttendanceRecord, { foreignKey: 'student_id', as: 'attendanceRecords' });
AttendanceRecord.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

// Internal Marks relations
Student.hasMany(InternalMark, { foreignKey: 'studentId', as: 'internalMarks' });
InternalMark.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

Subject.hasMany(InternalMark, { foreignKey: 'subjectId', as: 'internalMarks' });
InternalMark.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });

// Leave Requests relations
Student.hasMany(LeaveRequest, { foreignKey: 'studentId', as: 'leaveRequests' });
LeaveRequest.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
LeaveRequest.belongsTo(User, { foreignKey: 'processedBy', as: 'processor' });
User.hasMany(LeaveRequest, { foreignKey: 'processedBy', as: 'processedLeaves' });

// Announcements relations
User.hasMany(Announcement, { foreignKey: 'postedBy', as: 'announcements' });
Announcement.belongsTo(User, { foreignKey: 'postedBy', as: 'user' });

// Notifications relations
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Resource (Course Materials) relations
Subject.hasMany(Resource, { foreignKey: 'subject_id', as: 'resources' });
Resource.belongsTo(Subject, { foreignKey: 'subject_id', as: 'subject' });
Faculty.hasMany(Resource, { foreignKey: 'faculty_id', as: 'resources' });
Resource.belongsTo(Faculty, { foreignKey: 'faculty_id', as: 'faculty' });

module.exports = {
  sequelize,
  Role,
  User,
  Session,
  Student,
  Faculty,
  Subject,
  AttendanceSession,
  AttendanceRecord,
  ClassIncharge,
  InternalMark,
  LeaveRequest,
  Announcement,
  Timetable,
  Notification,
  Resource
};
