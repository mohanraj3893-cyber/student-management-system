document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  const reportBtns = document.querySelectorAll('.btn-report-download');
  const skeletonLoader = document.getElementById('reports-skeleton-container');

  reportBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const type = e.target.getAttribute('data-type');
      if (skeletonLoader) {
        skeletonLoader.style.display = 'block';
        skeletonLoader.scrollIntoView({ behavior: 'smooth' });
      }

      try {
        if (type.startsWith('attendance')) {
          // Fetch historical attendance records
          const res = await fetch('/api/attendance/history', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const rawData = await res.json();
          const list = Array.isArray(rawData) ? rawData : (rawData.records || []);
          
          if (!res.ok) throw new Error(rawData.message || 'Failed to fetch attendance reports.');

          // Generate CSV
          const headers = ['Student ID', 'Register Number', 'Student Name', 'Department', 'Year', 'Semester', 'Section', 'Total Days', 'Present Days', 'Attendance %'];
          const rows = [];
          
          list.forEach(s => {
            rows.push([
              s.id || '',
              s.register_number || s.registerNumber || '',
              s.name || s.studentName || '',
              s.department || '',
              s.year || '',
              s.semester || '',
              s.section || '',
              s.total_days ?? s.totalDays ?? 0,
              s.present_days ?? s.presentDays ?? 0,
              `${s.percentage ?? 0}%`
            ]);
          });

          downloadCSV('attendance_report.csv', headers, rows);

        } else if (type.startsWith('marks')) {
          // Fetch internal marks logs
          const res = await fetch('/api/marks/logs', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const rawData = await res.json();
          const list = Array.isArray(rawData) ? rawData : (rawData.logs || []);

          if (!res.ok) throw new Error(rawData.message || 'Failed to fetch marks reports.');

          // Generate CSV
          const headers = ['ID', 'Register Number', 'Student Name', 'Subject Code', 'Subject Name', 'Exam Type', 'Marks Obtained', 'Max Marks'];
          const rows = [];

          list.forEach(m => {
            rows.push([
              m.id || '',
              m.register_number || m.registerNumber || '',
              m.student_name || m.studentName || '',
              m.subject_code || m.subjectCode || '',
              m.subject_name || m.subjectName || '',
              m.exam_type || m.examType || '',
              m.marks_obtained ?? m.marksObtained ?? '',
              m.max_marks ?? m.maxMarks ?? ''
            ]);
          });

          downloadCSV('academic_marks_report.csv', headers, rows);
        }
      } catch (err) {
        alert('Export error: ' + err.message);
      } finally {
        if (skeletonLoader) {
          skeletonLoader.style.display = 'none';
        }
      }
    });
  });

  function downloadCSV(filename, headers, rows) {
    const csvLines = [];
    csvLines.push(headers.map(h => `"${h}"`).join(','));
    rows.forEach(r => {
      csvLines.push(r.map(v => `"${v !== undefined && v !== null ? v : ''}"`).join(','));
    });

    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
});
