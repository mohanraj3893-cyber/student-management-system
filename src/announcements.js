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

  // Adjust view depending on role
  const formSection = document.getElementById('announcement-creator-section');
  if (role === 'student' && formSection) {
    formSection.style.display = 'none';
    const feedCard = formSection.nextElementSibling;
    if (feedCard) {
      feedCard.style.gridColumn = '1 / -1';
    }
  }

  // Render announcements feed
  async function loadAnnouncements() {
    try {
      const res = await fetch('/api/announcements', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const list = await res.json();
      const feedContainer = document.getElementById('announcements-feed-container');
      if (!feedContainer) return;

      feedContainer.innerHTML = '';
      if (!Array.isArray(list) || list.length === 0) {
        feedContainer.innerHTML = `
          <div style="text-align: center; padding: 3rem 1.5rem; color: #64748B;">
            <span style="font-size: 2.5rem; display: block; margin-bottom: 0.5rem;">📢</span>
            <h4 style="font-size: 1.05rem; font-weight: 700; color: #0F172A; margin: 0 0 0.25rem 0;">No announcements yet</h4>
            <p style="font-size: 0.85rem; margin: 0;">There are no new notices or announcements from the department.</p>
          </div>
        `;
        return;
      }

      list.forEach(a => {
        const item = document.createElement('div');
        item.className = 'announcement-notice-item';
        item.style = 'background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1.25rem; margin-bottom: 1rem; position: relative; box-shadow: 0 2px 6px rgba(0,0,0,0.02);';
        
        let categoryColor = 'background: #EFF6FF; color: #0056D2;';
        if (a.category === 'Exam') categoryColor = 'background: #FEF2F2; color: #DC2626;';
        else if (a.category === 'Circular') categoryColor = 'background: #ECFDF5; color: #10B981;';

        const deleteBtn = (role === 'admin') 
          ? `<button class="btn-delete-notice" data-id="${a.id}" style="position: absolute; top: 1rem; right: 1rem; background: transparent; border: none; color: #EF4444; cursor: pointer; font-size: 1rem;" title="Delete Notice">🗑️</button>`
          : '';

        const dateStr = new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

        item.innerHTML = `
          ${deleteBtn}
          <div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.65rem; flex-wrap: wrap;">
            <span style="font-size: 0.68rem; font-weight: 700; padding: 3px 9px; border-radius: 6px; text-transform: uppercase; ${categoryColor}">${a.category || 'ACADEMIC'}</span>
            <span style="font-size: 0.78rem; color: #64748B;">Posted by <strong>${a.posterName || 'HOD Office'}</strong> on ${dateStr}</span>
          </div>
          <h4 style="font-size: 1rem; font-weight: 700; color: #0F172A; margin: 0 0 0.4rem 0; line-height: 1.35;">${a.title}</h4>
          <p style="font-size: 0.85rem; color: #475569; line-height: 1.5; margin: 0; white-space: pre-line;">${a.content}</p>
        `;
        feedContainer.appendChild(item);
      });

      // Attach delete actions
      document.querySelectorAll('.btn-delete-notice').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          if (!confirm('Are you sure you want to remove this announcement notice?')) return;

          try {
            const res = await fetch(`/api/announcements/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.message || 'Failed to remove notice.');

            showToast('Announcement removed successfully.', true);
            loadAnnouncements();
          } catch (err) {
            showToast(err.message, false);
          }
        });
      });

    } catch (err) {
      showToast(err.message, false);
    }
  }

  // Bind Form Submit
  const form = document.getElementById('post-announcement-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('notice-title').value;
      const content = document.getElementById('notice-content').value;
      const category = document.getElementById('notice-category').value;

      try {
        const res = await fetch('/api/announcements/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title, content, category })
        });

        const body = await res.json();
        if (!res.ok) throw new Error(body.message || 'Failed to post announcement.');

        showToast('New announcement posted successfully!', true);
        form.reset();
        loadAnnouncements();
      } catch (err) {
        showToast(err.message, false);
      }
    });
  }

  // Load notices initially
  window.addEventListener('sms:realtime_event', (e) => {
    const data = e.detail || {};
    if (data.type === 'ANNOUNCEMENT_PUBLISHED') {
      loadAnnouncements();
    }
  });

  await loadAnnouncements();
});
