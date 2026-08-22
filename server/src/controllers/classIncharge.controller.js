const { ClassIncharge, Faculty, Student, User } = require('../models');
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

function isSemesterMatch(semA, semB) {
  if (!semA || !semB) return false;
  const numA = getSemNum(semA);
  const numB = getSemNum(semB);
  if (numA > 0 && numB > 0) return numA === numB;
  return String(semA).trim().toLowerCase() === String(semB).trim().toLowerCase();
}

function isYearMatch(yrA, yrB) {
  if (!yrA || !yrB) return false;
  const numA = getYearNum(yrA);
  const numB = getYearNum(yrB);
  if (numA > 0 && numB > 0) return numA === numB;
  return String(yrA).trim().toLowerCase() === String(yrB).trim().toLowerCase();
}

function isSectionMatch(secA, secB) {
  if (!secA || !secB) return false;
  return String(secA).trim().toUpperCase() === String(secB).trim().toUpperCase();
}

function isDepartmentMatch(deptA, deptB) {
  if (!deptA || !deptB) return false;
  const cleanA = String(deptA).trim().toLowerCase();
  const cleanB = String(deptB).trim().toLowerCase();
  if (cleanA === cleanB) return true;
  if (cleanA.replace(/[^a-z0-9]/g, '') === cleanB.replace(/[^a-z0-9]/g, '')) return true;
  return false;
}

// Get all Class Incharge assignments (HOD/Admin) - Scoped by Department
exports.getAllClassIncharges = async (req, res) => {
  try {
    const whereClause = {};
    if ((req.user.role === 'admin' || req.user.role === 'hod') && req.user.department) {
      whereClause.department = req.user.department;
    }

    const list = await ClassIncharge.findAll({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      include: [{
        model: Faculty,
        as: 'faculty',
        attributes: ['id', 'name', 'employeeId', 'designation', 'photoPath']
      }],
      order: [['year', 'ASC'], ['semester', 'ASC'], ['section', 'ASC']]
    });

    return res.status(200).json(list);
  } catch (error) {
    console.error('[ClassIncharge Controller getAll Error]:', error);
    return res.status(500).json({ message: 'Internal server error loading class incharge list.' });
  }
};

// Assign or Reassign Class Incharge for a class (HOD/Admin only)
exports.assignClassIncharge = async (req, res) => {
  try {
    const { year, semester, section, facultyId, department } = req.body;

    if (!year || !semester || !section || !facultyId) {
      return res.status(400).json({ message: 'Year, semester, section, and facultyId are required.' });
    }

    const dept = req.user.department || department || 'Computer Science & Engineering';

    const faculty = await Faculty.findOne({
      where: {
        [Op.or]: [
          { id: parseInt(facultyId) },
          { userId: parseInt(facultyId) }
        ]
      }
    });

    if (!faculty) {
      return res.status(404).json({ message: 'Selected faculty member not found.' });
    }

    // Find and remove any existing/stale/orphan assignments matching this exact class
    const allAssignments = await ClassIncharge.findAll();
    const existing = allAssignments.filter(c => 
      isDepartmentMatch(c.department, dept) &&
      isYearMatch(c.year, year) &&
      isSemesterMatch(c.semester, semester) &&
      isSectionMatch(c.section, section)
    );

    for (const item of existing) {
      await item.destroy();
    }

    const assignment = await ClassIncharge.create({
      department: dept.trim(),
      year: String(year).trim(),
      semester: String(semester).trim(),
      section: String(section).trim().toUpperCase(),
      facultyId: faculty.id
    });

    const updated = await ClassIncharge.findByPk(assignment.id, {
      include: [{ model: Faculty, as: 'faculty', attributes: ['id', 'name', 'employeeId'] }]
    });

    const socketManager = req.app.get('socketManager');
    if (socketManager) {
      socketManager.broadcastToAll('CLASS_INCHARGE_ASSIGNED', {
        year, semester, section, department: dept,
        facultyName: faculty.name,
        facultyId: faculty.id
      });
    }

    return res.status(200).json({
      message: `Class Incharge for ${year} (Sem ${semester} - Sec ${section}) assigned successfully to ${faculty.name}.`,
      assignment: updated
    });

  } catch (error) {
    console.error('[ClassIncharge Controller assign Error]:', error);
    return res.status(500).json({ message: 'Internal server error assigning class incharge.' });
  }
};

// Remove Class Incharge for a class (HOD/Admin only)
exports.removeClassIncharge = async (req, res) => {
  try {
    const { year, semester, section, department } = req.body;

    if (!year || !semester || !section) {
      return res.status(400).json({ message: 'Year, semester, and section are required.' });
    }

    const dept = req.user.department || department || 'Computer Science & Engineering';

    const allAssignments = await ClassIncharge.findAll();
    const existing = allAssignments.filter(c => 
      isDepartmentMatch(c.department, dept) &&
      isYearMatch(c.year, year) &&
      isSemesterMatch(c.semester, semester) &&
      isSectionMatch(c.section, section)
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: 'No Class Incharge is currently assigned to this class.' });
    }

    for (const item of existing) {
      await item.destroy();
    }

    return res.status(200).json({
      message: `Class Incharge for ${year} (Sem ${semester} - Sec ${section}) removed successfully. Attendance entry is now disabled until reassigned.`
    });

  } catch (error) {
    console.error('[ClassIncharge Controller remove Error]:', error);
    return res.status(500).json({ message: 'Internal server error removing class incharge.' });
  }
};

// Get assigned classes for logged-in faculty member
exports.getMyClassAssignments = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ where: { userId: req.user.id } });
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty profile not found.' });
    }

    const assignments = await ClassIncharge.findAll({
      where: { facultyId: faculty.id }
    });

    return res.status(200).json(assignments);
  } catch (error) {
    console.error('[ClassIncharge Controller getMyAssignments Error]:', error);
    return res.status(500).json({ message: 'Internal server error loading class assignments.' });
  }
};
