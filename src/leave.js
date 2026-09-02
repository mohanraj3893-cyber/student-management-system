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

  let role = 'student';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    role = payload.role;
  } catch (e) {
    window.location.href = '/login.html';
    return;
  }

  if (role === 'admin') {
    initHODLeaveView();
  } else {
    initStudentLeaveView();
  }

  // 1. HOD Leave Approval View
  async function initHODLeaveView() {
    const container = document.querySelector('.workspace-column-card');
    if (!container) return;

    container.innerHTML = `
      <div class="profile-tabs-header" style="margin-bottom: 2rem;">
        <button class="profile-tab-btn active" id="tab-btn-pending">Pending Requests</button>
        <button class="profile-tab-btn" id="tab-btn-history">Leave History Logs</button>
      </div>

      <div id="pending-leaves-section">
        <div class="registrations-approval-list" id="pending-leaves-list">
          <div style="text-align: center; color: #9CA3AF; padding: 2rem;">Loading pending leaves...</div>
        </div>
      </div>

      <div id="history-leaves-section" style="display: none;">
        <div class="data-table-container">
          <table class="data-grid-table">
            <thead>
              <tr>
                <th>Register No</th>
                <th>Student Name</th>
                <th>Reason</th>
                <th>Date Range</th>
                <th>Days</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody id="history-leaves-tbody">
              <tr>
                <td colspan="7" style="text-align: center; color: #9CA3AF;">Loading history logs...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const tabPending = document.getElementById('tab-btn-pending');
    const tabHistory = document.getElementById('tab-btn-history');
    const pendingSec = document.getElementById('pending-leaves-section');
    const historySec = document.getElementById('history-leaves-section');

    tabPending.addEventListener('click', () => {
      tabPending.classList.add('active');
      tabHistory.classList.remove('active');
      pendingSec.style.display = 'block';
      historySec.style.display = 'none';
      loadLeaves();
    });

    tabHistory.addEventListener('click', () => {
      tabHistory.classList.add('active');
      tabPending.classList.remove('active');
      pendingSec.style.display = 'none';
      historySec.style.display = 'block';
      loadLeaves();
    });

    window.addEventListener('sms:realtime_event', (e) => {
      const data = e.detail || {};
      if (data.type === 'LEAVE_REQUEST_CREATED' || data.type === 'LEAVE_REQUEST_APPROVED' || data.type === 'LEAVE_REQUEST_REJECTED' || data.type === 'leave_request' || data.type === 'leave_response') {
        loadLeaves();
      }
    });

    // Load leave lists
    async function loadLeaves() {
      try {
        const res = await fetch('/api/leaves/requests', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json().catch(() => ({}));
        const pending = Array.isArray(data?.pending)
          ? data.pending
          : Array.isArray(data?.requests)
            ? data.requests.filter(r => String(r.status || '').toUpperCase().includes('PENDING'))
            : Array.isArray(data)
              ? data.filter(r => String(r.status || '').toUpperCase().includes('PENDING'))
              : [];

        const history = Array.isArray(data?.history)
          ? data.history
          : Array.isArray(data?.requests)
            ? data.requests.filter(r => !String(r.status || '').toUpperCase().includes('PENDING'))
            : Array.isArray(data)
              ? data.filter(r => !String(r.status || '').toUpperCase().includes('PENDING'))
              : [];

        // 1. Pending list rendering
        const pendingList = document.getElementById('pending-leaves-list');
        if (pendingList) {
          pendingList.innerHTML = '';

          if (pending.length === 0) {
            pendingList.innerHTML = `<div style="text-align: center; color: #9CA3AF; padding: 2rem;">No pending leave applications.</div>`;
          } else {
            pending.forEach(r => {
              const item = document.createElement('div');
              item.className = 'approval-card-item';
              const _rName = r.studentName || (r.student ? r.student.name : 'Student');
              const regNo = r.registerNumber || (r.student ? r.student.registerNumber : '-');
              const photoPath = r.photoPath || (r.student ? r.student.photoPath : null);
              const sDate = r.startDate || r.fromDate || '';
              const eDate = r.endDate || r.toDate || '';
              const numDays = r.numberOfDays || r.days || 1;
              const photo = (window.getAvatarUrl ? window.getAvatarUrl(_rName, photoPath) : (photoPath || ''));
              item.innerHTML = `
                <div class="approval-card-avatar">
                  <img src="${photo}" alt="${_rName}" onerror="this.onerror=null; this.src=(window.getAvatarUrl ? window.getAvatarUrl(this.alt, null) : '');">
                </div>
                <div class="approval-card-info">
                  <h4 class="student-approval-name">${_rName}</h4>
                  <p class="student-approval-details">Register No: <strong>${regNo}</strong> | Reason: <strong>${r.reason || '-'}</strong></p>
                  <p class="student-approval-doc">Date Range: <strong>${sDate} - ${eDate}</strong> (${numDays} ${numDays === 1 ? 'Day' : 'Days'})</p>
                </div>
                <div class="approval-card-actions">
                  <button class="btn btn-sm btn-success action-btn-approve" data-id="${r.id}">Approve</button>
                  <button class="btn btn-sm btn-danger action-btn-reject" data-id="${r.id}" data-reg="${regNo}">Reject</button>
                </div>
              `;
              pendingList.appendChild(item);
            });
          }
        }

        // 2. History table rendering
        const historyTbody = document.getElementById('history-leaves-tbody');
        if (historyTbody) {
          historyTbody.innerHTML = '';

          if (history.length === 0) {
            historyTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #9CA3AF;">No processed leave history.</td></tr>`;
          } else {
            history.forEach(r => {
            const _rName = r.studentName || (r.student ? r.student.name : 'Student');
            const regNo = r.registerNumber || (r.student ? r.student.registerNumber : '-');
            const sDate = r.startDate || r.fromDate || '';
            const eDate = r.endDate || r.toDate || '';
            const numDays = r.numberOfDays || r.days || 1;
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><strong>${regNo}</strong></td>
              <td>${_rName}</td>
              <td>${r.reason || '-'}</td>
              <td>${sDate} - ${eDate}</td>
              <td>${numDays} ${numDays === 1 ? 'Day' : 'Days'}</td>
              <td><span class="badge-pill ${r.status === 'APPROVED' || r.status === 'Approved' ? 'bg-green-light' : 'bg-red-light'}">${r.status}</span></td>
              <td style="font-size: 0.8rem; color: #9CA3AF;">${r.rejectionReason || r.hodRemarks || '-'}</td>
            `;
            historyTbody.appendChild(tr);
          });
        }

        // Attach action listeners
        document.querySelectorAll('.action-btn-approve').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            try {
              const res = await fetch(`/api/leaves/requests/${id}/approve`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const body = await res.json();
              if (!res.ok) throw new Error(body.message || 'Approval failed.');
              showToast('Leave request approved successfully!', true);
              loadLeaves();
            } catch (err) {
              showToast(err.message, false);
            }
          });
        });

        document.querySelectorAll('.action-btn-reject').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const reg = btn.dataset.reg;
            const reason = prompt(`Specify Leave Rejection Reason for Student (${reg}):`);
            if (reason === null) return; // Cancelled

            try {
              const res = await fetch(`/api/leaves/requests/${id}/reject`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ rejectionReason: reason })
              });
              const body = await res.json();
              if (!res.ok) throw new Error(body.message || 'Rejection failed.');
              showToast('Leave request rejected successfully.', true);
              loadLeaves();
            } catch (err) {
              showToast(err.message, false);
            }
          });
        });

      } catch (err) {
        showToast('Error loading leaves: ' + err.message, false);
      }
    }

    loadLeaves();
  }

  // 2. Student Leave Form & History View
  function initStudentLeaveView() {
    const container = document.querySelector('.workspace-column-card');
    if (!container) return;

    container.innerHTML = `
      <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
        
        <!-- Application Form -->
        <div style="flex: 1; min-width: 300px;">
          <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-color); margin-bottom: 1.5rem;">Apply for Leave</h3>
          <form class="login-form-block" id="apply-leave-form">
            <div class="form-group-item">
              <label for="leave-reason">Reason for Leave</label>
              <input type="text" id="leave-reason" placeholder="e.g. Fever & Medical Rest" style="padding: 0.75rem 1rem;" required>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
              <div class="form-group-item">
                <label for="leave-start">Start Date</label>
                <input type="date" id="leave-start" style="padding: 0.75rem 1rem;" required>
              </div>
              <div class="form-group-item">
                <label for="leave-end">End Date</label>
                <input type="date" id="leave-end" style="padding: 0.75rem 1rem;" required>
              </div>
            </div>
            <div class="form-group-item" style="margin-top: 1rem;">
              <label for="leave-days">Total Days</label>
              <input type="number" id="leave-days" min="1" placeholder="e.g. 2" style="padding: 0.75rem 1rem;" required>
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem; width: 100%;">Submit Application</button>
          </form>
        </div>

        <!-- Personal Logs -->
        <div style="flex: 1.5; min-width: 350px;">
          <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-color); margin-bottom: 1.5rem;">My Leave Logs</h3>
          <div class="data-table-container">
            <table class="data-grid-table">
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Date Range</th>
                  <th>Days</th>
                  <th>Status</th>
                  <th>Rejection Details</th>
                </tr>
              </thead>
              <tbody id="student-leaves-tbody">
                <tr>
                  <td colspan="5" style="text-align: center; color: #9CA3AF;">Loading leave history...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    const form = document.getElementById('apply-leave-form');
    const tbody = document.getElementById('student-leaves-tbody');

    window.addEventListener('sms:realtime_event', (e) => {
      const data = e.detail || {};
      if (data.type === 'LEAVE_REQUEST_APPROVED' || data.type === 'LEAVE_REQUEST_REJECTED' || data.type === 'leave_response') {
        loadStudentLeaves();
      }
    });

    async function loadStudentLeaves() {
      try {
        const res = await fetch('/api/leaves/requests', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        tbody.innerHTML = '';

        const allLogs = [...data.pending, ...data.history];
        if (allLogs.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #9CA3AF;">You have not applied for any leaves yet.</td></tr>`;
          return;
        }

        allLogs.forEach(r => {
          const tr = document.createElement('tr');
          let statusClass = 'bg-blue-light';
          if (r.status === 'Approved') statusClass = 'bg-green-light';
          else if (r.status === 'Rejected') statusClass = 'bg-red-light';

          const numDays = r.numberOfDays || r.days || 1;

          tr.innerHTML = `
            <td><strong>${r.reason}</strong></td>
            <td>${r.startDate} - ${r.endDate}</td>
            <td>${numDays} ${numDays === 1 ? 'Day' : 'Days'}</td>
            <td><span class="badge-pill ${statusClass}">${r.status}</span></td>
            <td style="font-size: 0.8rem; color: #EF4444;">${r.rejectionReason || '-'}</td>
          `;
          tbody.appendChild(tr);
        });
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #EF4444;">${err.message}</td></tr>`;
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('[SMS Leave SPA Debug] Leave submit started');

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳</span> Submitting...';
      }

      const reason = document.getElementById('leave-reason')?.value || '';
      const startDate = document.getElementById('leave-start')?.value || '';
      const endDate = document.getElementById('leave-end')?.value || startDate;
      const days = document.getElementById('leave-days')?.value || '1';

      const payload = {
        reason: reason.trim(),
        startDate,
        endDate,
        fromDate: startDate,
        toDate: endDate,
        days: Number(days),
        numberOfDays: Number(days)
      };

      console.log('[SMS Leave SPA Debug] Sending payload:', payload);

      try {
        const res = await fetch('/api/leaves/apply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        console.log('[SMS Leave SPA Debug] Response Status:', res.status);
        const body = await res.json().catch(() => ({}));
        console.log('[SMS Leave SPA Debug] Response Body:', body);

        if (!res.ok) throw new Error(body.message || 'Submission failed.');

        showToast(body.message || 'Leave request submitted successfully!', true);
        form.reset();
        await loadStudentLeaves();
      } catch (err) {
        console.error('[SMS Leave SPA Debug] Error:', err);
        showToast(err.message, false);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>🚀</span> Submit Request';
        }
      }
    });

    loadStudentLeaves();
  }

});
