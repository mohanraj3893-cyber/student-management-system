const express = require('express');
const router = express.Router();
const leavesController = require('../controllers/leaves.controller');
const { verifyToken, restrictTo } = require('../middleware/auth.middleware');

router.get('/', verifyToken, restrictTo('admin', 'hod'), leavesController.getLeaveRequests);
router.get('/pending', verifyToken, restrictTo('admin', 'hod'), leavesController.getLeaveRequests);
router.get('/:id', verifyToken, restrictTo('admin', 'hod'), leavesController.getLeaveDetails);
router.put('/:id/approve', verifyToken, restrictTo('admin', 'hod'), leavesController.approveLeave);
router.post('/:id/approve', verifyToken, restrictTo('admin', 'hod'), leavesController.approveLeave);
router.put('/:id/reject', verifyToken, restrictTo('admin', 'hod'), leavesController.rejectLeave);
router.post('/:id/reject', verifyToken, restrictTo('admin', 'hod'), leavesController.rejectLeave);

module.exports = router;
