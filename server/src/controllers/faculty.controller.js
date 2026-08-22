const { User, Role, Faculty, Student, Subject, ClassIncharge, AttendanceRecord } = require('../models');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Get all approved faculty
exports.getAllFaculty = async (req, res) => {
  try {
    const facultyRole = await Role.findOne({ where: { name: 'faculty' } });
    if (!facultyRole) {
      return res.status(404).json({ message: 'Faculty role not found.' });
    }

    const faculty = await User.findAll({
      where: { roleId: facultyRole.id, isApproved: true },
      include: [{ model: Faculty, as: 'faculty' }]
    });

    const formatted = faculty.map(u => {
      const p = u.faculty || {};
      const fId = p.id ? p.id : u.id;
      return {
        id: fId,
        facultyId: fId,
        userId: u.id,
        username: u.username,
        email: u.email,
        name: p.name || '',
        employeeId: p.employeeId || u.username,
        phone: p.phone || '',
        designation: p.designation || '',
        department: p.department || 'Computer Science & Engineering',
        photoPath: p.photoPath || null,
        isActive: u.isActive
      };
    });

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('[Faculty Controller getAllFaculty Error]:', error);
    return res.status(500).json({ message: 'Internal server error retrieving faculty.' });
  }
};

// Get single faculty by ID
exports.getFacultyById = async (req, res) => {
  try {
    const { id } = req.params;
    let user = await User.findByPk(id, {
      include: [{ model: Faculty, as: 'faculty', include: [{ model: Subject, as: 'subjects' }] }]
    });

    if (!user) {
      const profile = await Faculty.findOne({ where: { employeeId: id }, include: [{ model: Subject, as: 'subjects' }] });
      if (profile) {
        user = await User.findByPk(profile.userId, {
          include: [{ model: Faculty, as: 'faculty', include: [{ model: Subject, as: 'subjects' }] }]
        });
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'Faculty not found.' });
    }

    const p = user.faculty || {};
    const subjects = (p.subjects || []).map(s => ({
      id: s.id,
      code: s.code,
      name: s.name,
      credits: s.credits,
      semester: s.semester,
      section: s.section
    }));
    return res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      name: p.name || '',
      employeeId: p.employeeId || user.username,
      phone: p.phone || '',
      designation: p.designation || '',
      department: p.department || 'Computer Science & Engineering',
      qualification: p.qualification || '',
      researchArea: p.researchArea || '',
      publications: p.publications || '',
      photoPath: p.photoPath || null,
      isActive: user.isActive,
      subjects
    });
  } catch (error) {
    console.error('[Faculty Controller getFacultyById Error]:', error);
    return res.status(500).json({ message: 'Internal server error retrieving faculty.' });
  }
};

// Create Faculty
exports.createFaculty = async (req, res) => {
  const { employeeId, name, email, phone, designation, password } = req.body;

  if (!employeeId || !name || !email || !password) {
    return res.status(400).json({ message: 'Employee ID, name, email, and password are required.' });
  }

  const facultyRole = await Role.findOne({ where: { name: 'faculty' } });
  if (!facultyRole) {
    return res.status(500).json({ message: 'Faculty role not found in system.' });
  }

  // Check unique constraints
  const existingUser = await User.findOne({ where: { username: employeeId } });
  if (existingUser) {
    return res.status(400).json({ message: 'Faculty with this employee ID already exists.' });
  }

  const existingEmail = await User.findOne({ where: { email } });
  if (existingEmail) {
    return res.status(400).json({ message: 'Official email is already registered.' });
  }

  const t = await User.sequelize.transaction();
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username: employeeId,
      email,
      passwordHash,
      roleId: facultyRole.id,
      isApproved: true // HOD creations are approved by default
    }, { transaction: t });

    await Faculty.create({
      userId: newUser.id,
      name,
      employeeId,
      department: 'Computer Science & Engineering', // Backend enforced
      designation: designation || 'Assistant Professor',
      phone: phone || ''
    }, { transaction: t });

    await t.commit();

    return res.status(201).json({ message: 'Faculty created successfully.', id: newUser.id });
  } catch (error) {
    await t.rollback();
    console.error('[Faculty Controller createFaculty Error]:', error);
    return res.status(500).json({ message: 'Internal server error creating faculty.' });
  }
};

