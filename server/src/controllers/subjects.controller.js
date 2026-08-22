const { Subject, Faculty, Student } = require('../models');
const { Op } = require('sequelize');

function getSemNum(sem) {
  if (sem === null || sem === undefined) return 0;
  const str = String(sem).trim().toUpperCase();
  if (str === '8' || str === 'VIII' || str.includes('SEM 8') || str.includes('SEMESTER 8') || str.includes('SEMESTER VIII')) return 8;
  if (str === '7' || str === 'VII' || str.includes('SEM 7') || str.includes('SEMESTER 7') || str.includes('SEMESTER VII')) return 7;
  if (str === '6' || str === 'VI' || str.includes('SEM 6') || str.includes('SEMESTER 6') || str.includes('SEMESTER VI')) return 6;
  if (str === '5' || str === 'V' || str.includes('SEM 5') || str.includes('SEMESTER 5') || str.includes('SEMESTER V')) return 5;
  if (str === '4' || str === 'IV' || str.includes('SEM 4') || str.includes('SEMESTER 4') || str.includes('SEMESTER IV')) return 4;
  if (str === '3' || str === 'III' || str.includes('SEM 3') || str.includes('SEMESTER 3') || str.includes('SEMESTER III')) return 3;
  if (str === '2' || str === 'II' || str.includes('SEM 2') || str.includes('SEMESTER 2') || str.includes('SEMESTER II')) return 2;
  if (str === '1' || str === 'I' || str.includes('SEM 1') || str.includes('SEMESTER 1') || str.includes('SEMESTER I')) return 1;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function getYearNum(yr) {
  if (yr === null || yr === undefined) return 0;
  const str = String(yr).trim().toUpperCase();
  if (str.includes('4TH') || str.includes('IV') || str === '4') return 4;
  if (str.includes('3RD') || str.includes('III') || str === '3') return 3;
  if (str.includes('2ND') || str.includes('II') || str === '2') return 2;
  if (str.includes('1ST') || str.includes('I') || str === '1') return 1;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function getYearNumFromSemNum(semNum) {
  if (semNum === 1 || semNum === 2) return 1;
  if (semNum === 3 || semNum === 4) return 2;
  if (semNum === 5 || semNum === 6) return 3;
  if (semNum === 7 || semNum === 8) return 4;
  return 0;
}

function isYearMatch(yrA, yrB, semA = null, semB = null) {
  if (!yrA && semA) {
    const sNum = getSemNum(semA);
    const yNum = getYearNumFromSemNum(sNum);
    if (yNum > 0) yrA = String(yNum);
  }
  if (!yrB && semB) {
    const sNum = getSemNum(semB);
    const yNum = getYearNumFromSemNum(sNum);
    if (yNum > 0) yrB = String(yNum);
  }
  if (!yrA || !yrB) return true;
  const numA = getYearNum(yrA);
  const numB = getYearNum(yrB);
  if (numA > 0 && numB > 0) return numA === numB;
  return String(yrA).trim().toLowerCase() === String(yrB).trim().toLowerCase();
}

function isSemesterMatch(semA, semB) {
  if (!semA || !semB) return false;
  const numA = getSemNum(semA);
  const numB = getSemNum(semB);
  if (numA > 0 && numB > 0) return numA === numB;
  return String(semA).trim().toLowerCase() === String(semB).trim().toLowerCase();
}

function isSectionMatch(secA, secB) {
  if (!secA || !secB) return true;
  const cleanA = String(secA).trim().toUpperCase();
  const cleanB = String(secB).trim().toUpperCase();
  if (cleanA === 'ALL' || cleanB === 'ALL' || cleanA === '' || cleanB === '') return true;
  return cleanA === cleanB;
}

function isDepartmentMatch(deptA, deptB) {
  if (!deptA || !deptB) return false;
  const cleanA = String(deptA).trim().toLowerCase();
  const cleanB = String(deptB).trim().toLowerCase();
  if (cleanA === cleanB) return true;
  if (cleanA.replace(/[^a-z0-9]/g, '') === cleanB.replace(/[^a-z0-9]/g, '')) return true;
  return false;
}

const normalizeSemester = (val) => {
  if (!val) return '';
  const str = String(val).toLowerCase().trim();
  if (/^(semester\s*8|sem\s*8|8|8th(\s*semester)?|viii)$/i.test(str)) return 'Semester 8';
  if (/^(semester\s*7|sem\s*7|7|7th(\s*semester)?|vii)$/i.test(str)) return 'Semester 7';
  if (/^(semester\s*6|sem\s*6|6|6th(\s*semester)?|vi)$/i.test(str)) return 'Semester 6';
  if (/^(semester\s*5|sem\s*5|5|5th(\s*semester)?|v)$/i.test(str)) return 'Semester 5';
  if (/^(semester\s*4|sem\s*4|4|4th(\s*semester)?|iv)$/i.test(str)) return 'Semester 4';
  if (/^(semester\s*3|sem\s*3|3|3rd(\s*semester)?|iii)$/i.test(str)) return 'Semester 3';
  if (/^(semester\s*2|sem\s*2|2|2nd(\s*semester)?|ii)$/i.test(str)) return 'Semester 2';
  if (/^(semester\s*1|sem\s*1|1|1st(\s*semester)?|i)$/i.test(str)) return 'Semester 1';
  return String(val).trim();
};

// Get assigned subjects for faculty
exports.getFacultyMySubjects = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ where: { userId: req.user.id } });
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty profile not found.' });
    }

    const subjects = await Subject.findAll({
      where: {
        department: faculty.department || 'Computer Science & Engineering',
        [Op.or]: [
          { facultyId: faculty.id },
          { facultyId: faculty.userId }
        ]
      }
    });

    return res.status(200).json(subjects);
  } catch (error) {
    console.error('[Subjects Controller getFacultyMySubjects Error]:', error);
    return res.status(500).json({ message: 'Internal server error loading faculty subjects.' });
  }
};

