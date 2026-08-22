const express = require('express');
const router = express.Router();
const { verifyToken, restrictTo } = require('../middleware/auth.middleware');
const classInchargeController = require('../controllers/classIncharge.controller');

router.use(verifyToken);

// HOD / Admin routes
router.get('/', restrictTo('admin'), classInchargeController.getAllClassIncharges);
router.post('/assign', restrictTo('admin'), classInchargeController.assignClassIncharge);
router.post('/remove', restrictTo('admin'), classInchargeController.removeClassIncharge);

// Faculty route
router.get('/my-assignments', restrictTo('faculty'), classInchargeController.getMyClassAssignments);

module.exports = router;
