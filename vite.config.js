import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        roleSelection: resolve(__dirname, 'role_selection.html'),
        login: resolve(__dirname, 'login.html'),
        register: resolve(__dirname, 'register.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        students: resolve(__dirname, 'students.html'),
        student_profile: resolve(__dirname, 'student_profile.html'),
        new_registrations: resolve(__dirname, 'new_registrations.html'),
        faculty: resolve(__dirname, 'faculty.html'),
        faculty_profile: resolve(__dirname, 'faculty_profile.html'),
        subjects: resolve(__dirname, 'subjects.html'),
        attendance: resolve(__dirname, 'attendance.html'),
        marks: resolve(__dirname, 'marks.html'),
        leave: resolve(__dirname, 'leave.html'),
        announcements: resolve(__dirname, 'announcements.html'),
        reports: resolve(__dirname, 'reports.html'),
        settings: resolve(__dirname, 'settings.html'),
        student_dashboard: resolve(__dirname, 'student_dashboard.html'),
        student_my_profile: resolve(__dirname, 'student_my_profile.html'),
        student_attendance: resolve(__dirname, 'student_attendance.html'),
        student_marks: resolve(__dirname, 'student_marks.html'),
        student_leave: resolve(__dirname, 'student_leave.html'),
        student_subjects: resolve(__dirname, 'student_subjects.html'),
        student_settings: resolve(__dirname, 'student_settings.html'),
        faculty_dashboard: resolve(__dirname, 'faculty_dashboard.html'),
        faculty_students: resolve(__dirname, 'faculty_students.html'),
        faculty_attendance: resolve(__dirname, 'faculty_attendance.html'),
        faculty_assignments: resolve(__dirname, 'faculty_assignments.html'),
        faculty_marks: resolve(__dirname, 'faculty_marks.html'),
        faculty_announcements: resolve(__dirname, 'faculty_announcements.html'),
        faculty_resources: resolve(__dirname, 'faculty_resources.html'),
        faculty_settings: resolve(__dirname, 'faculty_settings.html'),
        faculty_my_profile: resolve(__dirname, 'faculty_my_profile.html'),
        faculty_requests: resolve(__dirname, 'faculty_requests.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});
