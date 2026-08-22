const express = require('express');
const router = express.Router();
const leavesController = require('../controllers/leaves.controller');
const { verifyToken, restrictTo } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// Root & Requests endpoints
router.get('/', verifyToken, restrictTo('student', 'faculty', 'admin', 'hod'), (req, res, next) => {
  if (req.user.role === 'student') {
    return leavesController.getMyLeaveHistory(req, res, next);
  }
  return leavesController.getLeaveRequests(req, res, next);
});
router.get('/requests', verifyToken, restrictTo('faculty', 'admin', 'hod'), leavesController.getLeaveRequests);

// Approval & Rejection endpoints (Supports PUT & POST)
router.put('/:id/approve', verifyToken, restrictTo('faculty', 'admin', 'hod'), leavesController.approveLeave);
router.post('/:id/approve', verifyToken, restrictTo('faculty', 'admin', 'hod'), leavesController.approveLeave);
router.put('/:id/reject', verifyToken, restrictTo('faculty', 'admin', 'hod'), leavesController.rejectLeave);
router.post('/:id/reject', verifyToken, restrictTo('faculty', 'admin', 'hod'), leavesController.rejectLeave);

// Student endpoints
router.post('/', verifyToken, restrictTo('student'), upload.single('supportingDocument'), leavesController.applyLeave);
router.post('/apply', verifyToken, restrictTo('student'), upload.single('supportingDocument'), leavesController.applyLeave);
router.get('/my', verifyToken, restrictTo('student'), leavesController.getMyLeaveHistory);

// Single Details & Delete
router.get('/:id', verifyToken, restrictTo('student', 'faculty', 'admin', 'hod'), leavesController.getLeaveDetails);
router.delete('/:id', verifyToken, restrictTo('student'), leavesController.deleteLeaveRequest);

module.exports = router;
