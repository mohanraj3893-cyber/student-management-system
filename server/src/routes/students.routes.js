const express = require('express');
const router = express.Router();
const { verifyToken, restrictTo, allowSelfOrRole } = require('../middleware/auth.middleware');
const studentsController = require('../controllers/students.controller');

router.use(verifyToken);

router.get('/', restrictTo('admin', 'faculty'), studentsController.getAllStudents);
router.get('/:id', (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'faculty') {
    return next();
  }
  return allowSelfOrRole('student')(req, res, next);
}, studentsController.getStudentById);
router.post('/', restrictTo('admin'), studentsController.createStudent);
router.put('/:id', allowSelfOrRole('student'), studentsController.updateStudent);
router.delete('/:id', restrictTo('admin'), studentsController.deleteStudent);

module.exports = router;