// Update Faculty
exports.updateFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, designation, qualification, researchArea, publications, photo } = req.body;

    let user = await User.findByPk(id, {
      include: [{ model: Faculty, as: 'faculty' }]
    });

    if (!user) {
      const profile = await Faculty.findOne({ where: { employeeId: id } });
      if (profile) {
        user = await User.findByPk(profile.userId, {
          include: [{ model: Faculty, as: 'faculty' }]
        });
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'Faculty not found.' });
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
          const filename = `profile-fac-${user.id}-${Date.now()}.${extension}`;
          const filepath = path.join(uploadsDir, filename);
          fs.writeFileSync(filepath, buffer);
          photoPath = `/uploads/${filename}`;
        }
      }
    }

    if (user.faculty) {
      user.faculty.name = name !== undefined ? name : user.faculty.name;
      user.faculty.phone = phone !== undefined ? phone : user.faculty.phone;
      user.faculty.designation = designation !== undefined ? designation : user.faculty.designation;
      user.faculty.qualification = qualification !== undefined ? qualification : user.faculty.qualification;
      user.faculty.researchArea = researchArea !== undefined ? researchArea : user.faculty.researchArea;
      user.faculty.publications = publications !== undefined ? publications : user.faculty.publications;
      if (photoPath !== undefined) user.faculty.photoPath = photoPath;
      await user.faculty.save();
    } else {
      await Faculty.create({
        userId: user.id,
        name: name || user.username,
        employeeId: user.username,
        department: 'Computer Science & Engineering',
        designation: designation || 'Assistant Professor',
        phone: phone || '',
        qualification: qualification || '',
        researchArea: researchArea || '',
        publications: publications || '',
        photoPath: photoPath || null
      });
    }

    return res.status(200).json({ message: 'Faculty profile updated successfully.', photoPath: photoPath || (user.faculty ? user.faculty.photoPath : null) });
  } catch (error) {
    console.error('[Faculty Controller updateFaculty Error]:', error);
    return res.status(500).json({ message: 'Internal server error updating faculty.' });
  }
};

// Delete Faculty
exports.deleteFaculty = async (req, res) => {
  const t = await User.sequelize.transaction();
  try {
    const { id } = req.params;
    let faculty = null;
    let user = null;

    const isNumeric = /^\d+$/.test(String(id));

    if (isNumeric) {
      faculty = await Faculty.findByPk(id, { transaction: t });
      if (faculty) {
        user = await User.findByPk(faculty.userId, { transaction: t });
      } else {
        user = await User.findByPk(id, { transaction: t });
        if (user) {
          faculty = await Faculty.findOne({ where: { userId: user.id }, transaction: t });
        }
      }
    }

    if (!user && !faculty) {
      faculty = await Faculty.findOne({ where: { employeeId: id }, transaction: t });
      if (faculty) {
        user = await User.findByPk(faculty.userId, { transaction: t });
      } else {
        user = await User.findOne({ where: { username: id }, transaction: t });
        if (user) {
          faculty = await Faculty.findOne({ where: { userId: user.id }, transaction: t });
        }
      }
    }

    if (!user && !faculty) {
      await t.rollback();
      return res.status(404).json({ message: 'Faculty record not found.' });
    }

    const userId = user ? user.id : (faculty ? faculty.userId : null);
    const facultyId = faculty ? faculty.id : null;

    // 1. Clean up ClassIncharge records
    if (facultyId) {
      await ClassIncharge.destroy({ where: { facultyId: facultyId }, transaction: t });
    }
    if (userId) {
      await ClassIncharge.destroy({ where: { facultyId: userId }, transaction: t });
    }

    // 2. Unassign assigned Subjects
    if (facultyId) {
      await Subject.update({ facultyId: null }, { where: { facultyId: facultyId }, transaction: t });
    }
    if (userId) {
      await Subject.update({ facultyId: null }, { where: { facultyId: userId }, transaction: t });
    }

    // 3. Destroy Faculty profile
    if (faculty) {
      await faculty.destroy({ transaction: t });
    } else if (userId) {
      await Faculty.destroy({ where: { userId: userId }, transaction: t });
    }

    // 4. Destroy User account
    if (user) {
      await user.destroy({ transaction: t });
    } else if (userId) {
      await User.destroy({ where: { id: userId }, transaction: t });
    }

    await t.commit();
    return res.status(200).json({ message: 'Faculty deleted successfully.' });
  } catch (error) {
    await t.rollback();
    console.error('[Faculty Controller deleteFaculty Error]:', error);
    return res.status(500).json({ message: error.message || 'Internal server error deleting faculty.' });
  }
};

