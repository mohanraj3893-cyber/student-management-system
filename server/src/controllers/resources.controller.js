const { Resource, Subject, Faculty, Student, User } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

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

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

exports.uploadResource = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File is required.' });
    }

    const { subjectId, title, category } = req.body;

    if (!subjectId) {
      return res.status(400).json({ message: 'Assigned subject selection is required.' });
    }

    const faculty = await Faculty.findOne({ where: { userId: req.user.id } });
    if (!faculty) {
      return res.status(403).json({ message: 'Access denied. Faculty profile not found.' });
    }

    const subject = await Subject.findOne({
      where: {
        id: parseInt(subjectId),
        [Op.or]: [{ facultyId: faculty.id }, { facultyId: faculty.userId }]
      }
    });

    if (!subject) {
      return res.status(403).json({ message: 'Access denied. You can only upload materials for your assigned subjects.' });
    }

    const fileSizeStr = formatBytes(req.file.size);
    const relativePath = `/uploads/resources/${req.file.filename}`;

    const resource = await Resource.create({
      title: title && title.trim() !== '' ? title.trim() : req.file.originalname,
      category: category && category.trim() !== '' ? category.trim() : 'Lecture Notes',
      subjectId: subject.id,
      facultyId: faculty.id,
      fileName: req.file.originalname,
      filePath: relativePath,
      fileSize: fileSizeStr
    });

    return res.status(201).json({
      message: 'Course material uploaded successfully.',
      resource: {
        id: resource.id,
        title: resource.title,
        category: resource.category,
        subjectCode: subject.code,
        subjectName: subject.name,
        fileName: resource.fileName,
        filePath: resource.filePath,
        fileSize: resource.fileSize,
        createdAt: resource.createdAt
      }
    });

  } catch (error) {
    console.error('[Resources Controller uploadResource Error]:', error);
    return res.status(500).json({ message: 'Internal server error uploading course material.' });
  }
};

exports.getFacultyResources = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ where: { userId: req.user.id } });
    if (!faculty) {
      return res.status(403).json({ message: 'Access denied. Faculty profile not found.' });
    }

    const resources = await Resource.findAll({
      where: { facultyId: faculty.id },
      include: [{ model: Subject, as: 'subject' }],
      order: [['created_at', 'DESC']]
    });

    const formatted = resources.map(r => ({
      id: r.id,
      title: r.title,
      category: r.category,
      subjectCode: r.subject ? r.subject.code : 'N/A',
      subjectName: r.subject ? r.subject.name : 'N/A',
      fileName: r.fileName,
      filePath: r.filePath,
      fileSize: r.fileSize,
      createdAt: r.createdAt
    }));

    return res.status(200).json(formatted);

  } catch (error) {
    console.error('[Resources Controller getFacultyResources Error]:', error);
    return res.status(500).json({ message: 'Internal server error loading faculty resources.' });
  }
};

exports.getStudentResources = async (req, res) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    const allDeptSubjects = await Subject.findAll({
      where: {
        department: student.department || 'Computer Science & Engineering'
      },
      include: [
        { model: Faculty, as: 'faculty' },
        { model: Resource, as: 'resources' }
      ],
      order: [['code', 'ASC']]
    });

    const subjects = allDeptSubjects.filter(sub => 
      isDepartmentMatch(sub.department, student.department) &&
      isYearMatch(sub.year, student.year, sub.semester, student.semester) &&
      isSemesterMatch(sub.semester, student.semester) &&
      isSectionMatch(sub.section, student.section)
    );

    const result = subjects.map(sub => {
      const materials = (sub.resources || []).map(r => ({
        id: r.id,
        title: r.title,
        category: r.category,
        fileName: r.fileName,
        filePath: r.filePath,
        fileSize: r.fileSize,
        createdAt: r.createdAt
      }));

      return {
        subjectId: sub.id,
        subjectCode: sub.code,
        subjectName: sub.name,
        credits: sub.credits,
        facultyName: sub.faculty ? sub.faculty.name : 'Unassigned',
        resources: materials
      };
    });

    return res.status(200).json(result);

  } catch (error) {
    console.error('[Resources Controller getStudentResources Error]:', error);
    return res.status(500).json({ message: 'Internal server error loading student course materials.' });
  }
};

exports.deleteResource = async (req, res) => {
  try {
    const { id } = req.params;
    const faculty = await Faculty.findOne({ where: { userId: req.user.id } });
    if (!faculty) {
      return res.status(403).json({ message: 'Access denied. Faculty profile not found.' });
    }

    const resource = await Resource.findByPk(id);
    if (!resource) {
      return res.status(404).json({ message: 'Course material not found.' });
    }

    if (resource.facultyId !== faculty.id) {
      return res.status(403).json({ message: 'Access denied. You can only delete your own uploaded materials.' });
    }

    const diskPath = path.join(__dirname, '../../', resource.filePath);
    if (fs.existsSync(diskPath)) {
      try {
        fs.unlinkSync(diskPath);
      } catch (e) {
        console.error('File delete warning:', e);
      }
    }

    await resource.destroy();
    return res.status(200).json({ message: 'Course material deleted successfully.' });

  } catch (error) {
    console.error('[Resources Controller deleteResource Error]:', error);
    return res.status(500).json({ message: 'Internal server error deleting resource.' });
  }
};
