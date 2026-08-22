const { User, Student, Subject, InternalMark, Faculty, sequelize } = require('../models');
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
  if (!deptA || !deptB) return true;
  const cleanA = String(deptA).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanB = String(deptB).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cleanA === cleanB) return true;

  const isCseA = cleanA.includes('cse') || cleanA.includes('computerscience');
  const isCseB = cleanB.includes('cse') || cleanB.includes('computerscience');
  if (isCseA && isCseB) return true;

  const isItA = cleanA.includes('it') || cleanA.includes('informationtechnology');
  const isItB = cleanB.includes('it') || cleanB.includes('informationtechnology');
  if (isItA && isItB) return true;

  const isEceA = cleanA.includes('ece') || cleanA.includes('electronics');
  const isEceB = cleanB.includes('ece') || cleanB.includes('electronics');
  if (isEceA && isEceB) return true;

  const isEeeA = cleanA.includes('eee') || cleanA.includes('electrical');
  const isEeeB = cleanB.includes('eee') || cleanB.includes('electrical');
  if (isEeeA && isEeeB) return true;

  const isAidsA = cleanA.includes('aids') || cleanA.includes('artificialintelligence');
  const isAidsB = cleanB.includes('aids') || cleanB.includes('artificialintelligence');
  if (isAidsA && isAidsB) return true;

  return false;
}

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

    const subject = await Subject.findOne({
      where: {
        id: subjectId,
        [Op.or]: [{ facultyId: faculty.id }, { facultyId: faculty.userId }]
      }
    });

    if (!subject) {
      return res.status(403).json({ message: 'Access denied. You are not the assigned faculty for this subject.' });
    }

    const allStudents = await Student.findAll({
      order: [['registerNumber', 'ASC']]
    });

    const roster = allStudents.filter(s => 
      isDepartmentMatch(s.department, subject.department) &&
      isYearMatch(s.year, subject.year, s.semester, subject.semester) &&
      isSemesterMatch(s.semester, subject.semester) &&
      isSectionMatch(s.section, subject.section)
    );

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

    const subject = await Subject.findOne({
      where: {
        id: subjectId,
        [Op.or]: [{ facultyId: faculty.id }, { facultyId: faculty.userId }]
      },
      transaction: t
    });

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

    const socketManager = req.app.get('socketManager');
    if (socketManager) {
      socketManager.broadcastToAll('MARKS_UPDATED', { subjectId, examType });
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

    console.log('[DEBUG GET /api/marks/my-marks] Authenticated student fetched from MySQL:', {
      department: student.department,
      year: student.year,
      semester: student.semester,
      section: student.section
    });

    console.log('[DEBUG GET /api/marks/my-marks] Executing assigned subjects lookup filter for class:', {
      department: student.department,
      year: student.year,
      semester: student.semester,
      section: student.section
    });

    // Step 1: Fetch all subjects in database to perform strict LEFT JOIN mapping
    const allSubjects = await Subject.findAll({
      include: [{ model: Faculty, as: 'faculty' }],
      order: [['code', 'ASC']]
    });

    // Filter subjects matching student's Department + Year + Semester + Section
    const assignedSubjects = allSubjects.filter(sub => 
      isDepartmentMatch(sub.department, student.department) &&
      isYearMatch(sub.year, student.year, sub.semester, student.semester) &&
      isSemesterMatch(sub.semester, student.semester) &&
      isSectionMatch(sub.section, student.section)
    );

    // Step 2: Fetch existing marks for this student (LEFT JOIN logic)
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

    assignedSubjects.forEach(sub => {
      let iat1Val = null;
      let iat2Val = null;
      let modelVal = null;

      // Extract scores per exam type for summary
      for (const [k, v] of Object.entries(marksMap)) {
        const [sId, eType] = k.split('_');
        if (parseInt(sId) === sub.id) {
          if (eType.includes('IA1') || eType.includes('IA-1') || eType.includes('IA-I') || eType.includes('IA 1')) {
            iat1Val = v.marksObtained;
          } else if (eType.includes('IA2') || eType.includes('IA-2') || eType.includes('IA-II') || eType.includes('IA 2')) {
            iat2Val = v.marksObtained;
          } else if (eType.includes('MODEL')) {
            modelVal = v.marksObtained;
          }
        }
      }

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
            statusText: 'Published',
            iat1: iat1Val,
            iat2: iat2Val,
            model: modelVal
          });
        } else {
          // LEFT JOIN placeholder for unposted exam marks
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
            statusText: 'Not Yet Updated',
            iat1: iat1Val,
            iat2: iat2Val,
            model: modelVal
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
