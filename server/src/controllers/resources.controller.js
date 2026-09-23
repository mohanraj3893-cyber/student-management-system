const { Resource, Subject, Faculty, Student, User } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Helper to normalize semester variations (e.g. 'V', '5', 'V Semester')
const getSemVariants = (sem) => {
  if (!sem) return ['V', '5', 'V Semester'];
  const s = String(sem).trim().toUpperCase();
  if (s === '1' || s === 'I' || s.includes('I SEM')) return ['1', 'I', 'I Semester', 'Semester I', '1st Semester'];
  if (s === '2' || s === 'II' || s.includes('II SEM')) return ['2', 'II', 'II Semester', 'Semester II', '2nd Semester'];
  if (s === '3' || s === 'III' || s.includes('III SEM')) return ['3', 'III', 'III Semester', 'Semester III', '3rd Semester'];
  if (s === '4' || s === 'IV' || s.includes('IV SEM')) return ['4', 'IV', 'IV Semester', 'Semester IV', '4th Semester'];
  if (s === '5' || s === 'V' || s.includes('V SEM')) return ['5', 'V', 'V Semester', 'Semester V', '5th Semester'];
  if (s === '6' || s === 'VI' || s.includes('VI SEM')) return ['6', 'VI', 'VI Semester', 'Semester VI', '6th Semester'];
  if (s === '7' || s === 'VII' || s.includes('VII SEM')) return ['7', 'VII', 'VII Semester', 'Semester VII', '7th Semester'];
  if (s === '8' || s === 'VIII' || s.includes('VIII SEM')) return ['8', 'VIII', 'VIII Semester', 'Semester VIII', '8th Semester'];
  return [sem];
};

// Helper to format file size
const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Faculty: Upload new course material for assigned subject
exports.uploadResource = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File is required.' });
    }

    const { subjectId, title, category } = req.body;

    if (!subjectId) {
      return res.status(400).json({ message: 'Assigned subject selection is required.' });
    }

    // Resolve Faculty Profile
    const faculty = await Faculty.findOne({ where: { userId: req.user.id } });
    if (!faculty) {
      return res.status(403).json({ message: 'Access denied. Faculty profile not found.' });
    }

    // Verify Subject allocation strictly to this faculty
    const subject = await Subject.findOne({ where: { id: parseInt(subjectId), facultyId: faculty.id } });
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

// Faculty: Get resources uploaded by logged-in faculty member
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

// Student: Get course materials uploaded by faculty for student's semester
exports.getStudentResources = async (req, res) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    const semVariants = getSemVariants(student.semester);

    // Fetch subjects matching student's department & semester
    const subjects = await Subject.findAll({
      where: {
        department: student.department || 'Computer Science & Engineering',
        semester: { [Op.in]: semVariants }
      },
      include: [
        { model: Faculty, as: 'faculty' },
        { model: Resource, as: 'resources' }
      ],
      order: [['code', 'ASC']]
    });

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

// Faculty: Delete an uploaded course material
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

    // Try deleting physical file from disk
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
