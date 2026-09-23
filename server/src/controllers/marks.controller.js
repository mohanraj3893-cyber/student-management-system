const { User, Student, Subject, InternalMark, Faculty, sequelize } = require('../models');
const { Op } = require('sequelize');

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

exports.getRosterForFaculty = async (req, res) => {
  try {
    const { subjectId, examType } = req.query;

    if (!subjectId || !examType) {
      return res.status(400).json({ message: 'Subject ID and Exam Type are required.' });
    }

    const faculty = await Faculty.findOne({ where: { userId: req.user.id } });
    if (!faculty) {
      return res.status(403).json({ message: 'Access denied. Faculty profile not found.' });
    }

    const subject = await Subject.findOne({ where: { id: subjectId, facultyId: faculty.id } });
    if (!subject) {
      return res.status(403).json({ message: 'Access denied. You are not the assigned faculty for this subject.' });
    }

    const semVariants = getSemVariants(subject.semester);
    const roster = await Student.findAll({
      where: {
        department: subject.department || faculty.department || 'Computer Science & Engineering',
        semester: { [Op.in]: semVariants }
      },
      order: [['registerNumber', 'ASC']]
    });

    const existingMarks = await InternalMark.findAll({
      where: { subjectId, examType }
    });

    const marksMap = {};
    existingMarks.forEach(m => {
      marksMap[m.studentId] = m;
    });

    const studentList = roster.map(s => {
      const markRecord = marksMap[s.id];
      return {
        id: s.id,
        registerNumber: s.registerNumber,
        name: s.name,
        marksObtained: markRecord ? markRecord.marksObtained : null,
        maxMarks: markRecord ? markRecord.maxMarks : 100
      };
    });

    return res.status(200).json({
      subjectId: subject.id,
      subjectCode: subject.code,
      subjectName: subject.name,
      students: studentList
    });

  } catch (error) {
    console.error('[Marks Controller getRosterForFaculty Error]:', error);
    return res.status(500).json({ message: 'Internal server error loading marks roster.' });
  }
};

exports.saveMarks = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { subjectId, examType, records } = req.body;

    if (!subjectId || !examType || !Array.isArray(records)) {
      await t.rollback();
      return res.status(400).json({ message: 'Subject ID, Exam Type, and records array are required.' });
    }

    const faculty = await Faculty.findOne({ where: { userId: req.user.id }, transaction: t });
    if (!faculty) {
      await t.rollback();
      return res.status(403).json({ message: 'Access denied. Faculty profile not found.' });
    }

    const subject = await Subject.findOne({ where: { id: subjectId, facultyId: faculty.id }, transaction: t });
    if (!subject) {
      await t.rollback();
      return res.status(403).json({ message: 'Access denied. You are not the assigned faculty for this subject.' });
    }

    for (const rec of records) {
      const { studentId, marksObtained, maxMarks } = rec;

      if (studentId === undefined || studentId === null) continue;

      const student = await Student.findByPk(studentId, { transaction: t });
      if (!student) continue;

      if (marksObtained === null || marksObtained === undefined || String(marksObtained).trim() === '') {
        await InternalMark.destroy({
          where: { studentId, subjectId: parseInt(subjectId), examType },
          transaction: t
        });
        continue;
      }

      const numMarks = parseFloat(marksObtained);
      if (isNaN(numMarks)) continue;

      const [mark, created] = await InternalMark.findOrCreate({
        where: { studentId, subjectId: parseInt(subjectId), examType },
        defaults: { marksObtained: numMarks, maxMarks: maxMarks || 100 },
        transaction: t
      });

      if (!created) {
        mark.marksObtained = numMarks;
        if (maxMarks) mark.maxMarks = maxMarks;
        await mark.save({ transaction: t });
      }
    }

    await t.commit();

    const io = req.app.get('io');
    if (io) {
      io.emit('marksUpdated', { subjectId, examType });
    }

    return res.status(200).json({ message: 'Internal marks saved successfully in database.' });

  } catch (error) {
    await t.rollback();
    console.error('[Marks Controller saveMarks Error]:', error);
    return res.status(500).json({ message: 'Internal server error saving marks.' });
  }
};

