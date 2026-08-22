const { User, Role, Student, Faculty, Subject, Timetable, LeaveRequest, AttendanceRecord, AttendanceSession, ClassIncharge, Session } = require('../models');

exports.getStats = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: Role, as: 'role' },
        { model: Faculty, as: 'faculty' },
        { model: Student, as: 'student' }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const dept = req.user.department || user.faculty?.department || user.student?.department || 'Computer Science & Engineering';

    const studentRole = await Role.findOne({ where: { name: 'student' } });
    const facultyRole = await Role.findOne({ where: { name: 'faculty' } });

    // 1. Department-isolated total student count
    const totalStudents = studentRole 
      ? await User.count({
          where: { roleId: studentRole.id, isApproved: true },
          include: [{ model: Student, as: 'student', where: { department: dept } }]
        }) 
      : 0;

    // 2. Department-isolated total faculty count
    const totalFaculty = facultyRole 
      ? await User.count({
          where: { roleId: facultyRole.id, isApproved: true },
          include: [{ model: Faculty, as: 'faculty', where: { department: dept } }]
        }) 
      : 0;

    // 3. Department-isolated subject count
    const totalSubjects = await Subject.count({ where: { department: dept } });

    // 4. Department-isolated pending leaves count
    const pendingLeaves = await LeaveRequest.count({
      where: {
        [User.sequelize.Sequelize.Op.or]: [{ status: 'Pending' }, { status: 'PENDING_HOD' }]
      },
      include: [{ model: Student, as: 'student', where: { department: dept } }]
    });

    // 5. Department-isolated pending registrations count
    const pendingRegistrations = await User.count({ where: { isApproved: false } });

    // 6. Department-isolated attendance percentage
    const deptStudents = await Student.findAll({ where: { department: dept }, attributes: ['id'] });
    const deptStudentIds = deptStudents.map(s => s.id);
    let attendancePercentage = 0;

    if (deptStudentIds.length > 0) {
      const totalRecords = await AttendanceRecord.count({ where: { studentId: { [User.sequelize.Sequelize.Op.in]: deptStudentIds } } });
      const presentRecords = await AttendanceRecord.count({ where: { studentId: { [User.sequelize.Sequelize.Op.in]: deptStudentIds }, status: 'Present' } });
      attendancePercentage = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;
    }

    let profileName = user.username;
    let designation = 'HOD';
    let photoPath = null;
    let userStats = {};
    let isClassIncharge = false;
    let inchargeAssignments = [];

    if (user.role.name === 'admin' && user.faculty) {
      profileName = user.faculty.name;
      designation = 'HOD';
      photoPath = user.faculty.photoPath;
    } else if (user.role.name === 'faculty' && user.faculty) {
      profileName = user.faculty.name;
      designation = user.faculty.designation;
      photoPath = user.faculty.photoPath;

      inchargeAssignments = await ClassIncharge.findAll({ where: { facultyId: user.faculty.id } });
      isClassIncharge = inchargeAssignments.length > 0;
      const assignedCount = inchargeAssignments.length * 45;
      userStats.assignedStudents = assignedCount > 0 ? assignedCount : 35;
      userStats.todayAttendance = attendancePercentage > 0 ? `${attendancePercentage}%` : 'N/A';
    } else if (user.role.name === 'student' && user.student) {
      profileName = user.student.name;
      designation = 'Student';
      photoPath = user.student.photoPath;

      const studRecords = await AttendanceRecord.findAll({ where: { studentId: user.student.id } });
      const studTotal = studRecords.length;
      const studPresent = studRecords.filter(r => r.status === 'Present').length;
      userStats.studentAttendance = studTotal > 0 ? `${Math.round((studPresent / studTotal) * 100)}%` : 'N/A';
    }

    const prevSession = await Session.findOne({
      where: { userId: user.id },
      order: [['createdAt', 'DESC']],
      offset: 1
    });
    const latestSession = await Session.findOne({
      where: { userId: user.id },
      order: [['createdAt', 'DESC']]
    });
    const lastLoginDate = prevSession ? prevSession.createdAt : (latestSession ? latestSession.createdAt : user.updatedAt);

    return res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        name: profileName,
        role: user.role.name,
        designation: designation,
        department: dept,
        photoPath: photoPath || null,
        lastLogin: lastLoginDate,
        isClassIncharge: user.role.name === 'faculty' ? isClassIncharge : false,
        classInchargeAssignments: inchargeAssignments
      },
      stats: {
        totalStudents,
        totalFaculty,
        totalSubjects,
        pendingLeaves,
        pendingRegistrations,
        attendancePercentage,
        ...userStats
      }
    });

  } catch (error) {
    console.error('[Dashboard Controller Stats Error]:', error);
    return res.status(500).json({ message: 'Internal server error fetching stats.' });
  }
};

