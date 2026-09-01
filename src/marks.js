// Style injection for toast notification
const style = document.createElement('style');
style.textContent = `
  .toast-notification {
    position: fixed;
    top: 24px;
    right: 24px;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    color: #fff;
    font-size: 0.9rem;
    font-weight: 600;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
    transform: translateY(-20px);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 9999;
  }
  .toast-notification.show {
    transform: translateY(0);
    opacity: 1;
  }
  .toast-notification.success {
    background: linear-gradient(135deg, #10B981, #059669);
    border: 1px solid rgba(16, 185, 129, 0.2);
  }
  .toast-notification.error {
    background: linear-gradient(135deg, #EF4444, #DC2626);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }
`;
document.head.appendChild(style);

function showToast(message, isSuccess = true) {
  const toast = document.createElement('div');
  toast.className = `toast-notification ${isSuccess ? 'success' : 'error'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // Parse payload role
  let role = 'student';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    role = payload.role;
  } catch (e) {
    window.location.href = '/login.html';
    return;
  }

  // Load HOD Marks View if on HOD page
  if (role === 'admin' || document.getElementById('hod-marks-tbody')) {
    initHODMarksView();
  }

  // HOD / Admin View
  async function initHODMarksView() {
    const tbody = document.getElementById('hod-marks-tbody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/marks/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load assessment logs.');
      const rawData = await res.json();
      const list = Array.isArray(rawData) ? rawData : (rawData.logs || []);
      
      tbody.innerHTML = '';

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 2rem;">No internal assessment marks entered in the database yet.</td></tr>`;
        return;
      }

      list.forEach(m => {
        const tr = document.createElement('tr');
        const obtained = m.marks_obtained ?? m.marksObtained ?? 0;
        const max = m.max_marks ?? m.maxMarks ?? 100;
        const percentage = ((obtained / max) * 100).toFixed(1);
        const isPass = parseFloat(percentage) >= 50;
        const regNo = m.register_number || m.registerNumber || 'N/A';
        const studentName = m.student_name || m.studentName || 'Student';
        const subCode = m.subject_code || m.subjectCode || '';
        const subName = m.subject_name || m.subjectName || '';
        const facultyName = m.faculty_name || m.facultyName || 'Staff';
        const examType = m.exam_type || m.examType || 'CIA-1';

        tr.innerHTML = `
          <td><strong>${regNo}</strong></td>
          <td>${studentName}</td>
          <td>
            <strong>${subCode}</strong>
            <span style="font-size: 0.78rem; color: #64748b; display: block;">${subName}</span>
          </td>
          <td>${facultyName}</td>
          <td><span class="badge-pill bg-blue-light">${examType}</span></td>
          <td><strong style="color: #0F172A;">${obtained}</strong> / ${max}</td>
          <td><span class="badge-pill ${isPass ? 'bg-green-light' : 'bg-red-light'}">${percentage}%</span></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 2rem;">Error: ${err.message}</td></tr>`;
      }
    }
  }
});