// Get enrolled subjects matching student's Department + Year + Semester + Section
exports.getMyEnrolledSubjects = async (req, res) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    const allDeptSubjects = await Subject.findAll({
      where: {
        department: student.department || 'Computer Science & Engineering'
      },
      include: [{ model: Faculty, as: 'faculty' }],
      order: [['code', 'ASC']]
    });

    const subjects = allDeptSubjects.filter(sub => 
      isDepartmentMatch(sub.department, student.department) &&
      isYearMatch(sub.year, student.year, sub.semester, student.semester) &&
      isSemesterMatch(sub.semester, student.semester) &&
      isSectionMatch(sub.section, student.section)
    );

    const formatted = subjects.map(s => {
      const f = s.faculty || {};
      return {
        id: s.id,
        code: s.code,
        name: s.name,
        credits: s.credits,
        semester: normalizeSemester(s.semester),
        department: s.department,
        facultyName: f.name || 'Not Assigned'
      };
    });

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('[Subjects Controller getMyEnrolledSubjects Error]:', error);
    return res.status(500).json({ message: 'Internal server error loading student subjects.' });
  }
};

// Get all subjects scoped by HOD Department
exports.getAllSubjects = async (req, res) => {
  try {
    const subjectWhere = {};
    if ((req.user.role === 'admin' || req.user.role === 'hod') && req.user.department) {
      subjectWhere.department = req.user.department;
    }

    const subjects = await Subject.findAll({
      where: Object.keys(subjectWhere).length > 0 ? subjectWhere : undefined,
      include: [{ model: Faculty, as: 'faculty' }],
      order: [['code', 'ASC']]
    });

    const formatted = subjects.map(s => {
      const f = s.faculty || {};
      return {
        id: s.id,
        code: s.code,
        name: s.name,
        credits: s.credits,
        rawSemester: s.semester,
        semester: normalizeSemester(s.semester),
        department: s.department || 'Computer Science & Engineering',
        facultyId: f.id || f.userId || null,
        facultyName: f.name || 'Not Assigned'
      };
    });

    const { semester } = req.query;
    let result = formatted;
    if (semester && semester !== 'all') {
      const targetSem = normalizeSemester(semester);
      result = result.filter(s => normalizeSemester(s.semester) === targetSem);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('[Subjects Controller getAllSubjects Error]:', error);
    return res.status(500).json({ message: 'Internal server error retrieving subjects.' });
  }
};

// Get single subject by ID with department ownership check
exports.getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findByPk(id, {
      include: [{ model: Faculty, as: 'faculty' }]
    });

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    if ((req.user.role === 'admin' || req.user.role === 'hod') && req.user.department) {
      if (subject.department !== req.user.department) {
        return res.status(403).json({ message: 'Access denied: subject belongs to another department.' });
      }
    }

    const f = subject.faculty || {};
    return res.status(200).json({
      id: subject.id,
      code: subject.code,
      name: subject.name,
      credits: subject.credits,
      semester: subject.semester,
      department: subject.department || 'Computer Science & Engineering',
      facultyId: f.id || f.userId || null,
      facultyName: f.name || 'Not Assigned'
    });
  } catch (error) {
    console.error('[Subjects Controller getSubjectById Error]:', error);
    return res.status(500).json({ message: 'Internal server error retrieving subject.' });
  }
};

