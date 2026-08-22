const { LeaveRequest, Student, Faculty, ClassIncharge, User, Role, Notification, sequelize } = require('../models');
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

// STAGE 1: Student Submission
exports.applyLeave = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    // Read student's actual values directly from MySQL using req.user.id
    const student = await Student.findOne({ 
      where: { userId: req.user.id },
      transaction
    });

    if (!student) {
      await transaction.rollback();
      return res.status(403).json({ message: 'Access denied. Student profile not found.' });
    }

    const { leaveType, fromDate, toDate, reason, startDate, endDate, days } = req.body || {};

    const actualFromDate = fromDate || startDate;
    const actualToDate = toDate || endDate;

    if (!actualFromDate) {
      await transaction.rollback();
      return res.status(400).json({ message: 'From date is required.' });
    }
    if (!actualToDate) {
      await transaction.rollback();
      return res.status(400).json({ message: 'To date is required.' });
    }
    if (!reason || reason.trim() === '') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Reason for leave is required.' });
    }

    const start = new Date(actualFromDate);
    const end = new Date(actualToDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Invalid date formats provided.' });
    }

    if (start > end) {
      await transaction.rollback();
      return res.status(400).json({ message: 'From Date cannot be after To Date.' });
    }

    const diffTime = Math.abs(end - start);
    const calculatedDays = days ? Number(days) : (Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

    console.log(`[Leave Apply Debug] Student ID: ${student.id} (${student.name})`);
    console.log(`[Leave Apply Debug] Student MySQL Data -> Dept: "${student.department}", Year: "${student.year}", Sem: "${student.semester}", Sec: "${student.section}"`);

    // Fetch all active Class Incharge assignments with their associated Faculty & User
    const allIncharges = await ClassIncharge.findAll({
      include: [{
        model: Faculty,
        as: 'faculty',
        include: [{ model: User, as: 'user', where: { isApproved: true } }]
      }],
      transaction
    });

    const activeIncharges = allIncharges.filter(c => {
      if (!c.faculty || !c.faculty.user) return false;
      const dMatch = isDepartmentMatch(c.department, student.department);
      const yMatch = isYearMatch(c.year, student.year);
      const sMatch = isSemesterMatch(c.semester, student.semester);
      const secMatch = isSectionMatch(c.section, student.section);

      console.log(`   Comparing Incharge #${c.id} (Dept:"${c.department}", Yr:"${c.year}", Sem:"${c.semester}", Sec:"${c.section}") -> D:${dMatch}, Y:${yMatch}, S:${sMatch}, Sec:${secMatch}`);
      return dMatch && yMatch && sMatch && secMatch;
    });

    // ORPHAN PROTECTION: If no valid Class Incharge exists for this exact class, return HTTP 400
    if (activeIncharges.length === 0) {
      await transaction.rollback();
      console.log(`[Leave Apply Debug] ❌ Lookup Failed: No matching Class Incharge found for Dept:"${student.department}", Year:"${student.year}", Sem:"${student.semester}", Sec:"${student.section}"`);
      return res.status(400).json({ message: 'No Class Incharge has been assigned for this class.' });
    }

    const classIncharge = activeIncharges[0];
    const inchargeFaculty = classIncharge.faculty;
    const inchargeUser = inchargeFaculty.user;

    let supportingDocument = null;
    if (req.file) {
      supportingDocument = `/uploads/${req.file.filename}`;
    }

    // Create leave with status PENDING_CLASS_INCHARGE
    const leave = await LeaveRequest.create({
      studentId: student.id,
      leaveType: leaveType || 'Casual Leave',
      fromDate: actualFromDate,
      toDate: actualToDate,
      numberOfDays: calculatedDays,
      reason,
      supportingDocument,
      status: 'PENDING_CLASS_INCHARGE',
      submittedAt: new Date()
    }, { transaction });

    // Notify ONLY the assigned Class Incharge
    const notifMessage = `📝 New Leave Request: ${student.name} (${student.registerNumber}) applied for ${leave.leaveType} leave (${calculatedDays} days). Awaiting Class Incharge approval.`;

    await Notification.create({
      userId: inchargeUser.id,
      message: notifMessage,
      type: 'leave_request',
      relatedId: leave.id,
      isRead: false
    }, { transaction });

    await transaction.commit();

    const socketManager = req.app.get('socketManager');
    if (socketManager) {
      socketManager.emitToUser(inchargeUser.id, 'LEAVE_REQUEST_CREATED', {
        message: notifMessage,
        type: 'leave_request',
        relatedId: leave.id,
        studentName: student.name,
        leaveType: leave.leaveType,
        status: 'PENDING_CLASS_INCHARGE'
      });
    }

    const leaveJSON = leave.toJSON();
    leaveJSON.numberOfDays = calculatedDays;
    leaveJSON.days = calculatedDays;

    return res.status(201).json({
      message: 'Leave application submitted successfully. Awaiting Class Incharge approval.',
      leave: leaveJSON
    });

  } catch (error) {
    await transaction.rollback();
    console.error('[Leaves Controller applyLeave Error]:', error);
    return res.status(500).json({ message: error.message || 'Internal server error submitting leave.' });
  }
};

