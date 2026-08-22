const express = require('express');
const router = express.Router();
const { verifyToken, restrictTo } = require('../middleware/auth.middleware');
const attendanceController = require('../controllers/attendance.controller');

const subjectsController = require('../controllers/subjects.controller');

router.use(verifyToken);

// Faculty assigned subjects
router.get('/subjects', restrictTo('faculty'), subjectsController.getFacultyMySubjects);

// Faculty assigned classes
router.get('/my-classes', restrictTo('faculty'), attendanceController.getFacultyAssignedClasses);

// Daily attendance checklist (loads student list + existing status for date)
router.get('/daily-checklist', attendanceController.getDailyAttendanceChecklist);

// Save / Update daily attendance (Strictly Class Incharge Faculty ONLY)
router.post('/daily', restrictTo('faculty'), attendanceController.saveDailyAttendance);

// View attendance history report
router.get('/history', attendanceController.getAttendanceHistory);

module.exports = router;
