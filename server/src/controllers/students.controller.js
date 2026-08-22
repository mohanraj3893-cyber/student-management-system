const { User, Role, Student, AttendanceRecord, InternalMark, Subject } = require('../models');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const normalizeYear = (yearStr) => {
  if (!yearStr) return '';
  const str = String(yearStr).toLowerCase().trim();
  if (/^4(th)?(\s*year)?$/i.test(str) || /^iv(-year)?$/i.test(str)) return 'IV-Year';
  if (/^3(rd)?(\s*year)?$/i.test(str) || /^iii(-year)?$/i.test(str)) return 'III-Year';
  if (/^2(nd)?(\s*year)?$/i.test(str) || /^ii(-year)?$/i.test(str)) return 'II-Year';
  if (/^1(st)?(\s*year)?$/i.test(str) || /^i(-year)?$/i.test(str)) return 'I-Year';
  return yearStr.trim();
};

// Get all approved students for HOD department
exports.getAllStudents = async (req, res) => {
  try {
    const studentRole = await Role.findOne({ where: { name: 'student' } });
    if (!studentRole) {
      return res.status(404).json({ message: 'Student role not found.' });
    }

    const studentWhere = {};
    if ((req.user?.role === 'admin' || req.user?.role === 'hod') && req.user?.department) {
      studentWhere.department = req.user.department;
    }

    const students = await User.findAll({
      where: { roleId: studentRole.id, isApproved: true },
      include: [{ model: Student, as: 'student', where: Object.keys(studentWhere).length > 0 ? studentWhere : undefined }],
      order: [
        [{ model: Student, as: 'student' }, 'registerNumber', 'ASC']
      ]
    });

    const formatted = await Promise.all(students.map(async u => {
      const p = u.student || {};
      let attendancePercentage = null;
      if (p.id) {
        const records = await AttendanceRecord.findAll({ where: { studentId: p.id } });
        if (records.length > 0) {
          const present = records.filter(r => r.status === 'Present').length;
          attendancePercentage = Math.round((present / records.length) * 100);
        }
      }
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        name: p.name || '',
        registerNumber: p.registerNumber || u.username,
        phone: p.phone || '',
        year: p.year || '',
        semester: p.semester || '',
        section: p.section || '',
        department: p.department || 'Computer Science & Engineering',
        course: p.course || 'B.E',
        branch: p.branch || p.department || 'Computer Science & Engineering',
        batch: p.batch || '2024-2028',
        bloodGroup: p.bloodGroup || 'Unknown',
        dob: p.dob || '',
        address: p.address || '',
        aadhaarNo: p.aadhaarNo ? `XXXX XXXX ${p.aadhaarNo.slice(-4)}` : '',
        photoPath: p.photoPath || null,
        attendancePercentage,
        isActive: u.isActive
      };
    }));

    const { year, status } = req.query;
    let result = formatted;
    if (year && year !== 'all') {
      const targetYear = normalizeYear(year);
      result = result.filter(s => normalizeYear(s.year) === targetYear);
    }
    if (status && status !== 'all') {
      const isActiveTarget = status === 'active';
      result = result.filter(s => s.isActive === isActiveTarget);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('[Students Controller getAllStudents Error]:', error);
    return res.status(500).json({ message: 'Internal server error retrieving students.' });
  }
};

