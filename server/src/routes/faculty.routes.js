const express = require('express');
const router = express.Router();
const { verifyToken, restrictTo, allowSelfOrRole } = require('../middleware/auth.middleware');
const facultyController = require('../controllers/faculty.controller');

router.use(verifyToken);

router.get('/', restrictTo('admin'), facultyController.getAllFaculty);
router.get('/my-students', restrictTo('admin', 'hod', 'faculty'), facultyController.getMyStudents);
router.get('/:id', allowSelfOrRole('faculty'), facultyController.getFacultyById);
router.post('/', restrictTo('admin'), facultyController.createFaculty);
router.put('/:id', allowSelfOrRole('faculty'), facultyController.updateFaculty);
router.delete('/:id', restrictTo('admin'), facultyController.deleteFaculty);

module.exports = router;
