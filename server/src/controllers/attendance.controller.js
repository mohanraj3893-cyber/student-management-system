const { User, Student, Faculty, ClassIncharge, AttendanceSession, AttendanceRecord } = require('../models');

// Get assigned classes where logged-in faculty is Class Incharge
exports.getFacultyAssignedClasses = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ where: { userId: req.user.id } });
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
    }

    const classes = await ClassIncharge.findAll({
      where: { facultyId: faculty.id }
    });

    if (classes.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Attendance access is restricted to Class Incharge faculty.'
      });
    }

    return res.status(200).json(classes);
  } catch (error) {
    console.error('[Attendance Controller getFacultyAssignedClasses Error]:', error);
    return res.status(500).json({ success: false, message: 'Internal server error loading assigned classes.' });
  }
};

// Get student checklist + existing daily attendance for a class on a given date
exports.getDailyAttendanceChecklist = async (req, res) => {
  try {
    const { year, semester, section, date } = req.query;

    if (!year || !semester || !section || !date) {
      return res.status(400).json({ success: false, message: 'Year, semester, section, and date are required.' });
    }

    const dept = req.user.department || 'Computer Science & Engineering';

    // Verify Faculty is Class Incharge if user is faculty
    if (req.user.role === 'faculty') {
      const faculty = await Faculty.findOne({ where: { userId: req.user.id } });
      if (!faculty) {
        return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
      }

      const allIncharges = await ClassIncharge.findAll({ where: { facultyId: faculty.id } });
      if (allIncharges.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Attendance access is restricted to Class Incharge faculty.'
        });
      }

      const isClassIncharge = allIncharges.some(c => 
        c.year === year && c.semester === semester && c.section === section
      );

      if (!isClassIncharge) {
        return res.status(403).json({
          success: false,
          message: 'Attendance access is restricted to Class Incharge faculty.'
        });
      }
    }

    const getSemVariants = (sem) => {
      const s = String(sem).trim().toUpperCase();
      if (s === '1' || s === 'I' || s.includes('1') || s.includes('I SEM') || s.includes('SEM 1')) return ['1', 'I', 'I Semester', 'Semester I', '1st Semester', '1 sem', 'sem 1', '1st', 'SEM I'];
      if (s === '2' || s === 'II' || s.includes('2') || s.includes('II SEM') || s.includes('SEM 2')) return ['2', 'II', 'II Semester', 'Semester II', '2nd Semester', '2 sem', 'sem 2', '2nd', 'SEM II'];
      if (s === '3' || s === 'III' || s.includes('3') || s.includes('III SEM') || s.includes('SEM 3')) return ['3', 'III', 'III Semester', 'Semester III', '3rd Semester', '3 sem', 'sem 3', '3rd', 'SEM III'];
      if (s === '4' || s === 'IV' || s.includes('4') || s.includes('IV SEM') || s.includes('SEM 4')) return ['4', 'IV', 'IV Semester', 'Semester IV', '4th Semester', '4 sem', 'sem 4', '4th', 'SEM IV'];
      if (s === '5' || s === 'V' || s.includes('5') || s.includes('V SEM') || s.includes('SEM 5')) return ['5', 'V', 'V Semester', 'Semester V', '5th Semester', '5 sem', 'sem 5', '5th', 'SEM V'];
      if (s === '6' || s === 'VI' || s.includes('6') || s.includes('VI SEM') || s.includes('SEM 6')) return ['6', 'VI', 'VI Semester', 'Semester VI', '6th Semester', '6 sem', 'sem 6', '6th', 'SEM VI'];
      if (s === '7' || s === 'VII' || s.includes('7') || s.includes('VII SEM') || s.includes('SEM 7')) return ['7', 'VII', 'VII Semester', 'Semester VII', '7th Semester', '7 sem', 'sem 7', '7th', 'SEM VII'];
      if (s === '8' || s === 'VIII' || s.includes('8') || s.includes('VIII SEM') || s.includes('SEM 8')) return ['8', 'VIII', 'VIII Semester', 'Semester VIII', '8th Semester', '8 sem', 'sem 8', '8th', 'SEM VIII'];
      return [sem];
    };

    const semVariants = getSemVariants(semester);

    // Load active approved students matching the class AND department
    const students = await Student.findAll({
      where: {
        department: dept,
        semester: { [User.sequelize.Sequelize.Op.in]: semVariants },
        section
      },
      include: [{
        model: User,
        as: 'user',
        where: { isApproved: true, isActive: true }
      }],
      order: [['registerNumber', 'ASC']]
    });

    const session = await AttendanceSession.findOne({
      where: { department: dept, year, semester, section, date },
      include: [{ model: AttendanceRecord, as: 'records' }]
    });

    const recordsMap = {};
    if (session && session.records) {
      session.records.forEach(r => {
        recordsMap[r.studentId] = r.status;
      });
    }

    const formatted = students.map(s => ({
      id: s.id,
      registerNumber: s.registerNumber,
      name: s.name,
      photoPath: s.photoPath,
      status: recordsMap[s.id] || 'Present'
    }));

    return res.status(200).json({
      isMarked: !!session,
      sessionDate: date,
      students: formatted
    });

  } catch (error) {
    console.error('[Attendance Controller getDailyAttendanceChecklist Error]:', error);
    return res.status(500).json({ message: 'Internal server error loading daily checklist.' });
  }
};

