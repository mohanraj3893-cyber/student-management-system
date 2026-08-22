const express = require('express');
const router = express.Router();
const { verifyToken, restrictTo } = require('../middleware/auth.middleware');
const subjectsController = require('../controllers/subjects.controller');

router.use(verifyToken);
router.get('/my-subjects', restrictTo('faculty'), subjectsController.getFacultyMySubjects);
router.get('/my-enrolled', restrictTo('student'), subjectsController.getMyEnrolledSubjects);
router.get('/', subjectsController.getAllSubjects);
router.get('/:id', subjectsController.getSubjectById);
router.post('/', restrictTo('admin'), subjectsController.createSubject);
router.put('/:id', restrictTo('admin'), subjectsController.updateSubject);
router.delete('/:id', restrictTo('admin'), subjectsController.deleteSubject);

module.exports = router;
