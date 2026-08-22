const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { sequelize, Role, User, Student, Faculty, Subject, AttendanceSession, AttendanceRecord, InternalMark, LeaveRequest, Announcement, Timetable } = require('./src/models');

const sqliteDbPath = path.join(__dirname, 'sms_database.sqlite');
const sqliteDb = new sqlite3.Database(sqliteDbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening SQLite DB:', err.message);
    process.exit(1);
  }
});

const queryAll = (sql) => {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function migrate() {
  try {
    // Authenticate MySQL connection
    await sequelize.authenticate();
    console.log('Connected to MySQL database.');

    // We disable foreign key checks during migration to prevent ordering errors
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

    // 1. Migrate Roles
    const sqliteRoles = await queryAll('SELECT * FROM roles;');
    console.log(`Read ${sqliteRoles.length} roles from SQLite.`);
    await Role.destroy({ truncate: true, force: true });
    for (const r of sqliteRoles) {
      try {
        await Role.create({
          id: r.id,
          name: r.name,
          description: r.description,
          createdAt: r.created_at || new Date(),
          updatedAt: r.updated_at || new Date()
        });
      } catch (err) {
        console.warn(`[Skip Role ${r.id}]: ${err.message}`);
      }
    }
    console.log('Migrated Roles.');

    // 2. Migrate Users
    const sqliteUsers = await queryAll('SELECT * FROM users;');
    console.log(`Read ${sqliteUsers.length} users from SQLite.`);
    await User.destroy({ truncate: true, force: true });
    for (const u of sqliteUsers) {
      try {
        await User.create({
          id: u.id,
          username: u.username,
          email: u.email,
          passwordHash: u.password_hash,
          roleId: u.role_id,
          isApproved: u.is_approved === 1,
          isActive: u.is_active === 1,
          createdAt: u.created_at || new Date(),
          updatedAt: u.updated_at || new Date()
        });
      } catch (err) {
        console.warn(`[Skip User ${u.id}]: ${err.message}`);
      }
    }
    console.log('Migrated Users.');

    // 3. Migrate Students
    const sqliteStudents = await queryAll('SELECT * FROM students;');
    console.log(`Read ${sqliteStudents.length} students from SQLite.`);
    await Student.destroy({ truncate: true, force: true });
    for (const s of sqliteStudents) {
      try {
        await Student.create({
          id: s.id,
          userId: s.user_id,
          name: s.name,
          registerNumber: s.register_number,
          department: s.department,
          year: s.year,
          semester: s.semester,
          section: s.section,
          phone: s.phone,
          photoPath: s.photo_path,
          guardianName: s.guardian_name,
          guardianPhone: s.guardian_phone,
          createdAt: s.created_at || new Date(),
          updatedAt: s.updated_at || new Date()
        });
      } catch (err) {
        console.warn(`[Skip Student ${s.id}]: ${err.message}`);
      }
    }
    console.log('Migrated Students.');

    // 4. Migrate Faculty
    const sqliteFaculty = await queryAll('SELECT * FROM faculty;');
    console.log(`Read ${sqliteFaculty.length} faculty from SQLite.`);
    await Faculty.destroy({ truncate: true, force: true });
    for (const f of sqliteFaculty) {
      try {
        await Faculty.create({
          id: f.id,
          userId: f.user_id,
          name: f.name,
          employeeId: f.employee_id,
          designation: f.designation,
          department: f.department,
          phone: f.phone,
          photoPath: f.photo_path,
          qualification: f.qualification,
          researchArea: f.research_area,
          publications: f.publications,
          createdAt: f.created_at || new Date(),
          updatedAt: f.updated_at || new Date()
        });
      } catch (err) {
        console.warn(`[Skip Faculty ${f.id}]: ${err.message}`);
      }
    }
    console.log('Migrated Faculty.');

    // 5. Migrate Subjects
    const sqliteSubjects = await queryAll('SELECT * FROM subjects;');
    console.log(`Read ${sqliteSubjects.length} subjects from SQLite.`);
    await Subject.destroy({ truncate: true, force: true });
    for (const sub of sqliteSubjects) {
      try {
        await Subject.create({
          id: sub.id,
          code: sub.code,
          name: sub.name,
          credits: sub.credits,
          semester: sub.semester,
          section: sub.section,
          department: sub.department,
          facultyId: sub.faculty_id,
          createdAt: sub.created_at || new Date(),
          updatedAt: sub.updated_at || new Date()
        });
      } catch (err) {
        console.warn(`[Skip Subject ${sub.id}]: ${err.message}`);
      }
    }
    console.log('Migrated Subjects.');

    // 6. Migrate Attendance Sessions
    const sqliteSessions = await queryAll('SELECT * FROM attendance_sessions;');
    console.log(`Read ${sqliteSessions.length} attendance sessions from SQLite.`);
    await AttendanceSession.destroy({ truncate: true, force: true });
    for (const as of sqliteSessions) {
      try {
        await AttendanceSession.create({
          id: as.id,
          subjectId: as.subject_id,
          facultyId: as.faculty_id || 1, // fallback to first faculty if null
          date: as.date,
          section: as.section,
          semester: as.semester,
          period: as.period,
          createdAt: as.created_at || new Date(),
          updatedAt: as.updated_at || new Date()
        });
      } catch (err) {
        console.warn(`[Skip Session ${as.id}]: ${err.message}`);
      }
    }
    console.log('Migrated Attendance Sessions.');

    // 7. Migrate Attendance Records
    const sqliteRecords = await queryAll('SELECT * FROM attendance_records;');
    console.log(`Read ${sqliteRecords.length} attendance records from SQLite.`);
    await AttendanceRecord.destroy({ truncate: true, force: true });
    for (const ar of sqliteRecords) {
      try {
        await AttendanceRecord.create({
          id: ar.id,
          sessionId: ar.session_id,
          studentId: ar.student_id,
          status: ar.status,
          markedAt: ar.marked_at,
          createdAt: ar.created_at || new Date(),
          updatedAt: ar.updated_at || new Date()
        });
      } catch (err) {
        console.warn(`[Skip Attendance Record ${ar.id}]: ${err.message}`);
      }
    }
    console.log('Migrated Attendance Records.');

    // 8. Migrate Internal Marks
    const sqliteMarks = await queryAll('SELECT * FROM internal_marks;');
    console.log(`Read ${sqliteMarks.length} internal marks from SQLite.`);
    await InternalMark.destroy({ truncate: true, force: true });
    for (const m of sqliteMarks) {
      try {
        await InternalMark.create({
          id: m.id,
          studentId: m.student_id,
          subjectId: m.subject_id,
          examType: m.exam_type,
          marksObtained: m.marks_obtained,
          maxMarks: m.max_marks,
          createdAt: m.created_at || new Date(),
          updatedAt: m.updated_at || new Date()
        });
      } catch (err) {
        console.warn(`[Skip Internal Mark ${m.id}]: ${err.message}`);
      }
    }
    console.log('Migrated Internal Marks.');

    // 9. Migrate Leave Requests
    const sqliteLeaves = await queryAll('SELECT * FROM leave_requests;');
    console.log(`Read ${sqliteLeaves.length} leave requests from SQLite.`);
    await LeaveRequest.destroy({ truncate: true, force: true });
    for (const l of sqliteLeaves) {
      try {
        await LeaveRequest.create({
          id: l.id,
          studentId: l.student_id,
          reason: l.reason,
          startDate: l.start_date,
          endDate: l.end_date,
          days: l.days,
          status: l.status,
          rejectionReason: l.rejection_reason,
          createdAt: l.created_at || new Date(),
          updatedAt: l.updated_at || new Date()
        });
      } catch (err) {
        console.warn(`[Skip Leave ${l.id}]: ${err.message}`);
      }
    }
    console.log('Migrated Leave Requests.');

    // 10. Migrate Announcements
    const sqliteAnnouncements = await queryAll('SELECT * FROM announcements;');
    console.log(`Read ${sqliteAnnouncements.length} announcements from SQLite.`);
    await Announcement.destroy({ truncate: true, force: true });
    for (const a of sqliteAnnouncements) {
      try {
        await Announcement.create({
          id: a.id,
          title: a.title,
          content: a.content,
          category: a.category,
          postedBy: a.posted_by,
          createdAt: a.created_at || new Date(),
          updatedAt: a.updated_at || new Date()
        });
      } catch (err) {
        console.warn(`[Skip Announcement ${a.id}]: ${err.message}`);
      }
    }
    console.log('Migrated Announcements.');

    // 11. Migrate Timetable
    const sqliteTimetable = await queryAll('SELECT * FROM timetable;');
    console.log(`Read ${sqliteTimetable.length} timetable records from SQLite.`);
    await Timetable.destroy({ truncate: true, force: true });
    for (const t of sqliteTimetable) {
      try {
        await Timetable.create({
          id: t.id,
          dayOfWeek: t.day_of_week,
          period: t.period,
          timeSlot: t.time_slot,
          subjectCode: t.subject_code,
          subjectName: t.subject_name,
          room: t.room,
          createdAt: t.created_at || new Date(),
          updatedAt: t.updated_at || new Date()
        });
      } catch (err) {
        console.warn(`[Skip Timetable ${t.id}]: ${err.message}`);
      }
    }
    console.log('Migrated Timetable.');

    // Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    sqliteDb.close();
    await sequelize.close();
    process.exit(0);
  }
}

migrate();