// Save / Update Daily Attendance for a Class (Strictly Class Incharge Faculty ONLY)
exports.saveDailyAttendance = async (req, res) => {
  const { year, semester, section, date, records } = req.body;

  if (!year || !semester || !section || !date || !records || !Array.isArray(records)) {
    return res.status(400).json({ message: 'Year, semester, section, date, and student records are required.' });
  }

  if (req.user.role !== 'faculty') {
    return res.status(403).json({ success: false, message: 'Attendance access is restricted to Class Incharge faculty.' });
  }

  try {
    const faculty = await Faculty.findOne({ where: { userId: req.user.id } });
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
    }

    const allIncharges = await ClassIncharge.findAll({ where: { facultyId: faculty.id } });
    if (allIncharges.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Attendance access is restricted to Class Incharge faculty.'
      });
    }

    const dept = req.user.department || faculty.department || 'Computer Science & Engineering';

    const isClassIncharge = allIncharges.some(c => 
      c.year === year && c.semester === semester && c.section === section
    );

    if (!isClassIncharge) {
      return res.status(403).json({
        success: false,
        message: 'Attendance access is restricted to Class Incharge faculty.'
      });
    }

    const t = await AttendanceSession.sequelize.transaction();
    try {
      let [session, created] = await AttendanceSession.findOrCreate({
        where: { department: dept, year, semester, section, date },
        defaults: {
          facultyId: faculty.id,
          department: dept,
          year,
          semester,
          section,
          date
        },
        transaction: t
      });

      if (!created || session.facultyId !== faculty.id) {
        session.facultyId = faculty.id;
        await session.save({ transaction: t });
      }

      for (const rec of records) {
        const { studentId, status } = rec;
        if (!studentId || !['Present', 'Absent'].includes(status)) continue;

        let record = await AttendanceRecord.findOne({
          where: { studentId, date },
          transaction: t
        });

        if (record) {
          record.status = status;
          record.sessionId = session.id;
          record.markedAt = new Date();
          await record.save({ transaction: t });
        } else {
          await AttendanceRecord.create({
            sessionId: session.id,
            studentId,
            date,
            status,
            markedAt: new Date()
          }, { transaction: t });
        }
      }

      await t.commit();

      try {
        const socketManager = require('../realtime/socketManager');
        socketManager.broadcastToAll('ATTENDANCE_UPDATED', {
          year,
          semester,
          section,
          date,
          facultyName: faculty.name
        });
      } catch (sErr) {
        console.error('Socket broadcast error:', sErr);
      }

      return res.status(200).json({ message: `Daily attendance for ${date} saved successfully.` });

    } catch (err) {
      await t.rollback();
      throw err;
    }

  } catch (error) {
    console.error('[Attendance Controller saveDailyAttendance Error]:', error);
    return res.status(500).json({ message: 'Internal server error saving daily attendance.' });
  }
};

