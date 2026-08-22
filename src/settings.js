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

  // Load Profile Details
  async function loadProfile() {
    try {
      const res = await fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login.html';
          return;
        }
        throw new Error('Failed to load profile details.');
      }
      const profile = await res.json();

      // Populate form
      document.getElementById('set-hod-name').value = profile.name || '';
      document.getElementById('set-hod-email').value = profile.email || '';
      document.getElementById('set-hod-phone').value = profile.phone || '';
      document.getElementById('set-hod-emp-id').value = profile.employeeId || profile.username || '';
      document.getElementById('set-hod-designation').value = profile.designation || 'Head of Department (HOD)';
      document.getElementById('set-dept-name').value = profile.department || 'Computer Science & Engineering';

      // Photo
      const photoPreview = document.getElementById('profile-photo-preview');
      const avatarSrc = (window.getAvatarUrl ? window.getAvatarUrl(profile.name, profile.photoPath) : (profile.photoPath || ''));
      if (photoPreview) photoPreview.src = avatarSrc;
      if (removeBtn) removeBtn.style.display = (profile.photoPath && profile.photoPath.trim()) ? 'inline-block' : 'none';
      document.querySelectorAll('.nav-profile-avatar img, .profile-widget-avatar img').forEach(img => {
        img.src = avatarSrc;
      });
    } catch (error) {
      showToast(error.message, false);
    }
  }

  // Save profile info
  const form = document.getElementById('profile-details-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const name = document.getElementById('set-hod-name').value;
      const email = document.getElementById('set-hod-email').value;
      const phone = document.getElementById('set-hod-phone').value;

      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, email, phone })
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || 'Failed to save changes.');
      }

      showToast('Profile configurations saved successfully!', true);
      
      // Update global displays
      document.querySelectorAll('#nav-profile-name, #sidebar-profile-name').forEach(el => {
        el.textContent = name;
      });
    } catch (error) {
      showToast(error.message, false);
    }
  });

  // Cropper variables
  let editCropper = null;
  const cropModal = document.getElementById('crop-modal-overlay');
  const cropImgTarget = document.getElementById('crop-image-target');
  const cropCancelBtn = document.getElementById('crop-cancel-btn');
  const cropApplyBtn = document.getElementById('crop-apply-btn');
  const cropZoomIn = document.getElementById('crop-zoom-in');
  const cropZoomOut = document.getElementById('crop-zoom-out');

  // Handle Photo input change
  const fileInput = document.getElementById('profile-photo-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 20 * 1024 * 1024) {
        showToast('Maximum image upload limit is 20MB.', false);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        cropImgTarget.src = reader.result;
        cropModal.style.display = 'flex';

        if (editCropper) editCropper.destroy();
        editCropper = new Cropper(cropImgTarget, {
          aspectRatio: 1,
          viewMode: 1,
          background: false,
          autoCropArea: 1,
          dragMode: 'move'
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // Zoom controls
  if (cropZoomIn) {
    cropZoomIn.addEventListener('click', () => {
      if (editCropper) editCropper.zoom(0.1);
    });
  }
  if (cropZoomOut) {
    cropZoomOut.addEventListener('click', () => {
      if (editCropper) editCropper.zoom(-0.1);
    });
  }

  // Cancel Crop
  if (cropCancelBtn) {
    cropCancelBtn.addEventListener('click', () => {
      cropModal.style.display = 'none';
      if (editCropper) {
        editCropper.destroy();
        editCropper = null;
      }
      if (fileInput) fileInput.value = '';
    });
  }

  // Crop and Save
  if (cropApplyBtn) {
    cropApplyBtn.addEventListener('click', async () => {
      if (!editCropper) return;
      const canvas = editCropper.getCroppedCanvas({ width: 300, height: 300 });
      const croppedBase64 = canvas.toDataURL('image/jpeg');

      cropModal.style.display = 'none';
      editCropper.destroy();
      editCropper = null;
      if (fileInput) fileInput.value = '';

      try {
        const res = await fetch('/api/auth/profile/photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ photoData: croppedBase64 })
        });

        const body = await res.json();
        if (!res.ok) {
          throw new Error(body.message || 'Failed to upload photo.');
        }

        showToast('Profile photo updated successfully!', true);
        await loadProfile();
      } catch (err) {
        showToast(err.message, false);
      }
    });
  }

  // Remove Photo click handler
  const removeBtn = document.getElementById('btn-remove-photo');
  if (removeBtn) {
    removeBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to remove your profile photo?')) return;

      try {
        const res = await fetch('/api/auth/profile/photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ photoData: 'REMOVE' })
        });

        const body = await res.json();
        if (!res.ok) {
          throw new Error(body.message || 'Failed to remove photo.');
        }

        showToast('Profile photo removed successfully!', true);
        await loadProfile();
      } catch (err) {
        showToast(err.message, false);
      }
    });
  }

  // Handle Password Update Form
  const passForm = document.getElementById('change-password-form');
  if (passForm) {
    passForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const oldPassword = document.getElementById('set-curr-pass').value;
        const newPassword = document.getElementById('set-new-pass').value;

        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ oldPassword, newPassword })
        });

        const body = await res.json();
        if (!res.ok) {
          throw new Error(body.message || 'Failed to update password.');
        }

        showToast('Password updated successfully!', true);
        passForm.reset();
      } catch (error) {
        showToast(error.message, false);
      }
    });
  }

  // Load profile on start
  await loadProfile();
});