// 2. Student: Retrieve personal leave history
exports.getMyLeaveHistory = async (req, res) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) {
      return res.status(403).json({ message: 'Access denied. Student profile not found.' });
    }

    const requests = await LeaveRequest.findAll({
      where: { studentId: student.id },
      order: [['createdAt', 'DESC']]
    });

    const formattedRequests = requests.map(r => {
      const json = r.toJSON();
      let numDays = json.numberOfDays || json.days;
      if (!numDays && json.fromDate && json.toDate) {
        const start = new Date(json.fromDate);
        const end = new Date(json.toDate);
        numDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
      }
      json.numberOfDays = Number(numDays) || 1;
      json.days = json.numberOfDays;
      return json;
    });

    return res.status(200).json(formattedRequests);
  } catch (error) {
    console.error('[Leaves Controller getMyLeaveHistory Error]:', error);
    return res.status(500).json({ message: 'Internal server error fetching leave history.' });
  }
};

// 3. Common: Retrieve details of a single leave request
exports.getLeaveDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const leave = await LeaveRequest.findByPk(id, {
      include: [{ model: Student, as: 'student' }]
    });

    if (!leave || !leave.student) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    if (req.user.role === 'student') {
      const student = await Student.findOne({ where: { userId: req.user.id } });
      if (!student || leave.studentId !== student.id) {
        return res.status(403).json({ message: 'Access denied: you cannot view another student\'s request.' });
      }
    } else if (req.user.role === 'faculty') {
      const faculty = await Faculty.findOne({ where: { userId: req.user.id } });
      if (!faculty || !isDepartmentMatch(faculty.department, leave.student.department)) {
        return res.status(403).json({ message: 'Access denied: leave request belongs to another department.' });
      }
    } else if ((req.user.role === 'admin' || req.user.role === 'hod') && req.user.department) {
      if (!isDepartmentMatch(leave.student.department, req.user.department)) {
        return res.status(403).json({ message: 'Access denied: leave request belongs to another department.' });
      }
    }

    const jsonLeave = leave.toJSON();
    let numDays = jsonLeave.numberOfDays || jsonLeave.days;
    if (!numDays && jsonLeave.fromDate && jsonLeave.toDate) {
      const start = new Date(jsonLeave.fromDate);
      const end = new Date(jsonLeave.toDate);
      numDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
    }
    jsonLeave.numberOfDays = Number(numDays) || 1;
    jsonLeave.days = jsonLeave.numberOfDays;

    return res.status(200).json(jsonLeave);
  } catch (error) {
    console.error('[Leaves Controller getLeaveDetails Error]:', error);
    return res.status(500).json({ message: 'Internal server error retrieving leave details.' });
  }
};