// Retrieve Attendance History / Reports (Scoped by HOD Department)
exports.getAttendanceHistory = async (req, res) => {
  try {
    const userRole = req.user.role;

    if (userRole === 'admin' || userRole === 'hod') {
      const { date, facultyId, year, section } = req.query;
      const sessionWhere = {};
      
      // Enforce HOD Department scoping
      if (req.user.department) {
        sessionWhere.department = req.user.department;
      }
      if (date) sessionWhere.date = date;
      if (facultyId) sessionWhere.facultyId = facultyId;
      if (year) sessionWhere.year = year;
      if (section) sessionWhere.section = section;

      const sessions = await AttendanceSession.findAll({
        where: sessionWhere,
        include: [
          { model: Faculty, as: 'faculty', attributes: ['id', 'name', 'employeeId', 'designation'] },
          { 
            model: AttendanceRecord, 
            as: 'records', 
            include: [{ model: Student, as: 'student' }] 
          }
        ],
        order: [['date', 'DESC'], ['created_at', 'DESC']]
      });

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const formattedSessions = sessions.map(s => {
        const recs = s.records || [];
        const presentCount = recs.filter(r => r.status === 'Present').length;
        const absentCount = recs.filter(r => r.status === 'Absent').length;
        const totalCount = presentCount + absentCount;
        const pctVal = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

        let formattedDate = s.date;
        if (s.date && s.date.includes('-')) {
          const parts = s.date.split('-');
          if (parts.length === 3) {
            const y = parts[0];
            const m = parseInt(parts[1]) - 1;
            const d = parseInt(parts[2]);
            if (months[m]) {
              formattedDate = `${d} ${months[m]} ${y}`;
            }
          }
        }

        const studentRecords = recs.map(r => ({
          registerNumber: r.student ? r.student.registerNumber : 'N/A',
          studentName: r.student ? r.student.name : 'N/A',
          status: r.status
        })).sort((a, b) => (a.registerNumber || '').localeCompare(b.registerNumber || ''));

        return {
          id: s.id,
          date: s.date,
          formattedDate,
          year: s.year,
          semester: s.semester,
          section: s.section,
          facultyId: s.facultyId,
          facultyName: s.faculty ? s.faculty.name : 'Class Incharge',
          presentCount,
          absentCount,
          totalCount,
          presentRatio: `${presentCount} / ${totalCount}`,
          percentage: `${pctVal}%`,
          records: studentRecords
        };
      });

      return res.status(200).json({
        sessions: formattedSessions
      });

    } else if (userRole === 'faculty') {
      const faculty = await Faculty.findOne({ where: { userId: req.user.id } });
      if (!faculty) {
        return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
      }

      const allIncharges = await ClassIncharge.findAll({ where: { facultyId: faculty.id } });
      if (allIncharges.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Attendance access is restricted to Class Incharge faculty.'
        });
      }

      const sessions = await AttendanceSession.findAll({
        where: { facultyId: faculty.id },
        include: [
          { model: AttendanceRecord, as: 'records', include: [{ model: Student, as: 'student' }] }
        ],
        order: [['date', 'DESC']]
      });

      const formatted = sessions.map(s => {
        const recs = s.records || [];
        const presentCount = recs.filter(r => r.status === 'Present').length;
        const absentCount = recs.filter(r => r.status === 'Absent').length;
        const total = presentCount + absentCount;

        return {
          id: s.id,
          date: s.date,
          year: s.year,
          semester: s.semester,
          section: s.section,
          presentCount,
          absentCount,
          totalCount: total,
          percentage: total > 0 ? `${Math.round((presentCount / total) * 100)}%` : '0%'
        };
      });

      return res.status(200).json(formatted);

    } else if (userRole === 'student') {
      const student = await Student.findOne({ where: { userId: req.user.id } });
      if (!student) {
        return res.status(404).json({ message: 'Student profile not found.' });
      }

      const records = await AttendanceRecord.findAll({
        where: { studentId: student.id },
        include: [{ model: AttendanceSession, as: 'session' }],
        order: [['date', 'DESC']]
      });

      const totalClasses = records.length;
      const presentClasses = records.filter(r => r.status === 'Present').length;
      const pct = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : null;

      return res.status(200).json({
        records: records.map(r => ({
          id: r.id,
          date: r.date,
          status: r.status
        })),
        attendanceStats: {
          percentage: pct,
          presentDays: presentClasses,
          absentDays: totalClasses - presentClasses,
          totalDays: totalClasses
        }
      });
    }
  } catch (error) {
    console.error('[Attendance Controller getAttendanceHistory Error]:', error);
    return res.status(500).json({ message: 'Internal server error retrieving attendance history.' });
  }
};