// Get students authorized for logged-in faculty
exports.getMyStudents = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = (req.user.role || '').toLowerCase();

    if (userRole === 'student') {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const studentRole = await Role.findOne({ where: { name: 'student' } });
    if (!studentRole) {
      return res.status(404).json({ message: 'Student role not found.' });
    }

    const normYear = (val) => {
      if (!val) return '';
      const s = String(val).toLowerCase().trim();
      if (/^1(st)?(\s*year)?$/i.test(s) || /^i(-year)?$/i.test(s) || s === '1') return 'I-Year';
      if (/^2(nd)?(\s*year)?$/i.test(s) || /^ii(-year)?$/i.test(s) || s === '2') return 'II-Year';
      if (/^3(rd)?(\s*year)?$/i.test(s) || /^iii(-year)?$/i.test(s) || s === '3') return 'III-Year';
      if (/^4(th)?(\s*year)?$/i.test(s) || /^iv(-year)?$/i.test(s) || s === '4') return 'IV-Year';
      return val.trim();
    };

    const normSem = (val) => {
      if (!val) return '';
      const s = String(val).toUpperCase().trim();
      const map = { '1': '1', 'I': '1', '2': '2', 'II': '2', '3': '3', 'III': '3', '4': '4', 'IV': '4', '5': '5', 'V': '5', '6': '6', 'VI': '6', '7': '7', 'VII': '7', '8': '8', 'VIII': '8' };
      const cleaned = s.replace(/^SEMESTER\s*/i, '').replace(/^SEM\s*/i, '');
      return map[cleaned] || cleaned;
    };

    const normDept = (val) => {
      if (!val) return '';
      const s = String(val).toLowerCase().trim();
      if (s.includes('computer') || s === 'cse') return 'Computer Science & Engineering';
      if (s.includes('information') || s === 'it') return 'Information Technology';
      if (s.includes('electronics') || s === 'ece') return 'Electronics & Communication Engineering';
      if (s.includes('electrical') || s === 'eee') return 'Electrical & Electronics Engineering';
      if (s.includes('artificial') || s.includes('data') || s === 'ai&ds' || s === 'aids') return 'Artificial Intelligence & Data Science';
      return val.trim();
    };

    const normSec = (val) => {
      if (!val) return '';
      return String(val).toUpperCase().trim();
    };

    // 1. If Admin or HOD
    if (userRole === 'admin' || userRole === 'hod') {
      const studentWhere = {};
      if (req.user.department) {
        studentWhere.department = req.user.department;
      }

      const students = await User.findAll({
        where: { roleId: studentRole.id, isApproved: true },
        include: [{ model: Student, as: 'student', where: Object.keys(studentWhere).length > 0 ? studentWhere : undefined }],
        order: [[{ model: Student, as: 'student' }, 'registerNumber', 'ASC']]
      });

      let filteredStudents = students;
      if (req.query.year) {
        const qYear = normYear(req.query.year);
        filteredStudents = filteredStudents.filter(u => normYear(u.student?.year) === qYear);
      }
      if (req.query.department) {
        const qDept = normDept(req.query.department);
        filteredStudents = filteredStudents.filter(u => normDept(u.student?.department) === qDept);
      }

      const formatted = await Promise.all(filteredStudents.map(async u => {
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
          photoPath: p.photoPath || null,
          attendancePercentage
        };
      }));

      return res.status(200).json(formatted);
    }

    // 2. If Faculty role: Find Faculty profile record
    let facultyRecord = await Faculty.findOne({ where: { userId } });
    if (!facultyRecord && req.user.username) {
      facultyRecord = await Faculty.findOne({ where: { employeeId: req.user.username } });
    }

    const facId = facultyRecord ? facultyRecord.id : userId;
    const facDept = facultyRecord ? facultyRecord.department : (req.user.department || null);

    // Check ClassIncharge assignments
    const inchargeAssignments = await ClassIncharge.findAll({
      where: {
        [User.sequelize.Sequelize.Op.or]: [
          { facultyId: facId },
          { facultyId: userId }
        ]
      }
    });

    // Check Subject assignments
    const assignedSubjects = await Subject.findAll({
      where: {
        [User.sequelize.Sequelize.Op.or]: [
          { facultyId: facId },
          { facultyId: userId }
        ]
      }
    });

    console.log('[DEBUG GET /api/faculty/my-students]:', {
      userId,
      username: req.user.username,
      facultyDept: facDept,
      inchargeAssignments: inchargeAssignments.map(i => ({ department: i.department, year: i.year, semester: i.semester, section: i.section })),
      assignedSubjects: assignedSubjects.map(s => ({ code: s.code, name: s.name, department: s.department, year: s.year, semester: s.semester, section: s.section }))
    });

    const allStudents = await User.findAll({
      where: { roleId: studentRole.id, isApproved: true },
      include: [{ model: Student, as: 'student' }],
      order: [[{ model: Student, as: 'student' }, 'registerNumber', 'ASC']]
    });

    const authorizedStudents = allStudents.filter(u => {
      const s = u.student;
      if (!s) return false;

      const sDept = normDept(s.department);
      const sYear = normYear(s.year);
      const sSem = normSem(s.semester);
      const sSec = normSec(s.section);

      // Rule 1: Class Incharge exact matching (Department + Year + Semester + Section)
      if (inchargeAssignments.length > 0) {
        const matchesClass = inchargeAssignments.some(inc => {
          const incDept = normDept(inc.department);
          const incYear = normYear(inc.year);
          const incSem = normSem(inc.semester);
          const incSec = normSec(inc.section);

          if (incDept && sDept !== incDept) return false;
          if (incYear && sYear !== incYear) return false;
          if (incSem && sSem !== incSem) return false;
          if (incSec && incSec !== 'ALL' && sSec !== incSec) return false;

          return true;
        });

        if (matchesClass) return true;
      }

      // Rule 2: Subject Faculty exact matching (Department + Year + Semester + Section)
      if (assignedSubjects.length > 0) {
        const matchesSubject = assignedSubjects.some(sub => {
          const subDept = normDept(sub.department);
          const subYear = normYear(sub.year);
          const subSem = normSem(sub.semester);
          const subSec = normSec(sub.section);

          if (subDept && sDept !== subDept) return false;
          if (subYear && sYear !== subYear) return false;
          if (subSem && sSem !== subSem) return false;
          if (subSec && subSec !== 'ALL' && sSec !== subSec) return false;

          return true;
        });

        if (matchesSubject) return true;
      }

      // Rule 3: Fallback to faculty department
      if (inchargeAssignments.length === 0 && assignedSubjects.length === 0 && facDept) {
        if (sDept === normDept(facDept)) return true;
      }

      return false;
    });

    let filteredStudents = authorizedStudents;
    if (req.query.year) {
      const qYear = normYear(req.query.year);
      filteredStudents = filteredStudents.filter(u => normYear(u.student?.year) === qYear);
    }
    if (req.query.department) {
      const qDept = normDept(req.query.department);
      filteredStudents = filteredStudents.filter(u => normDept(u.student?.department) === qDept);
    }

    const formatted = await Promise.all(filteredStudents.map(async u => {
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
        photoPath: p.photoPath || null,
        attendancePercentage
      };
    }));

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('[Faculty Controller getMyStudents Error]:', error);
    return res.status(500).json({ message: 'Internal server error retrieving faculty students.' });
  }
};