// 4. Student: Cancel/delete pending request
exports.deleteLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findOne({ where: { userId: req.user.id } });

    if (!student) {
      return res.status(403).json({ message: 'Access denied. Student profile not found.' });
    }

    const leave = await LeaveRequest.findByPk(id);
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    if (leave.studentId !== student.id) {
      return res.status(403).json({ message: 'Access denied: you cannot delete another student\'s request.' });
    }

    if (leave.status !== 'PENDING_CLASS_INCHARGE' && leave.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending leave requests awaiting Class Incharge review can be cancelled.' });
    }

    await leave.destroy();
    return res.status(200).json({ message: 'Leave request cancelled and removed successfully.' });

  } catch (error) {
    console.error('[Leaves Controller deleteLeaveRequest Error]:', error);
    return res.status(500).json({ message: 'Internal server error cancelling leave request.' });
  }
};

// 5. Faculty / HOD: Retrieve leave requests matching stage & department authorization rules
exports.getLeaveRequests = async (req, res) => {
  try {
    const { studentName, registerNumber, leaveType, status, fromDate, toDate } = req.query;
    const userRole = String(req.user.role || '').toLowerCase();

    // A. FACULTY ROLE LOGIC (Class Incharge Stage 1: PENDING_CLASS_INCHARGE)
    if (userRole === 'faculty') {
      const faculty = await Faculty.findOne({ where: { userId: req.user.id } });
      if (!faculty) {
        return res.status(403).json({ message: 'Faculty profile not found.' });
      }

      // Check if Faculty is currently assigned as Class Incharge in MySQL
      const inchargeClasses = await ClassIncharge.findAll({ 
        where: {
          [Op.or]: [{ facultyId: faculty.id }, { facultyId: req.user.id }]
        }
      });

      // If Faculty is NOT a Class Incharge: Completely hide leave requests (Return empty list)
      if (inchargeClasses.length === 0) {
        return res.status(200).json({
          stats: { total: 0, pending: 0, approved: 0, rejected: 0 },
          pending: [],
          history: [],
          requests: []
        });
      }

      // Filter students belonging ONLY to Faculty's currently assigned class (department, year, semester, section)
      const allStudents = await Student.findAll();
      const inchargeStudents = allStudents.filter(s => 
        inchargeClasses.some(c => 
          isDepartmentMatch(c.department, s.department) && 
          isYearMatch(c.year, s.year) && 
          isSemesterMatch(c.semester, s.semester) && 
          isSectionMatch(c.section, s.section)
        )
      );

      const studentIds = inchargeStudents.map(s => s.id);
      if (studentIds.length === 0) {
        return res.status(200).json({
          stats: { total: 0, pending: 0, approved: 0, rejected: 0 },
          pending: [],
          history: [],
          requests: []
        });
      }

      const leaveWhere = { studentId: { [Op.in]: studentIds } };
      if (leaveType) leaveWhere.leaveType = leaveType;
      if (fromDate) leaveWhere.fromDate = { [Op.gte]: fromDate };
      if (toDate) leaveWhere.toDate = { [Op.lte]: toDate };

      const studentWhere = {};
      if (studentName) studentWhere.name = { [Op.like]: `%${studentName}%` };
      if (registerNumber) studentWhere.registerNumber = { [Op.like]: `%${registerNumber}%` };

      const allClassLeaves = await LeaveRequest.findAll({
        where: leaveWhere,
        include: [{
          model: Student,
          as: 'student',
          where: Object.keys(studentWhere).length > 0 ? studentWhere : undefined
        }],
        order: [['createdAt', 'DESC']]
      });

      const formatLeave = (r) => {
        const s = r.student || {};
        const fDate = r.fromDate ? String(r.fromDate) : '';
        const tDate = r.toDate ? String(r.toDate) : '';
        let numDays = r.numberOfDays || r.days;
        if (!numDays && fDate && tDate) {
          numDays = Math.max(1, Math.ceil((new Date(tDate) - new Date(fDate)) / (1000 * 60 * 60 * 24)) + 1);
        }
        numDays = Number(numDays) || 1;
        return {
          id: r.id,
          studentId: r.studentId,
          studentName: s.name || 'Student',
          registerNumber: s.registerNumber || '-',
          photoPath: s.photoPath || null,
          leaveType: r.leaveType,
          fromDate: fDate,
          toDate: tDate,
          startDate: fDate,
          endDate: tDate,
          numberOfDays: numDays,
          days: numDays,
          reason: r.reason,
          status: r.status,
          rejectionReason: r.rejectionReason || r.hodRemarks || null,
          hodRemarks: r.hodRemarks || null,
          createdAt: r.createdAt,
          submittedAt: r.submittedAt || r.createdAt,
          supportingDocument: r.supportingDocument || null,
          student: s
        };
      };

      const pending = allClassLeaves.filter(r => r.status === 'PENDING_CLASS_INCHARGE' || r.status === 'Pending').map(formatLeave);
      const history = allClassLeaves.filter(r => r.status !== 'PENDING_CLASS_INCHARGE' && r.status !== 'Pending').map(formatLeave);
      const formattedRequests = allClassLeaves.map(formatLeave);

      const stats = {
        total: allClassLeaves.length,
        pending: pending.length,
        approved: allClassLeaves.filter(r => r.status === 'PENDING_HOD' || r.status === 'APPROVED' || r.status === 'Approved').length,
        rejected: allClassLeaves.filter(r => r.status === 'REJECTED_BY_CLASS_INCHARGE' || r.status === 'REJECTED_BY_HOD' || r.status === 'Rejected').length
      };

      return res.status(200).json({ stats, pending, history, requests: formattedRequests });
    }

    // B. HOD / ADMIN ROLE LOGIC (Stage 2: PENDING_HOD) - Scoped strictly by req.user.department
    const dept = req.user.department || 'Computer Science & Engineering';

    const leaveWhere = {};
    if (leaveType) leaveWhere.leaveType = leaveType;
    if (status) {
      leaveWhere.status = status;
    }

    if (fromDate && toDate) {
      leaveWhere.fromDate = { [Op.gte]: fromDate };
      leaveWhere.toDate = { [Op.lte]: toDate };
    } else if (fromDate) {
      leaveWhere.fromDate = { [Op.gte]: fromDate };
    } else if (toDate) {
      leaveWhere.toDate = { [Op.lte]: toDate };
    }

    const studentWhere = { department: dept };
    if (studentName) studentWhere.name = { [Op.like]: `%${studentName}%` };
    if (registerNumber) studentWhere.registerNumber = { [Op.like]: `%${registerNumber}%` };

    const rawRequests = await LeaveRequest.findAll({
      where: leaveWhere,
      include: [{ 
        model: Student, 
        as: 'student',
        where: studentWhere
      }],
      order: [['createdAt', 'DESC']]
    });

    const formatLeave = (r) => {
      const s = r.student || {};
      const fDate = r.fromDate ? String(r.fromDate) : '';
      const tDate = r.toDate ? String(r.toDate) : '';
      let numDays = r.numberOfDays || r.days;
      if (!numDays && fDate && tDate) {
        numDays = Math.max(1, Math.ceil((new Date(tDate) - new Date(fDate)) / (1000 * 60 * 60 * 24)) + 1);
      }
      numDays = Number(numDays) || 1;
      return {
        id: r.id,
        studentId: r.studentId,
        studentName: s.name || 'Student',
        registerNumber: s.registerNumber || '-',
        photoPath: s.photoPath || null,
        leaveType: r.leaveType,
        fromDate: fDate,
        toDate: tDate,
        startDate: fDate,
        endDate: tDate,
        numberOfDays: numDays,
        days: numDays,
        reason: r.reason,
        status: r.status,
        rejectionReason: r.rejectionReason || r.hodRemarks || null,
        hodRemarks: r.hodRemarks || null,
        createdAt: r.createdAt,
        submittedAt: r.submittedAt || r.createdAt,
        supportingDocument: r.supportingDocument || null,
        student: s
      };
    };

    const formattedRequests = rawRequests.map(formatLeave);

    const allDeptLeaves = await LeaveRequest.findAll({
      include: [{ model: Student, as: 'student', where: { department: dept } }]
    });

    const pending = formattedRequests.filter(r => r.status === 'PENDING_HOD');
    const history = formattedRequests.filter(r => r.status !== 'PENDING_HOD');

    const stats = {
      total: allDeptLeaves.length,
      pending: allDeptLeaves.filter(r => r.status === 'PENDING_HOD').length,
      approved: allDeptLeaves.filter(r => r.status === 'APPROVED' || r.status === 'Approved').length,
      rejected: allDeptLeaves.filter(r => r.status === 'REJECTED_BY_HOD' || r.status === 'REJECTED_BY_CLASS_INCHARGE' || r.status === 'Rejected').length
    };

    return res.status(200).json({ stats, pending, history, requests: formattedRequests });

  } catch (error) {
    console.error('[Leaves Controller getLeaveRequests Error]:', error);
    return res.status(500).json({ message: 'Internal server error retrieving leave requests.' });
  }
};

