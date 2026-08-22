const express = require('express');
const router = express.Router();
const marksController = require('../controllers/marks.controller');
const { verifyToken, restrictTo } = require('../middleware/auth.middleware');

router.get('/roster', verifyToken, restrictTo('faculty'), marksController.getRosterForFaculty);
router.post('/save', verifyToken, restrictTo('faculty'), marksController.saveMarks);
router.get('/grades', verifyToken, restrictTo('student'), marksController.getStudentGrades);
router.get('/my-marks', verifyToken, restrictTo('student'), marksController.getStudentGrades);
router.get('/student', verifyToken, restrictTo('student'), marksController.getStudentGrades);
router.get('/logs', verifyToken, restrictTo('admin'), marksController.getDepartmentMarksLogs);

module.exports = router;
