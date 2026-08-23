const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./models');

const app = express();

// Middleware configuration
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Serve static upload assets
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes Imports
const authRoutes = require('./routes/auth.routes');
const studentsRoutes = require('./routes/students.routes');
const facultyRoutes = require('./routes/faculty.routes');
const subjectsRoutes = require('./routes/subjects.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const marksRoutes = require('./routes/marks.routes');
const leavesRoutes = require('./routes/leaves.routes');
const adminLeavesRoutes = require('./routes/adminLeaves.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const announcementsRoutes = require('./routes/announcements.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const classInchargeRoutes = require('./routes/classIncharge.routes');
const resourcesRoutes = require('./routes/resources.routes');

app.use('/api/auth', authRoutes);
app.use('/api/admin', authRoutes); // Admin route aliases (pending-registrations, etc.)
app.use('/api/students', studentsRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/marks', marksRoutes);
app.use('/api/leaves', leavesRoutes);
app.use('/api/leave', leavesRoutes); // Leave route alias
app.use('/api/admin/leaves', adminLeavesRoutes);
app.use('/api/admin/class-incharges', classInchargeRoutes);
app.use('/api/class-incharges', classInchargeRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/resources', resourcesRoutes);

// Base route test
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'cse-dept-portal-backend' });
});

// Fallback resource 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: 'Requested resource could not be located.' });
});

// Global internal error handler
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  res.status(500).json({ message: 'Internal server processing error.' });
});

module.exports = app;