// 6. Stage Approval Handler (Class Incharge -> PENDING_HOD, HOD -> APPROVED)
exports.approveLeave = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { hodRemarks } = req.body || {};
    const userRole = String(req.user.role || '').toLowerCase();

    const leave = await LeaveRequest.findByPk(id, {
      include: [{ model: Student, as: 'student' }],
      transaction
    });

    if (!leave || !leave.student) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    // TERMINAL STATE PROTECTION: Immutable terminal states cannot be re-approved
    if (leave.status === 'APPROVED' || leave.status === 'REJECTED_BY_CLASS_INCHARGE' || leave.status === 'REJECTED_BY_HOD') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Terminal state leave requests cannot be re-processed.' });
    }

    // A. STAGE 1: CLASS INCHARGE APPROVAL (PENDING_CLASS_INCHARGE -> PENDING_HOD)
    if (userRole === 'faculty') {
      const faculty = await Faculty.findOne({ where: { userId: req.user.id }, transaction });
      if (!faculty) {
        await transaction.rollback();
        return res.status(403).json({ message: 'Faculty profile not found.' });
      }

      // Verify Faculty Department equals Student Department
      if (!isDepartmentMatch(faculty.department, leave.student.department)) {
        await transaction.rollback();
        return res.status(403).json({ message: 'Access denied: Faculty department does not match student department.' });
      }

      // Verify Faculty is currently assigned as Class Incharge for student's exact class
      const inchargeClasses = await ClassIncharge.findAll({ 
        where: {
          [Op.or]: [{ facultyId: faculty.id }, { facultyId: req.user.id }]
        },
        transaction 
      });
      const isAssigned = inchargeClasses.some(c => 
        isDepartmentMatch(c.department, leave.student.department) &&
        isYearMatch(c.year, leave.student.year) &&
        isSemesterMatch(c.semester, leave.student.semester) &&
        isSectionMatch(c.section, leave.student.section)
      );

      if (!isAssigned) {
        await transaction.rollback();
        return res.status(403).json({ message: 'Access denied: You are not the assigned Class Incharge for this student.' });
      }

      if (leave.status !== 'PENDING_CLASS_INCHARGE' && leave.status !== 'Pending') {
        await transaction.rollback();
        return res.status(400).json({ message: 'Leave request is not pending Class Incharge review.' });
      }

      leave.status = 'PENDING_HOD';
      leave.processedBy = req.user.id;
      leave.processedAt = new Date();
      await leave.save({ transaction });

      // Find ONLY the current HOD belonging to the student's department directly in MySQL
      const sameDeptHODs = await Faculty.findAll({
        where: {
          department: leave.student.department,
          designation: 'HOD'
        },
        transaction
      });

      let hodUserIds = sameDeptHODs.map(f => f.userId).filter(Boolean);

      if (hodUserIds.length === 0) {
        // Fallback: Find User with role admin/hod matching department
        const adminRole = await Role.findOne({ where: { name: 'admin' }, transaction });
        const hodRole = await Role.findOne({ where: { name: 'hod' }, transaction });
        const roleIds = [adminRole?.id, hodRole?.id].filter(Boolean);

        const hodUsers = await User.findAll({
          where: {
            roleId: { [Op.in]: roleIds },
            isApproved: true
          },
          include: [{
            model: Faculty,
            as: 'faculty',
            where: { department: leave.student.department }
          }],
          transaction
        });

        hodUserIds = hodUsers.map(u => u.id);
      }

      const notifMsg = `📝 Leave Request Approved by Class Incharge: ${leave.student.name} (${leave.student.registerNumber}) applied for ${leave.leaveType} leave. Awaiting HOD approval.`;

      for (const hodId of hodUserIds) {
        await Notification.create({
          userId: hodId,
          message: notifMsg,
          type: 'leave_request_hod',
          relatedId: leave.id,
          isRead: false
        }, { transaction });
      }

      await transaction.commit();

      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        for (const hodId of hodUserIds) {
          socketManager.emitToUser(hodId, 'LEAVE_REQUEST_PENDING_HOD', {
            message: notifMsg,
            type: 'leave_request_hod',
            relatedId: leave.id,
            status: 'PENDING_HOD'
          });
        }
      }

      return res.status(200).json({ message: 'Leave request approved by Class Incharge. Forwarded to HOD for final approval.', leave });
    }

    // B. STAGE 2: HOD APPROVAL (PENDING_HOD -> APPROVED)
    if (userRole === 'admin' || userRole === 'hod') {
      if (req.user.department && !isDepartmentMatch(leave.student.department, req.user.department)) {
        await transaction.rollback();
        return res.status(403).json({ message: 'Access denied: leave request belongs to another department.' });
      }

      if (leave.status !== 'PENDING_HOD' && leave.status !== 'Pending') {
        await transaction.rollback();
        return res.status(400).json({ message: 'Leave request must be pending HOD approval before final approval.' });
      }

      leave.status = 'APPROVED';
      leave.hodRemarks = hodRemarks || null;
      leave.rejectionReason = null;
      leave.processedBy = req.user.id;
      leave.processedAt = new Date();
      await leave.save({ transaction });

      const studentUser = await User.findByPk(leave.student.userId, { transaction });
      let message = `🎉 Your leave request from ${leave.fromDate} to ${leave.toDate} has been APPROVED by HOD.`;
      if (hodRemarks) {
        message += ` Remarks: ${hodRemarks}`;
      }

      await Notification.create({
        userId: studentUser.id,
        message,
        type: 'leave_response',
        relatedId: leave.id,
        isRead: false
      }, { transaction });

      await transaction.commit();

      const socketManager = req.app.get('socketManager');
      if (socketManager && studentUser) {
        socketManager.emitToUser(studentUser.id, 'LEAVE_REQUEST_APPROVED', {
          message,
          type: 'leave_response',
          relatedId: leave.id,
          status: 'APPROVED'
        });
      }

      return res.status(200).json({ message: 'Leave request approved by HOD successfully.', leave });
    }

    await transaction.rollback();
    return res.status(403).json({ message: 'Access denied: Unauthorized role for leave approval.' });

  } catch (error) {
    await transaction.rollback();
    console.error('[Leaves Controller approveLeave Error]:', error);
    return res.status(500).json({ message: 'Internal server error processing approval.' });
  }
};

