const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken } = require('../middleware/auth.middleware');
const resourcesController = require('../controllers/resources.controller');

// Ensure uploads/resources directory exists
const uploadDir = path.join(__dirname, '../../uploads/resources');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const safeBaseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-]/g, '_');
    cb(null, `${safeBaseName}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max file size
});

// Routes
router.post('/upload', verifyToken, upload.single('file'), resourcesController.uploadResource);
router.get('/faculty', verifyToken, resourcesController.getFacultyResources);
router.get('/student', verifyToken, resourcesController.getStudentResources);
router.delete('/:id', verifyToken, resourcesController.deleteResource);

module.exports = router;