// Get single student by ID with strict department authorization check
exports.getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    let user = await User.findByPk(id, {
      include: [{ model: Student, as: 'student' }]
    });

    if (!user) {
      const profile = await Student.findOne({ where: { registerNumber: id } });
      if (profile) {
        user = await User.findByPk(profile.userId, {
          include: [{ model: Student, as: 'student' }]
        });
      }
    }

    if (!user || !user.student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    // Security Guard: HOD can only view students from their own department
    if ((req.user.role === 'admin' || req.user.role === 'hod') && req.user.department) {
      if (user.student.department !== req.user.department) {
        return res.status(403).json({ message: 'Access denied: student belongs to another department.' });
      }
    }

    const p = user.student || {};
    let attendanceStats = { percentage: null, presentDays: 0, absentDays: 0, totalDays: 0 };
    let marks = [];

    if (p.id) {
      const records = await AttendanceRecord.findAll({ where: { studentId: p.id } });
      if (records.length > 0) {
        const presentDays = records.filter(r => r.status === 'Present').length;
        const absentDays = records.filter(r => r.status === 'Absent').length;
        attendanceStats = {
          percentage: Math.round((presentDays / records.length) * 100),
          presentDays,
          absentDays,
          totalDays: records.length
        };
      }

      if (InternalMark) {
        const rawMarks = await InternalMark.findAll({
          where: { studentId: p.id },
          include: [{ model: Subject, as: 'subject' }]
        });
        marks = rawMarks.map(m => ({
          id: m.id,
          examType: m.examType,
          marksObtained: m.marksObtained,
          maxMarks: m.maxMarks,
          subjectCode: m.subject ? m.subject.code : 'N/A',
          subjectName: m.subject ? m.subject.name : 'N/A'
        }));
      }
    }

    return res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      name: p.name || '',
      registerNumber: p.registerNumber || user.username,
      phone: p.phone || '',
      year: p.year || '',
      semester: p.semester || '',
      section: p.section || '',
      department: p.department || 'Computer Science & Engineering',
      course: p.course || 'B.E',
      branch: p.branch || p.department || 'Computer Science & Engineering',
      batch: p.batch || '2024-2028',
      bloodGroup: p.bloodGroup || 'Unknown',
      dob: p.dob || '',
      address: p.address || '',
      aadhaarNo: p.aadhaarNo || '',
      guardianName: p.guardianName || '',
      guardianPhone: p.guardianPhone || '',
      photoPath: p.photoPath || null,
      attendanceStats,
      marks,
      isActive: user.isActive
    });
  } catch (error) {
    console.error('[Students Controller getStudentById Error]:', error);
    return res.status(500).json({ message: 'Internal server error retrieving student.' });
  }
};

// Create Student
exports.createStudent = async (req, res) => {
  const { registerNumber, name, email, phone, year, semester, course, branch, batch, bloodGroup, dob, address, aadhaarNo, password } = req.body;

  if (!registerNumber || !name || !email || !password) {
    return res.status(400).json({ message: 'Register number, name, email, and password are required.' });
  }

  if (aadhaarNo && !/^\d{12}$/.test(String(aadhaarNo).trim())) {
    return res.status(400).json({ message: 'Aadhaar number must contain exactly 12 digits.' });
  }

  const studentRole = await Role.findOne({ where: { name: 'student' } });
  if (!studentRole) {
    return res.status(500).json({ message: 'Student role not found in system.' });
  }

  const existingUser = await User.findOne({ where: { username: registerNumber } });
  if (existingUser) {
    return res.status(400).json({ message: 'Student with this register number already exists.' });
  }

  const existingEmail = await User.findOne({ where: { email } });
  if (existingEmail) {
    return res.status(400).json({ message: 'Official email is already registered.' });
  }

  const dept = req.user.department || 'Computer Science & Engineering';

  const t = await User.sequelize.transaction();
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username: registerNumber,
      email,
      passwordHash,
      roleId: studentRole.id,
      isApproved: true
    }, { transaction: t });

    await Student.create({
      userId: newUser.id,
      name,
      registerNumber,
      department: dept,
      year: year || '',
      semester: semester || '',
      phone: phone || '',
      course: course ? String(course).trim() : 'B.E',
      branch: branch ? String(branch).trim() : dept,
      batch: batch ? String(batch).trim() : '2024-2028',
      bloodGroup: bloodGroup ? String(bloodGroup).trim() : 'Unknown',
      dob: dob ? String(dob).trim() : null,
      address: address ? String(address).trim() : null,
      aadhaarNo: aadhaarNo ? String(aadhaarNo).trim() : null
    }, { transaction: t });

    await t.commit();

    return res.status(201).json({ message: 'Student created successfully.', id: newUser.id });
  } catch (error) {
    await t.rollback();
    console.error('[Students Controller createStudent Error]:', error);
    return res.status(500).json({ message: 'Internal server error creating student.' });
  }
};