// 7. Stage Rejection Handler (Class Incharge -> REJECTED_BY_CLASS_INCHARGE, HOD -> REJECTED_BY_HOD)
exports.rejectLeave = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body || {};
    const userRole = String(req.user.role || '').toLowerCase();

    if (!rejectionReason || rejectionReason.trim() === '') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Rejection reason is required.' });
    }

    const leave = await LeaveRequest.findByPk(id, {
      include: [{ model: Student, as: 'student' }],
      transaction
    });

    if (!leave || !leave.student) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    // TERMINAL STATE PROTECTION: Immutable terminal states cannot be re-rejected
    if (leave.status === 'APPROVED' || leave.status === 'REJECTED_BY_CLASS_INCHARGE' || leave.status === 'REJECTED_BY_HOD') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Terminal state leave requests cannot be re-processed.' });
    }

    // A. STAGE 1: CLASS INCHARGE REJECTION (PENDING_CLASS_INCHARGE -> REJECTED_BY_CLASS_INCHARGE)
    if (userRole === 'faculty') {
      const faculty = await Faculty.findOne({ where: { userId: req.user.id }, transaction });
      if (!faculty) {
        await transaction.rollback();
        return res.status(403).json({ message: 'Faculty profile not found.' });
      }

      // Verify Faculty Department equals Student Department
      if (!isDepartmentMatch(faculty.department, leave.student.department)) {
        await transaction.rollback();
        return res.status(403).json({ message: 'Access denied: Faculty department does not match student department.' });
      }

      // Verify Faculty is currently assigned as Class Incharge for student's exact class
      const inchargeClasses = await ClassIncharge.findAll({ 
        where: {
          [Op.or]: [{ facultyId: faculty.id }, { facultyId: req.user.id }]
        },
        transaction 
      });
      const isAssigned = inchargeClasses.some(c => 
        isDepartmentMatch(c.department, leave.student.department) &&
        isYearMatch(c.year, leave.student.year) &&
        isSemesterMatch(c.semester, leave.student.semester) &&
        isSectionMatch(c.section, leave.student.section)
      );

      if (!isAssigned) {
        await transaction.rollback();
        return res.status(403).json({ message: 'Access denied: You are not the assigned Class Incharge for this student.' });
      }

      if (leave.status !== 'PENDING_CLASS_INCHARGE' && leave.status !== 'Pending') {
        await transaction.rollback();
        return res.status(400).json({ message: 'Leave request is not pending Class Incharge review.' });
      }

      leave.status = 'REJECTED_BY_CLASS_INCHARGE';
      leave.rejectionReason = rejectionReason;
      leave.processedBy = req.user.id;
      leave.processedAt = new Date();
      await leave.save({ transaction });

      const studentUser = await User.findByPk(leave.student.userId, { transaction });
      const message = `❌ Your leave request from ${leave.fromDate} to ${leave.toDate} was REJECTED by Class Incharge. Reason: ${rejectionReason}`;

      await Notification.create({
        userId: studentUser.id,
        message,
        type: 'leave_response',
        relatedId: leave.id,
        isRead: false
      }, { transaction });

      await transaction.commit();

      const socketManager = req.app.get('socketManager');
      if (socketManager && studentUser) {
        socketManager.emitToUser(studentUser.id, 'LEAVE_REQUEST_REJECTED', {
          message,
          type: 'leave_response',
          relatedId: leave.id,
          status: 'REJECTED_BY_CLASS_INCHARGE'
        });
      }

      return res.status(200).json({ message: 'Leave request rejected by Class Incharge.', leave });
    }

    // B. STAGE 2: HOD REJECTION (PENDING_HOD -> REJECTED_BY_HOD)
    if (userRole === 'admin' || userRole === 'hod') {
      if (req.user.department && !isDepartmentMatch(leave.student.department, req.user.department)) {
        await transaction.rollback();
        return res.status(403).json({ message: 'Access denied: leave request belongs to another department.' });
      }

      if (leave.status !== 'PENDING_HOD' && leave.status !== 'Pending') {
        await transaction.rollback();
        return res.status(400).json({ message: 'Leave request must be pending HOD review to be rejected by HOD.' });
      }

      leave.status = 'REJECTED_BY_HOD';
      leave.rejectionReason = rejectionReason;
      leave.processedBy = req.user.id;
      leave.processedAt = new Date();
      await leave.save({ transaction });

      const studentUser = await User.findByPk(leave.student.userId, { transaction });
      const message = `❌ Your leave request from ${leave.fromDate} to ${leave.toDate} was REJECTED by HOD. Reason: ${rejectionReason}`;

      await Notification.create({
        userId: studentUser.id,
        message,
        type: 'leave_response',
        relatedId: leave.id,
        isRead: false
      }, { transaction });

      await transaction.commit();

      const socketManager = req.app.get('socketManager');
      if (socketManager && studentUser) {
        socketManager.emitToUser(studentUser.id, 'LEAVE_REQUEST_REJECTED', {
          message,
          type: 'leave_response',
          relatedId: leave.id,
          status: 'REJECTED_BY_HOD'
        });
      }

      return res.status(200).json({ message: 'Leave request rejected by HOD.', leave });
    }

    await transaction.rollback();
    return res.status(403).json({ message: 'Access denied: Unauthorized role for leave rejection.' });

  } catch (error) {
    await transaction.rollback();
    console.error('[Leaves Controller rejectLeave Error]:', error);
    return res.status(500).json({ message: 'Internal server error processing rejection.' });
  }
};
