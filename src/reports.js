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
          const data = await res.json();
          
          if (!res.ok) throw new Error(data.message || 'Failed to fetch attendance reports.');

          // Generate CSV
          const headers = ['Session ID', 'Date', 'Period', 'Subject Code', 'Subject Name', 'Faculty Name', 'Section', 'Semester', 'Student Name', 'Register Number', 'Status'];
          const rows = [];
          
          data.forEach(s => {
            s.records.forEach(r => {
              rows.push([
                s.id,
                s.date,
                s.period,
                s.subjectCode,
                s.subjectName,
                s.facultyName,
                s.section,
                s.semester,
                r.studentName,
                r.registerNumber,
                r.status
              ]);
            });
          });

          downloadCSV('attendance_report.csv', headers, rows);

        } else if (type.startsWith('marks')) {
          // Fetch internal marks logs
          const res = await fetch('/api/marks/logs', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();

          if (!res.ok) throw new Error(data.message || 'Failed to fetch marks reports.');

          // Generate CSV
          const headers = ['ID', 'Register Number', 'Student Name', 'Subject Code', 'Subject Name', 'Staff Advisor', 'Assessment Block', 'Marks Obtained', 'Max Marks'];
          const rows = [];

          data.forEach(m => {
            rows.push([
              m.id,
              m.registerNumber,
              m.studentName,
              m.subjectCode,
              m.subjectName,
              m.facultyName,
              m.examType,
              m.marksObtained,
              m.maxMarks
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
