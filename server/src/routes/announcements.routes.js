const express = require('express');
const router = express.Router();
const announcementsController = require('../controllers/announcements.controller');
const { verifyToken, restrictTo } = require('../middleware/auth.middleware');

router.post('/create', verifyToken, restrictTo('admin', 'faculty'), announcementsController.createAnnouncement);
router.get('/', verifyToken, announcementsController.getAnnouncements);
router.delete('/:id', verifyToken, announcementsController.deleteAnnouncement);

module.exports = router;
