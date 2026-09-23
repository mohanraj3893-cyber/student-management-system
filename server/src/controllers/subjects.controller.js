const { Subject, Faculty } = require('../models');
const { Op } = require('sequelize');

exports.getFacultyMySubjects = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ where: { userId: req.user.id } });
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty profile not found.' });
    }

    const subjects = await Subject.findAll({
      where: {
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

// Create Subject
exports.createSubject = async (req, res) => {
  try {
    const { code, name, credits, semester, facultyId } = req.body;

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

    const dept = req.user.department || 'Computer Science & Engineering';

    const newSubject = await Subject.create({
      code,
      name,
      credits,
      semester,
      department: dept,
      facultyId: mappedFacultyId
    });

    return res.status(201).json({ message: 'Subject created successfully.', id: newSubject.id });
  } catch (error) {
    console.error('[Subjects Controller createSubject Error]:', error);
    return res.status(500).json({ message: 'Internal server error creating subject.' });
  }
};

// Update Subject with department ownership check
exports.updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, credits, semester, facultyId } = req.body;

    const subject = await Subject.findByPk(id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    if ((req.user.role === 'admin' || req.user.role === 'hod') && req.user.department) {
      if (subject.department !== req.user.department) {
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
    subject.credits = credits !== undefined ? credits : subject.credits;
    subject.semester = semester || subject.semester;
    
    await subject.save();

    return res.status(200).json({ message: 'Subject updated successfully.' });
  } catch (error) {
    console.error('[Subjects Controller updateSubject Error]:', error);
    return res.status(500).json({ message: 'Internal server error updating subject.' });
  }
};

// Delete Subject with department ownership check
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
