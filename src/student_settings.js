document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  if (!token) {
    window.location.href = '/login.html?role=student';
    return;
  }

  const alertBox = document.getElementById('settings-alert');

  function showAlert(msg, type = 'success') {
    if (!alertBox) return;
    alertBox.style.display = 'block';
    if (type === 'error') {
      alertBox.style.background = 'rgba(239, 68, 68, 0.1)';
      alertBox.style.color = '#EF4444';
      alertBox.style.border = '1px solid rgba(239, 68, 68, 0.2)';
      alertBox.innerHTML = `⚠️ ${msg}`;
    } else {
      alertBox.style.background = 'rgba(16, 185, 129, 0.1)';
      alertBox.style.color = '#10B981';
      alertBox.style.border = '1px solid rgba(16, 185, 129, 0.2)';
      alertBox.innerHTML = `✅ ${msg}`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      alertBox.style.display = 'none';
    }, 4000);
  }

  // ==========================================
  // 1. FETCH PROFILE DATA
  // ==========================================
  async function loadProfile() {
    try {
      const res = await fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load profile data');
      const data = await res.json();

      // Read-only fields
      document.getElementById('setting-name').value = data.name || '';
      document.getElementById('setting-reg-no').value = data.registerNumber || data.username || '';
      document.getElementById('setting-department').value = data.department || 'Computer Science & Engineering';
      document.getElementById('setting-year-sem').value = `${data.year || ''} ${data.year && data.semester ? '/' : ''} ${data.semester || ''}`.trim() || 'N/A';
      document.getElementById('setting-email').value = data.email || '';

      // Editable field
      document.getElementById('setting-phone').value = data.phone || '';

      // Avatars
      const photoUrl = (window.getAvatarUrl ? window.getAvatarUrl(data.name, data.photoPath) : (data.photoPath || ''));
      const previewImg = document.getElementById('profile-photo-preview');
      if (previewImg) previewImg.src = photoUrl;

      const removeBtn = document.getElementById('btn-remove-photo');
      if (removeBtn) removeBtn.style.display = (data.photoPath && data.photoPath.trim()) ? 'inline-block' : 'none';

      const sidebarAvatar = document.getElementById('sidebar-student-avatar');
      if (sidebarAvatar) sidebarAvatar.src = photoUrl;

      const navAvatar = document.getElementById('nav-student-avatar');
      if (navAvatar) navAvatar.src = photoUrl;

      const sidebarName = document.getElementById('sidebar-student-name');
      if (sidebarName) sidebarName.textContent = data.name || 'Student';

      const navName = document.getElementById('nav-student-name');
      if (navName) navName.textContent = data.name || 'Student';

      const greetingName = document.getElementById('settings-greeting-name');
      if (greetingName) greetingName.textContent = data.name ? `${data.name}!` : 'Student!';

      const sidebarReg = document.getElementById('sidebar-student-reg');
      if (sidebarReg) sidebarReg.textContent = data.registerNumber || data.username || 'CSE Student';

      const navReg = document.getElementById('nav-student-reg');
      if (navReg) navReg.textContent = data.registerNumber || data.username || 'CSE Student';

    } catch (err) {
      console.error(err);
      showAlert('Could not load profile details.', 'error');
    }
  }

  loadProfile();

  // Save profile changes (phone update)
  const profileForm = document.getElementById('profile-settings-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = document.getElementById('setting-phone').value.trim();

      try {
        const res = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ phone })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to update profile');
        showAlert('Profile contact phone number updated successfully!');
      } catch (err) {
        showAlert(err.message, 'error');
      }
    });
  }

  // ==========================================
  // CROP & ADJUST PROFILE PHOTO (CROPPER.JS)
  // ==========================================
  let cropper = null;
  const btnChangePhoto = document.getElementById('btn-change-photo');
  const fileInput = document.getElementById('photo-file-input');
  const btnRemovePhoto = document.getElementById('btn-remove-photo');

  const cropModal = document.getElementById('crop-modal-overlay');
  const cropTarget = document.getElementById('crop-image-target');
  const cropCancelBtn = document.getElementById('crop-cancel-btn');
  const cropCancelX = document.getElementById('crop-cancel-x');
  const cropApplyBtn = document.getElementById('crop-apply-btn');
  const cropZoomIn = document.getElementById('crop-zoom-in');
  const cropZoomOut = document.getElementById('crop-zoom-out');
  const cropRotateLeft = document.getElementById('crop-rotate-left');

  function closeCropModal() {
    if (cropModal) cropModal.style.display = 'none';
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    if (fileInput) fileInput.value = '';
  }

  if (btnChangePhoto && fileInput) {
    btnChangePhoto.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.type)) {
        showAlert('Please upload a valid image file (JPG, PNG, or WEBP).', 'error');
        fileInput.value = '';
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        showAlert('File size exceeds the 20MB limit.', 'error');
        fileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        cropTarget.src = evt.target.result;
        cropModal.style.display = 'flex';

        if (cropper) {
          cropper.destroy();
        }

        // Initialize Cropper.js
        cropper = new Cropper(cropTarget, {
          aspectRatio: 1, // 1:1 square avatar ratio
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 0.9,
          restore: false,
          guides: true,
          center: true,
          highlight: false,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: false
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // Zoom and Rotate controls
  if (cropZoomIn) cropZoomIn.addEventListener('click', () => cropper && cropper.zoom(0.1));
  if (cropZoomOut) cropZoomOut.addEventListener('click', () => cropper && cropper.zoom(-0.1));
  if (cropRotateLeft) cropRotateLeft.addEventListener('click', () => cropper && cropper.rotate(90));

  if (cropCancelBtn) cropCancelBtn.addEventListener('click', closeCropModal);
  if (cropCancelX) cropCancelX.addEventListener('click', closeCropModal);

  // Apply Cropped Image & Save
  if (cropApplyBtn) {
    cropApplyBtn.addEventListener('click', async () => {
      if (!cropper) return;

      const canvas = cropper.getCroppedCanvas({
        width: 300,
        height: 300
      });

      const croppedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.9);
      closeCropModal();

      try {
        showAlert('Saving cropped profile photo...', 'success');
        const res = await fetch('/api/auth/profile/photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ photoData: croppedPhotoBase64 })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Photo upload failed');
        showAlert('Profile photo cropped and updated successfully!');
        loadProfile();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    });
  }

  if (btnRemovePhoto) {
    btnRemovePhoto.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/auth/profile/photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ photoData: 'REMOVE' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to remove photo');
        showAlert('Profile photo removed.');
        loadProfile();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    });
  }

  // ==========================================
  // 2. ACCOUNT SECURITY (CHANGE PASSWORD)
  // ==========================================
  const passForm = document.getElementById('security-password-form');
  if (passForm) {
    passForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const oldPassword = document.getElementById('sec-curr-password').value;
      const newPassword = document.getElementById('sec-new-password').value;
      const confirmPassword = document.getElementById('sec-confirm-password').value;

      if (newPassword !== confirmPassword) {
        showAlert('New password and confirm password do not match.', 'error');
        return;
      }

      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ oldPassword, newPassword })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Password update failed');

        showAlert('Account password updated successfully!');
        passForm.reset();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    });
  }

  // Show/Hide Password Eye Buttons
  document.querySelectorAll('.pass-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const inputEl = document.getElementById(targetId);
      if (!inputEl) return;
      if (inputEl.type === 'password') {
        inputEl.type = 'text';
        btn.textContent = '🙈';
      } else {
        inputEl.type = 'password';
        btn.textContent = '👁️';
      }
    });
  });

  // ==========================================
  // 3. NOTIFICATION SETTINGS
  // ==========================================
  const notifKeys = ['notif-attendance', 'notif-leave', 'notif-marks', 'notif-announcements'];
  const savedNotifs = JSON.parse(localStorage.getItem('student_notifications') || '{}');

  notifKeys.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (savedNotifs[id] !== undefined) {
      el.checked = savedNotifs[id];
    }
    el.addEventListener('change', () => {
      savedNotifs[id] = el.checked;
      localStorage.setItem('student_notifications', JSON.stringify(savedNotifs));
      showAlert('Notification preferences saved.');
    });
  });

  // ==========================================
  // 4. APPEARANCE SETTINGS
  // ==========================================
  const themeLightCard = document.getElementById('theme-card-light');
  const themeDarkCard = document.getElementById('theme-card-dark');
  const themeSystemCard = document.getElementById('theme-card-system');

  function updateThemeUI(mode) {
    [themeLightCard, themeDarkCard, themeSystemCard].forEach(c => c && c.classList.remove('active'));

    if (mode === 'dark') {
      if (themeDarkCard) themeDarkCard.classList.add('active');
      document.documentElement.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else if (mode === 'light') {
      if (themeLightCard) themeLightCard.classList.add('active');
      document.documentElement.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    } else {
      if (themeSystemCard) themeSystemCard.classList.add('active');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark-theme');
      } else {
        document.documentElement.classList.remove('dark-theme');
      }
      localStorage.setItem('theme_mode', 'system');
    }
  }

  const currentTheme = localStorage.getItem('theme') || 'light';
  updateThemeUI(currentTheme);

  if (themeLightCard) themeLightCard.addEventListener('click', () => updateThemeUI('light'));
  if (themeDarkCard) themeDarkCard.addEventListener('click', () => updateThemeUI('dark'));
  if (themeSystemCard) themeSystemCard.addEventListener('click', () => updateThemeUI('system'));

  // ==========================================
  // 5. PRIVACY & ACCOUNT LOGOUT
  // ==========================================
  const btnLogoutDevice = document.getElementById('btn-logout-device');
  const btnLogoutAll = document.getElementById('btn-logout-all');

  if (btnLogoutDevice) {
    btnLogoutDevice.addEventListener('click', () => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      sessionStorage.clear();
      window.location.href = '/role_selection.html';
    });
  }

  if (btnLogoutAll) {
    btnLogoutAll.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {
        console.error(e);
      }
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/role_selection.html';
    });
  }
});