function deriveYearFromSemester(sem) {
  const semNum = getSemNum(sem);
  const yrNum = getYearNumFromSemNum(semNum);
  if (yrNum === 1) return 'I-Year';
  if (yrNum === 2) return 'II-Year';
  if (yrNum === 3) return 'III-Year';
  if (yrNum === 4) return 'IV-Year';
  return 'III-Year';
}

// Create Subject (Enforces req.user.department)
exports.createSubject = async (req, res) => {
  try {
    const { code, name, credits, semester, year, section, facultyId } = req.body;

    console.log('[DEBUG POST /api/subjects] Incoming createSubject payload:', {
      code, name, credits, semester, year, section, facultyId,
      userDept: req.user ? req.user.department : null
    });

    if (!code || !name || !credits || !semester) {
      return res.status(400).json({ message: 'Code, name, credits, and semester are required.' });
    }

    const existingSubject = await Subject.findOne({ where: { code } });
    if (existingSubject) {
      return res.status(400).json({ message: 'Subject code already exists.' });
    }

    let mappedFacultyId = null;
    if (facultyId) {
      const faculty = await Faculty.findOne({
        where: {
          [Op.or]: [{ id: facultyId }, { userId: facultyId }]
        }
      });
      if (!faculty) {
        return res.status(400).json({ message: 'Assigned faculty member not found.' });
      }
      mappedFacultyId = faculty.id;
    }

    const dept = (req.user && req.user.department) 
      ? req.user.department 
      : 'Computer Science & Engineering';

    const targetYear = year || deriveYearFromSemester(semester);
    const targetSection = section ? section.trim().toUpperCase() : 'A';

    const newSubject = await Subject.create({
      code,
      name,
      credits: parseInt(credits, 10),
      semester,
      year: targetYear,
      section: targetSection,
      department: dept,
      facultyId: mappedFacultyId
    });

    console.log('[DEBUG POST /api/subjects] Subject created successfully in MySQL:', newSubject.toJSON());

    return res.status(201).json({
      message: 'Subject created successfully.',
      id: newSubject.id,
      subject: newSubject
    });
  } catch (error) {
    console.error('[Subjects Controller createSubject Error]:', error);
    return res.status(500).json({ message: 'Internal server error creating subject: ' + error.message });
  }
};

// Update Subject with strict department ownership check
exports.updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, credits, semester, year, section, facultyId } = req.body;

    const subject = await Subject.findByPk(id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    if ((req.user.role === 'admin' || req.user.role === 'hod') && req.user.department) {
      if (!isDepartmentMatch(subject.department, req.user.department)) {
        return res.status(403).json({ message: 'Access denied: subject belongs to another department.' });
      }
    }

    if (code && code !== subject.code) {
      const codeExists = await Subject.findOne({ where: { code } });
      if (codeExists) {
        return res.status(400).json({ message: 'Subject code already exists.' });
      }
      subject.code = code;
    }

    if (facultyId) {
      const faculty = await Faculty.findOne({
        where: {
          [Op.or]: [{ id: facultyId }, { userId: facultyId }]
        }
      });
      if (!faculty) {
        return res.status(400).json({ message: 'Assigned faculty member not found.' });
      }
      subject.facultyId = faculty.id;
    } else if (facultyId === null || facultyId === '' || facultyId === 0) {
      subject.facultyId = null;
    }

    subject.name = name || subject.name;
    subject.credits = credits !== undefined ? parseInt(credits, 10) : subject.credits;
    subject.semester = semester || subject.semester;
    if (year) subject.year = year;
    else if (semester) subject.year = deriveYearFromSemester(semester);
    if (section) subject.section = section;
    if (req.user && req.user.department) {
      subject.department = req.user.department;
    }
    
    await subject.save();

    return res.status(200).json({
      message: 'Subject updated successfully.',
      subject
    });
  } catch (error) {
    console.error('[Subjects Controller updateSubject Error]:', error);
    return res.status(500).json({ message: 'Internal server error updating subject: ' + error.message });
  }
};

// Delete Subject with strict department ownership check
exports.deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findByPk(id);

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    if ((req.user.role === 'admin' || req.user.role === 'hod') && req.user.department) {
      if (subject.department !== req.user.department) {
        return res.status(403).json({ message: 'Access denied: subject belongs to another department.' });
      }
    }

    await subject.destroy();
    return res.status(200).json({ message: 'Subject deleted successfully.' });
  } catch (error) {
    console.error('[Subjects Controller deleteSubject Error]:', error);
    return res.status(500).json({ message: 'Internal server error deleting subject.' });
  }
};