// Update Student with department authorization check
exports.updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, year, semester, course, branch, batch, bloodGroup, dob, address, aadhaarNo, guardianName, guardianPhone, photo } = req.body;

    let user = await User.findByPk(id, {
      include: [{ model: Student, as: 'student' }]
    });

    if (!user) {
      const profile = await Student.findOne({ where: { registerNumber: id } });
      if (profile) {
        user = await User.findByPk(profile.userId, {
          include: [{ model: Student, as: 'student' }]
        });
      }
    }

    if (!user || !user.student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    // Security Check: HOD can only update students in their department
    if ((req.user.role === 'admin' || req.user.role === 'hod') && req.user.department) {
      if (user.student.department !== req.user.department) {
        return res.status(403).json({ message: 'Access denied: student belongs to another department.' });
      }
    }

    if (aadhaarNo && !/^\d{12}$/.test(String(aadhaarNo).trim())) {
      return res.status(400).json({ message: 'Aadhaar number must contain exactly 12 digits.' });
    }

    if (email && email !== user.email) {
      const emailExists = await User.findOne({ where: { email } });
      if (emailExists) {
        return res.status(400).json({ message: 'Email address already in use.' });
      }
      user.email = email;
    }

    await user.save();

    let photoPath = undefined;
    if (photo) {
      const matches = photo.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const allowedExts = ['jpeg', 'jpg', 'png', 'webp'];
        const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        if (allowedExts.includes(extension)) {
          const buffer = Buffer.from(matches[2], 'base64');
          const uploadsDir = path.join(__dirname, '../../uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          const filename = `profile-stud-${user.id}-${Date.now()}.${extension}`;
          const filepath = path.join(uploadsDir, filename);
          fs.writeFileSync(filepath, buffer);
          photoPath = `/uploads/${filename}`;
        }
      }
    }

    user.student.name = name !== undefined ? name : user.student.name;
    user.student.phone = phone !== undefined ? phone : user.student.phone;
    user.student.year = year !== undefined ? year : user.student.year;
    user.student.semester = semester !== undefined ? semester : user.student.semester;
    if (course !== undefined) user.student.course = course;
    if (branch !== undefined) user.student.branch = branch;
    if (batch !== undefined) user.student.batch = batch;
    if (bloodGroup !== undefined) user.student.bloodGroup = bloodGroup;
    if (dob !== undefined) user.student.dob = dob;
    if (address !== undefined) user.student.address = address;
    if (aadhaarNo !== undefined) user.student.aadhaarNo = aadhaarNo ? String(aadhaarNo).trim() : null;
    user.student.guardianName = guardianName !== undefined ? guardianName : user.student.guardianName;
    user.student.guardianPhone = guardianPhone !== undefined ? guardianPhone : user.student.guardianPhone;
    if (photoPath !== undefined) user.student.photoPath = photoPath;
    await user.student.save();

    return res.status(200).json({ message: 'Student profile updated successfully.', photoPath: photoPath || user.student.photoPath });
  } catch (error) {
    console.error('[Students Controller updateStudent Error]:', error);
    return res.status(500).json({ message: 'Internal server error updating student.' });
  }
};

// Delete Student with department authorization check
exports.deleteStudent = async (req, res) => {
  const t = await User.sequelize.transaction();
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      include: [{ model: Student, as: 'student' }],
      transaction: t
    });

    if (!user || !user.student) {
      await t.rollback();
      return res.status(404).json({ message: 'Student not found.' });
    }

    // Security Check: HOD can only delete students in their department
    if ((req.user.role === 'admin' || req.user.role === 'hod') && req.user.department) {
      if (user.student.department !== req.user.department) {
        await t.rollback();
        return res.status(403).json({ message: 'Access denied: student belongs to another department.' });
      }
    }

    await Student.destroy({ where: { userId: user.id }, transaction: t });
    await user.destroy({ transaction: t });

    await t.commit();
    return res.status(200).json({ message: 'Student deleted successfully.' });
  } catch (error) {
    await t.rollback();
    console.error('[Students Controller deleteStudent Error]:', error);
    return res.status(500).json({ message: 'Internal server error deleting student.' });
  }
};