exports.getStudentGrades = async (req, res) => {
  try {
    const student = await Student.findOne({
      where: { userId: req.user.id }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    const semVariants = getSemVariants(student.semester);
    const subjects = await Subject.findAll({
      where: {
        department: student.department || 'Computer Science & Engineering',
        semester: { [Op.in]: semVariants }
      },
      include: [{ model: Faculty, as: 'faculty' }],
      order: [['code', 'ASC']]
    });

    const existingMarks = await InternalMark.findAll({
      where: { studentId: student.id }
    });

    const marksMap = {};
    existingMarks.forEach(m => {
      const key = `${m.subjectId}_${m.examType.trim().toUpperCase()}`;
      marksMap[key] = m;
    });

    const examTypes = ['IA-1', 'IA-2', 'Model Exam'];
    const responseList = [];

    subjects.forEach(sub => {
      examTypes.forEach(exam => {
        let markRec = null;
        for (const [k, v] of Object.entries(marksMap)) {
          const [sId, eType] = k.split('_');
          if (parseInt(sId) === sub.id) {
            if (
              (exam === 'IA-1' && (eType.includes('IA1') || eType.includes('IA-1') || eType.includes('IA-I') || eType.includes('IA 1'))) ||
              (exam === 'IA-2' && (eType.includes('IA2') || eType.includes('IA-2') || eType.includes('IA-II') || eType.includes('IA 2'))) ||
              (exam === 'Model Exam' && (eType.includes('MODEL')))
            ) {
              markRec = v;
              break;
            }
          }
        }

        if (markRec) {
          const pct = ((markRec.marksObtained / markRec.maxMarks) * 100).toFixed(1);
          responseList.push({
            id: markRec.id,
            subjectId: sub.id,
            subjectCode: sub.code,
            subjectName: sub.name,
            facultyName: sub.faculty ? sub.faculty.name : 'Unassigned',
            examType: exam,
            marksObtained: markRec.marksObtained,
            maxMarks: markRec.maxMarks,
            percentage: `${pct}%`,
            isPass: markRec.marksObtained >= (markRec.maxMarks * 0.5),
            isUpdated: true,
            statusText: 'Published'
          });
        } else {
          responseList.push({
            id: null,
            subjectId: sub.id,
            subjectCode: sub.code,
            subjectName: sub.name,
            facultyName: sub.faculty ? sub.faculty.name : 'Unassigned',
            examType: exam,
            marksObtained: null,
            maxMarks: 100,
            percentage: null,
            isPass: null,
            isUpdated: false,
            statusText: 'Marks Not Updated'
          });
        }
      });
    });

    return res.status(200).json(responseList);

  } catch (error) {
    console.error('[Marks Controller getStudentGrades Error]:', error);
    return res.status(500).json({ message: 'Internal server error loading student grades.' });
  }
};

// HOD: load department-wide marks logs & audit reports scoped by HOD department
exports.getDepartmentMarksLogs = async (req, res) => {
  try {
    const studentWhere = {};
    if ((req.user.role === 'admin' || req.user.role === 'hod') && req.user.department) {
      studentWhere.department = req.user.department;
    }

    const logs = await InternalMark.findAll({
      include: [
        { model: Student, as: 'student', where: Object.keys(studentWhere).length > 0 ? studentWhere : undefined },
        {
          model: Subject,
          as: 'subject',
          include: [{ model: Faculty, as: 'faculty' }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const parsedLogs = logs.map(m => ({
      id: m.id,
      studentName: m.student ? m.student.name : 'Unknown Student',
      registerNumber: m.student ? m.student.registerNumber : 'Unknown',
      subjectCode: m.subject ? m.subject.code : 'Unknown',
      subjectName: m.subject ? m.subject.name : 'Unknown',
      facultyName: m.subject && m.subject.faculty ? m.subject.faculty.name : 'Unassigned',
      examType: m.examType,
      marksObtained: m.marksObtained,
      maxMarks: m.maxMarks
    }));

    return res.status(200).json(parsedLogs);

  } catch (error) {
    console.error('[Marks Controller getDepartmentMarksLogs Error]:', error);
    return res.status(500).json({ message: 'Internal server error loading departmental marks reports.' });
  }
};
