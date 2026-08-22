const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken, restrictTo } = require('../middleware/auth.middleware');

// Authentication routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/token', authController.refreshToken);
router.post('/logout', authController.logout);
router.get('/admin-exists', authController.checkAdminExists);

// Registrations approvals (Admin/HOD only - Supports both /auth/registrations, /admin/, and /faculty-registrations pending endpoints)
router.get('/registrations/pending', verifyToken, restrictTo('admin'), authController.getPendingRegistrations);
router.post('/registrations/:userId/approve', verifyToken, restrictTo('admin'), authController.approveRegistration);
router.post('/registrations/:userId/reject', verifyToken, restrictTo('admin'), authController.rejectRegistration);

// Additional admin aliases for student & faculty pending registrations and approvals
router.get('/pending-registrations', verifyToken, restrictTo('admin'), authController.getPendingRegistrations);
router.get('/pending-faculty-registrations', verifyToken, restrictTo('admin'), authController.getPendingRegistrations);
router.post('/approve-user/:userId', verifyToken, restrictTo('admin'), authController.approveRegistration);
router.post('/faculty-registrations/:userId/approve', verifyToken, restrictTo('admin'), authController.approveRegistration);
router.post('/reject-user/:userId', verifyToken, restrictTo('admin'), authController.rejectRegistration);
router.post('/faculty-registrations/:userId/reject', verifyToken, restrictTo('admin'), authController.rejectRegistration);

// Secured user routes
router.post('/change-password', verifyToken, authController.changePassword);
router.get('/profile', verifyToken, authController.getProfile);
router.put('/profile', verifyToken, authController.updateProfile);
router.post('/profile/photo', verifyToken, authController.uploadProfilePhoto);

module.exports = router;