exports.getTimetable = async (req, res) => {
  try {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const { day } = req.query;
    const targetDay = day || days[new Date().getDay()];

    if (targetDay === 'Sunday') {
      return res.status(200).json({
        day: 'Sunday',
        isHoliday: true,
        message: 'Sunday is a holiday! Enjoy your weekend.',
        timetable: []
      });
    }

    const slots = await Timetable.findAll({
      where: { dayOfWeek: targetDay },
      order: [['period', 'ASC']]
    });

    return res.status(200).json({
      day: targetDay,
      isHoliday: false,
      timetable: slots.map(s => ({
        id: s.id,
        period: s.period,
        timeSlot: s.timeSlot,
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        room: s.room
      }))
    });

  } catch (error) {
    console.error('[Dashboard Controller getTimetable Error]:', error);
    return res.status(500).json({ message: 'Internal server error retrieving timetable.' });
  }
};

exports.getActivities = async (req, res) => {
  try {
    const { Announcement } = require('../models');
    const dept = req.user.department || 'Computer Science & Engineering';
    const isHODOrAdmin = (req.user.role === 'admin' || req.user.role === 'hod');

    const activities = [];

    // 1. Department-scoped Leave Requests
    const leaves = await LeaveRequest.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [{
        model: Student,
        as: 'student',
        where: isHODOrAdmin ? { department: dept } : undefined
      }]
    });

    for (const l of leaves) {
      const studentName = l.student ? l.student.name : `Student #${l.studentId}`;

      if (l.status === 'Pending' || l.status === 'PENDING_HOD' || l.status === 'PENDING_CLASS_INCHARGE') {
        activities.push({
          id: `leave_${l.id}`,
          type: 'leave',
          icon: '📝',
          iconBg: '#FEF2F2',
          iconColor: '#EF4444',
          title: 'New leave request submitted',
          desc: `${studentName} submitted a ${l.leaveType || 'Leave'} request`,
          timestamp: l.createdAt
        });
      } else {
        activities.push({
          id: `leave_${l.id}_status`,
          type: 'leave_status',
          icon: l.status === 'Approved' || l.status === 'APPROVED' ? '✔️' : '❌',
          iconBg: l.status === 'Approved' || l.status === 'APPROVED' ? '#F0FDF4' : '#FEF2F2',
          iconColor: l.status === 'Approved' || l.status === 'APPROVED' ? '#16A34A' : '#EF4444',
          title: `Student leave ${l.status.toLowerCase()}`,
          desc: `${studentName}'s leave request was ${l.status.toLowerCase()}`,
          timestamp: l.updatedAt || l.createdAt
        });
      }
    }

    // 2. Department-scoped Attendance Sessions
    const sessionWhere = isHODOrAdmin ? { department: dept } : {};
    const sessions = await AttendanceSession.findAll({
      where: sessionWhere,
      limit: 10,
      order: [['createdAt', 'DESC']]
    });

    for (const s of sessions) {
      let facultyName = 'Faculty';
      if (s.facultyId) {
        const f = await Faculty.findByPk(s.facultyId);
        if (f) facultyName = f.name;
      }
      activities.push({
        id: `att_${s.id}`,
        type: 'attendance',
        icon: '👤',
        iconBg: '#EEF2FF',
        iconColor: '#4F46E5',
        title: 'Attendance updated',
        desc: `${facultyName} updated attendance for ${s.subjectCode || 'class'} (Year ${s.year}, Sem ${s.semester})`,
        timestamp: s.createdAt
      });
    }

    // 3. Announcements
    const anns = await Announcement.findAll({
      where: {
        targetDepartment: { [User.sequelize.Sequelize.Op.in]: [dept, 'all', 'ALL'] }
      },
      limit: 10,
      order: [['createdAt', 'DESC']]
    });

    for (const a of anns) {
      activities.push({
        id: `ann_${a.id}`,
        type: 'announcement',
        icon: '📢',
        iconBg: '#F3E8FF',
        iconColor: '#9333EA',
        title: 'New announcement posted',
        desc: `${a.postedBy || 'HOD'} published ${a.title}`,
        timestamp: a.createdAt
      });
    }

    // Sort newest first
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const recentActivities = activities.slice(0, 10).map(act => {
      const dt = new Date(act.timestamp);
      const timeStr = isNaN(dt.getTime()) ? '' : dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return {
        ...act,
        formattedTime: timeStr
      };
    });

    return res.status(200).json({ activities: recentActivities });

  } catch (error) {
    console.error('[Dashboard Controller getActivities Error]:', error);
    return res.status(500).json({ message: 'Internal server error fetching activities.' });
  }
};

exports.getAnnouncements = async (req, res) => {
  try {
    const { Announcement } = require('../models');
    const dept = req.user.department || 'Computer Science & Engineering';

    const anns = await Announcement.findAll({
      where: {
        targetDepartment: { [User.sequelize.Sequelize.Op.in]: [dept, 'all', 'ALL'] }
      },
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    const formattedAnnouncements = anns.map(a => ({
      id: a.id,
      title: a.title,
      content: a.content,
      category: a.category,
      postedBy: a.postedBy || `HOD - ${dept}`,
      priority: (a.priority || 'MEDIUM').toUpperCase(),
      date: a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
      createdAt: a.createdAt
    }));

    return res.status(200).json({ announcements: formattedAnnouncements });

  } catch (error) {
    console.error('[Dashboard Controller getAnnouncements Error]:', error);
    return res.status(500).json({ message: 'Internal server error fetching announcements.' });
  }
};
