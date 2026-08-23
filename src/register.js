import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  /* ==========================================
     ROLE CONFIGURATIONS (MATCHING MOCKUPS)
     ========================================== */
  const configs = {
    admin: {
      themeClass: 'theme-admin',
      bgUrl: '/hero_illustration.jpg',
      slogan: 'Smart Campus.<br>Smarter Management.',
      desc: 'A complete solution to manage students, faculty, attendance, academics and more — all in one place.',
      tags: [
        { text: 'Student Records', icon: '👥' },
        { text: 'Attendance System', icon: '📅' },
        { text: 'Leave Management', icon: '📄' },
        { text: 'Reports & Analytics', icon: '📊' }
      ],
      badgeText: 'HOD REGISTRATION',
      badgeIconSvg: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <polyline points="9 11 11 13 15 9"></polyline>
        </svg>
      `,
      welcomeHeading: 'Create HOD Account',
      welcomeSub: 'Fill in details to set up HOD credentials',
      fields: [
        { id: 'reg-id', label: 'Employee ID', type: 'text', placeholder: 'Enter HOD ID (e.g. HOD_IT01)', icon: 'user' },
        { id: 'reg-name', label: 'Full Name', type: 'text', placeholder: 'Enter your full name', icon: 'user' },
        { id: 'reg-email', label: 'Official Email', type: 'email', placeholder: 'Enter university email address', icon: 'email' },
        { id: 'reg-phone', label: 'Phone Number', type: 'text', placeholder: 'Enter 10-digit phone number', icon: 'phone' },
        { id: 'reg-department', label: 'Department', type: 'select', options: [
            'Computer Science & Engineering',
            'Information Technology',
            'Electronics & Communication Engineering',
            'Electrical & Electronics Engineering',
            'Artificial Intelligence & Data Science'
          ], icon: 'book' },
        { id: 'reg-designation', label: 'Designation', type: 'text', placeholder: 'HOD', icon: 'level' },
        { id: 'reg-password', label: 'Password', type: 'password', placeholder: 'Create password', icon: 'password' },
        { id: 'reg-confirm-password', label: 'Confirm Password', type: 'password', placeholder: 'Confirm password', icon: 'password' }
      ]
    },
    hod: null, // Will mirror admin config below
    faculty: {
      themeClass: 'theme-faculty',
      bgUrl: '/faculty_role.jpg',
      slogan: 'Inspire. Teach.<br>Shape the Future.',
      desc: 'Empowering educators with smart academic tools for a better learning experience.',
      tags: [
        { text: 'Manage Classes', icon: '👥' },
        { text: 'Mark Attendance', icon: '📅' },
        { text: 'Enter Marks', icon: '📝' },
        { text: 'Track Performance', icon: '📊' }
      ],
      badgeText: 'FACULTY REGISTRATION',
      badgeIconSvg: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      `,
      welcomeHeading: 'Create Faculty Account',
      welcomeSub: 'Fill in details to request faculty onboarding',
      fields: [
        { id: 'reg-id', label: 'Employee ID', type: 'text', placeholder: 'Enter employee ID (e.g. FAC003)', icon: 'user' },
        { id: 'reg-name', label: 'Full Name', type: 'text', placeholder: 'Enter your full name', icon: 'user' },
        { id: 'reg-email', label: 'Official Email', type: 'email', placeholder: 'Enter university email address', icon: 'email' },
        { id: 'reg-phone', label: 'Phone Number', type: 'text', placeholder: 'Enter your 10-digit phone number', icon: 'phone' },
        { id: 'reg-department', label: 'Department', type: 'select', options: [
            'Computer Science & Engineering',
            'Information Technology',
            'Electronics & Communication Engineering',
            'Electrical & Electronics Engineering',
            'Artificial Intelligence & Data Science'
          ], icon: 'book' },
        { id: 'reg-designation', label: 'Designation', type: 'text', placeholder: 'Assistant Professor / Professor', icon: 'level' },
        { id: 'reg-password', label: 'Password', type: 'password', placeholder: 'Create password', icon: 'password' },
        { id: 'reg-confirm-password', label: 'Confirm Password', type: 'password', placeholder: 'Confirm password', icon: 'password' }
      ]
    },
    student: {
      themeClass: 'theme-student',
      bgUrl: '/student_role.jpg',
      slogan: 'Dream. Learn.<br>Achieve More.',
      desc: 'Your academic journey, simplified and powered by technology.',
      tags: [
        { text: 'View Profile', icon: '👤' },
        { text: 'Attendance', icon: '📅' },
        { text: 'View Results', icon: '📊' },
        { text: 'Apply for Leave', icon: '📄' }
      ],
      badgeText: 'STUDENT REGISTRATION',
      badgeIconSvg: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
        </svg>
      `,
      welcomeHeading: 'Create Student Account',
      welcomeSub: 'Register to access student workspace details',
      fields: [
        { id: 'reg-id', label: 'Register Number', type: 'text', placeholder: 'e.g. 512724104099', icon: 'user' },
        { id: 'reg-name', label: 'Full Name', type: 'text', placeholder: 'Enter your full name', icon: 'user' },
        { id: 'reg-email', label: 'Official Email', type: 'email', placeholder: 'Enter student email address', icon: 'email' },
        { id: 'reg-phone', label: 'Phone Number', type: 'text', placeholder: 'Enter 10-digit phone number', icon: 'phone' },
        { id: 'reg-course', label: 'Course', type: 'select', options: ['B.E', 'B.Tech', 'M.E', 'M.Tech'], icon: 'book' },
        { id: 'reg-branch', label: 'Branch', type: 'select', options: [
            'Computer Science & Engineering',
            'Information Technology',
            'Electronics & Communication Engineering',
            'Electrical & Electronics Engineering',
            'Artificial Intelligence & Data Science'
          ], icon: 'book' },
        { id: 'reg-batch', label: 'Batch', type: 'text', placeholder: 'e.g. 2024–2028', icon: 'level' },
        { id: 'reg-year', label: 'Year', type: 'select', options: ['1st Year', '2nd Year', '3rd Year', '4th Year'], icon: 'level' },
        { id: 'reg-semester', label: 'Semester', type: 'select', options: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'], icon: 'level' },
        { id: 'reg-blood-group', label: 'Blood Group', type: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'], icon: 'drop' },
        { id: 'reg-dob', label: 'D.O.B', type: 'date', placeholder: '', icon: 'calendar' },
        { id: 'reg-aadhaar', label: 'Aadhaar No', type: 'text', placeholder: '12-digit Aadhaar number', icon: 'card', maxlength: 12 },
        { id: 'reg-address', label: 'Address', type: 'textarea', placeholder: 'Enter complete postal address', icon: 'home', fullWidth: true },
        { id: 'reg-password', label: 'Password', type: 'password', placeholder: 'Create password', icon: 'password' },
        { id: 'reg-confirm-password', label: 'Confirm Password', type: 'password', placeholder: 'Confirm password', icon: 'password' }
      ]
    }
  };

  configs.hod = configs.admin;

  /* ==========================================
     ROLE DETECTOR & DYNAMIC BOOTSTRAP CHECK
     ========================================== */
  const urlParams = new URLSearchParams(window.location.search);
  let role = urlParams.get('role');
  
  if (!role || (role !== 'student' && role !== 'faculty' && role !== 'hod')) {
    window.location.replace('/role_selection.html');
    return;
  }

  function setupFormWithConfig(activeRole) {
    role = activeRole;
    const currentConfig = configs[activeRole];

    // Update Container Theme Class
    const container = document.getElementById('login-theme-container');
    container.className = `login-split-wrapper ${currentConfig.themeClass}`;

    // Update Left Panel Visuals
    const leftPanelBg = document.getElementById('left-panel-bg');
    leftPanelBg.style.backgroundImage = `url('${currentConfig.bgUrl}')`;

    const slogan = document.getElementById('left-slogan');
    slogan.innerHTML = currentConfig.slogan;

    const desc = document.getElementById('left-desc');
    desc.textContent = currentConfig.desc;

    const tagsGrid = document.getElementById('left-tags-grid');
    tagsGrid.innerHTML = currentConfig.tags.map(t => `
      <div class="tag-pill-item">
        <span class="tag-pill-icon">${t.icon}</span>
        <span class="tag-pill-txt">${t.text}</span>
      </div>
    `).join('');

    // Update Right Panel Visuals
    const badgeText = document.getElementById('role-badge-text');
    badgeText.textContent = currentConfig.badgeText;

    const badgeIcon = document.getElementById('role-badge-icon');
    badgeIcon.innerHTML = currentConfig.badgeIconSvg;

    const welcomeHeading = document.getElementById('welcome-heading');
    welcomeHeading.textContent = currentConfig.welcomeHeading;

    const welcomeSub = document.getElementById('welcome-sub');
    welcomeSub.textContent = currentConfig.welcomeSub;

    // Build Dynamic Input Fields
    const fieldsContainer = document.getElementById('dynamic-register-fields');
    fieldsContainer.innerHTML = '';
    fieldsContainer.className = 'form-fields-grid-custom';

    currentConfig.fields.forEach(field => {
      const fieldItem = document.createElement('div');
      fieldItem.className = `form-field-group ${field.fullWidth ? 'full-span' : ''}`;

      let iconSvg = '';
      if (field.icon === 'user') {
        iconSvg = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        `;
      } else if (field.icon === 'email') {
        iconSvg = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
        `;
      } else if (field.icon === 'phone') {
        iconSvg = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
        `;
      } else if (field.icon === 'password') {
        iconSvg = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        `;
      } else if (field.icon === 'book') {
        iconSvg = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
        `;
      } else if (field.icon === 'level') {
        iconSvg = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        `;
      } else if (field.icon === 'card') {
        iconSvg = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
        `;
      } else if (field.icon === 'calendar') {
        iconSvg = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        `;
      } else if (field.icon === 'drop') {
        iconSvg = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
          </svg>
        `;
      } else if (field.icon === 'home') {
        iconSvg = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        `;
      }

      let toggleBtnMarkup = '';
      if (field.type === 'password') {
        toggleBtnMarkup = `
          <button type="button" class="password-toggle-trigger" id="${field.id}-toggle" aria-label="Toggle password visibility">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        `;
      }

      let inputHtml = '';
      if (field.type === 'select') {
        const opts = `<option value="" disabled selected hidden>-- Select ${field.label} --</option>` + (field.options || []).map(o => `<option value="${o}">${o}</option>`).join('');
        inputHtml = `<select id="${field.id}" required style="width:100%; border:1px solid #CBD5E1; border-radius:8px; padding:0.6rem 0.75rem 0.6rem 2.25rem; font-size:0.85rem; outline:none; background:white; color:#1E293B; font-weight:500;">${opts}</select>`;
      } else if (field.type === 'textarea') {
        inputHtml = `<textarea id="${field.id}" rows="2" placeholder="${field.placeholder}" required style="width:100%; border:1px solid #CBD5E1; border-radius:8px; padding:0.6rem 0.75rem 0.6rem 2.25rem; font-size:0.85rem; outline:none; background:white; color:#1E293B; font-family:inherit; resize:vertical; min-height:55px;"></textarea>`;
      } else {
        const maxAttr = field.maxlength ? `maxlength="${field.maxlength}"` : '';
        inputHtml = `<input type="${field.type}" id="${field.id}" placeholder="${field.placeholder}" ${maxAttr} required autocomplete="off">`;
      }

      fieldItem.innerHTML = `
        <label for="${field.id}">${field.label}</label>
        <div class="input-icon-wrapper" style="position:relative;">
          <span class="input-icon-node" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); z-index:2; color:#64748B;">${iconSvg}</span>
          ${inputHtml}
          ${toggleBtnMarkup}
        </div>
      `;

      fieldsContainer.appendChild(fieldItem);

      if (field.type === 'password') {
        const toggle = fieldItem.querySelector(`#${field.id}-toggle`);
        const inputEl = fieldItem.querySelector(`#${field.id}`);
        const svgIcon = fieldItem.querySelector('.eye-icon');
        
        if (toggle && inputEl && svgIcon) {
          toggle.addEventListener('click', () => {
            if (inputEl.type === 'password') {
              inputEl.type = 'text';
              toggle.classList.add('visible');
              svgIcon.innerHTML = `
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              `;
            } else {
              inputEl.type = 'password';
              toggle.classList.remove('visible');
              svgIcon.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              `;
            }
          });
        }
      }
    });

    const loginLink = document.getElementById('login-link-btn');
    if (loginLink) {
      loginLink.href = `/login.html?role=${activeRole}`;
    }
  }

  function showAlert(message, type = 'error') {
    const existingAlert = document.getElementById('register-alert-banner');
    if (existingAlert) {
      existingAlert.remove();
    }

    const alertDiv = document.createElement('div');
    alertDiv.id = 'register-alert-banner';
    alertDiv.style.padding = '12px 16px';
    alertDiv.style.borderRadius = '8px';
    alertDiv.style.marginBottom = '20px';
    alertDiv.style.fontSize = '14px';
    alertDiv.style.fontWeight = '500';
    alertDiv.style.display = 'flex';
    alertDiv.style.alignItems = 'center';
    alertDiv.style.gap = '10px';
    alertDiv.style.transition = 'all 0.3s ease';
    alertDiv.style.opacity = '0';
    alertDiv.style.transform = 'translateY(-10px)';

    if (type === 'error') {
      alertDiv.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
      alertDiv.style.border = '1px solid rgba(239, 68, 68, 0.2)';
      alertDiv.style.color = '#EF4444';
      alertDiv.innerHTML = `
        <span style="font-size: 16px;">⚠️</span>
        <span style="flex: 1;">${message}</span>
      `;
    } else {
      alertDiv.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
      alertDiv.style.border = '1px solid rgba(16, 185, 129, 0.2)';
      alertDiv.style.color = '#10B981';
      alertDiv.innerHTML = `
        <span style="font-size: 16px;">✅</span>
        <span style="flex: 1;">${message}</span>
      `;
    }

    const welcomeBlock = document.querySelector('.login-welcome-block');
    if (welcomeBlock) {
      welcomeBlock.parentNode.insertBefore(alertDiv, welcomeBlock.nextSibling);
      setTimeout(() => {
        alertDiv.style.opacity = '1';
        alertDiv.style.transform = 'translateY(0)';
      }, 10);
    }
  }

  async function initRegisterPage() {
    try {
      const response = await fetch('/api/auth/admin-exists');
      let data = {};
      try {
        data = await response.json();
      } catch (err) {
        data = {};
      }
      const adminExists = !!data.exists;

      if (!adminExists && data.exists !== undefined) {
        role = 'admin';
        setupFormWithConfig('admin');
        showAlert('System Setup: Register the initial HOD account to initialize the CSE Portal.', 'success');
        
        const backBtn = document.querySelector('.btn-back-role');
        if (backBtn) backBtn.style.display = 'none';
      } else {
        if (role === 'admin') {
          role = 'student';
        }
        setupFormWithConfig(role);
      }
    } catch (error) {
      console.error('Error initializing page:', error);
      setupFormWithConfig(role);
    }

    const tabStudent = document.getElementById('tab-reg-student');
    const tabFaculty = document.getElementById('tab-reg-faculty');
    if (tabStudent) {
      tabStudent.addEventListener('click', () => setupFormWithConfig('student'));
    }
    if (tabFaculty) {
      tabFaculty.addEventListener('click', () => setupFormWithConfig('faculty'));
    }
  }

  // Photo upload and cropping variables
  let cropper = null;
  let croppedPhotoBase64 = null;

  const fileInput = document.getElementById('reg-photo-file');
  const previewImage = document.getElementById('avatar-preview-image');
  const placeholder = document.getElementById('avatar-preview-placeholder');
  const trigger = document.getElementById('avatar-preview-trigger');
  const actionButtons = document.getElementById('photo-action-buttons');
  const changePhotoBtn = document.getElementById('change-photo-btn');
  const removePhotoBtn = document.getElementById('remove-photo-btn');

  // Crop Modal Elements
  const cropModal = document.getElementById('crop-modal-overlay');
  const cropImgTarget = document.getElementById('crop-image-target');
  const cropCanvas = document.getElementById('crop-canvas');
  const cropContainer = document.getElementById('crop-container');
  const cropCancelBtn = document.getElementById('crop-cancel-btn');
  const cropApplyBtn = document.getElementById('crop-apply-btn');
  const cropZoomIn = document.getElementById('crop-zoom-in');
  const cropZoomOut = document.getElementById('crop-zoom-out');

  let loadedImgObj = null;
  let cropState = {
    scale: 1,
    minScale: 1,
    maxScale: 5,
    posX: 0,
    posY: 0,
    frameSize: 280,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    initialPosX: 0,
    initialPosY: 0,
    touchDist: 0
  };

  function clampCropperPosition() {
    if (!loadedImgObj) return;
    const drawW = loadedImgObj.width * cropState.scale;
    const drawH = loadedImgObj.height * cropState.scale;
    const S = cropState.frameSize;

    const minX = S - drawW;
    const maxX = 0;
    const minY = S - drawH;
    const maxY = 0;

    cropState.posX = Math.min(Math.max(cropState.posX, minX), maxX);
    cropState.posY = Math.min(Math.max(cropState.posY, minY), maxY);
  }

  function renderCropCanvas() {
    if (!cropCanvas || !loadedImgObj) return;
    const ctx = cropCanvas.getContext('2d');
    const S = cropState.frameSize;

    if (cropCanvas.width !== S || cropCanvas.height !== S) {
      cropCanvas.width = S;
      cropCanvas.height = S;
    }

    ctx.clearRect(0, 0, S, S);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const drawW = loadedImgObj.width * cropState.scale;
    const drawH = loadedImgObj.height * cropState.scale;

    ctx.drawImage(loadedImgObj, cropState.posX, cropState.posY, drawW, drawH);
  }

  function setCropperZoom(newScale) {
    if (!loadedImgObj) return;
    const oldScale = cropState.scale;
    const clampedScale = Math.min(Math.max(newScale, cropState.minScale), cropState.maxScale);
    if (clampedScale === oldScale) return;

    const ratio = clampedScale / oldScale;
    const S = cropState.frameSize;

    cropState.posX = (S / 2) - ((S / 2) - cropState.posX) * ratio;
    cropState.posY = (S / 2) - ((S / 2) - cropState.posY) * ratio;
    cropState.scale = clampedScale;

    clampCropperPosition();
    renderCropCanvas();
  }

  function initCropperWithImage(img) {
    loadedImgObj = img;
    const S = 280;
    cropState.frameSize = S;

    cropState.minScale = Math.max(S / img.width, S / img.height);
    cropState.maxScale = cropState.minScale * 5;
    cropState.scale = cropState.minScale;

    const drawW = img.width * cropState.scale;
    const drawH = img.height * cropState.scale;
    cropState.posX = (S - drawW) / 2;
    cropState.posY = (S - drawH) / 2;

    clampCropperPosition();
    renderCropCanvas();
  }

  // Event Listeners for Custom Cropper
  if (cropContainer) {
    cropContainer.addEventListener('mousedown', (e) => {
      cropState.isDragging = true;
      cropState.dragStartX = e.clientX;
      cropState.dragStartY = e.clientY;
      cropState.initialPosX = cropState.posX;
      cropState.initialPosY = cropState.posY;
      cropContainer.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!cropState.isDragging) return;
      const dx = e.clientX - cropState.dragStartX;
      const dy = e.clientY - cropState.dragStartY;
      cropState.posX = cropState.initialPosX + dx;
      cropState.posY = cropState.initialPosY + dy;
      clampCropperPosition();
      renderCropCanvas();
    });

    window.addEventListener('mouseup', () => {
      if (cropState.isDragging) {
        cropState.isDragging = false;
        cropContainer.style.cursor = 'grab';
      }
    });

    cropContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      setCropperZoom(cropState.scale * zoomFactor);
    }, { passive: false });

    // Touch Support for Mobile Drag & Pinch-Zoom
    cropContainer.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        cropState.isDragging = true;
        cropState.dragStartX = e.touches[0].clientX;
        cropState.dragStartY = e.touches[0].clientY;
        cropState.initialPosX = cropState.posX;
        cropState.initialPosY = cropState.posY;
      } else if (e.touches.length === 2) {
        cropState.isDragging = false;
        cropState.touchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    cropContainer.addEventListener('touchmove', (e) => {
      if (cropState.isDragging && e.touches.length === 1) {
        const dx = e.touches[0].clientX - cropState.dragStartX;
        const dy = e.touches[0].clientY - cropState.dragStartY;
        cropState.posX = cropState.initialPosX + dx;
        cropState.posY = cropState.initialPosY + dy;
        clampCropperPosition();
        renderCropCanvas();
      } else if (e.touches.length === 2 && cropState.touchDist > 0) {
        const newDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scaleChange = newDist / cropState.touchDist;
        setCropperZoom(cropState.scale * scaleChange);
        cropState.touchDist = newDist;
      }
    }, { passive: true });

    cropContainer.addEventListener('touchend', () => {
      cropState.isDragging = false;
      cropState.touchDist = 0;
    });
  }

  if (cropZoomIn) {
    cropZoomIn.addEventListener('click', () => setCropperZoom(cropState.scale * 1.25));
  }
  if (cropZoomOut) {
    cropZoomOut.addEventListener('click', () => setCropperZoom(cropState.scale * 0.8));
  }

  if (trigger && fileInput) {
    trigger.addEventListener('click', () => fileInput.click());
  }

  if (changePhotoBtn && fileInput) {
    changePhotoBtn.addEventListener('click', () => fileInput.click());
  }

  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', () => {
      croppedPhotoBase64 = null;
      if (fileInput) fileInput.value = '';
      if (previewImage) {
        previewImage.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%2364748B'/%3E%3Ctext x='32' y='38' font-family='Inter,sans-serif' font-size='22' font-weight='700' fill='white' text-anchor='middle'%3E👤%3C/text%3E%3C/svg%3E";
      }
      if (placeholder) placeholder.style.display = 'flex';
      if (actionButtons) actionButtons.style.display = 'none';
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        showAlert('Please upload a valid image file (JPG, JPEG, PNG, or WEBP).', 'error');
        fileInput.value = '';
        return;
      }

      if (file.size > 20 * 1024 * 1024) {
        showAlert('File size exceeds the maximum limit of 20MB.', 'error');
        fileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          if (cropModal) cropModal.style.display = 'flex';
          initCropperWithImage(img);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (cropCancelBtn && cropModal) {
    cropCancelBtn.addEventListener('click', () => {
      cropModal.style.display = 'none';
      if (fileInput) fileInput.value = '';
    });
  }

  if (cropApplyBtn && cropModal && cropCanvas) {
    cropApplyBtn.addEventListener('click', () => {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = 400;
      exportCanvas.height = 400;
      const ctx = exportCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(cropCanvas, 0, 0, 400, 400);

      croppedPhotoBase64 = exportCanvas.toDataURL('image/jpeg', 0.9);

      if (previewImage) {
        previewImage.src = croppedPhotoBase64;
      }
      if (placeholder) placeholder.style.display = 'none';
      if (actionButtons) actionButtons.style.display = 'flex';

      cropModal.style.display = 'none';
    });
  }

  /* ==========================================
     FORM SUBMISSION & API INTEGRATION
     ========================================== */
  const registerForm = document.getElementById('register-form');
  const cardBox = document.querySelector('.login-master-card');

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('reg-id') ? document.getElementById('reg-id').value.trim() : '';
      const name = document.getElementById('reg-name') ? document.getElementById('reg-name').value.trim() : '';
      const email = document.getElementById('reg-email') ? document.getElementById('reg-email').value.trim() : '';
      const password = document.getElementById('reg-password') ? document.getElementById('reg-password').value : '';
      const confirmPassword = document.getElementById('reg-confirm-password') ? document.getElementById('reg-confirm-password').value : '';

      if (!username || !name || !email || !password || !confirmPassword) {
        showAlert('Please fill in all required fields.', 'error');
        return;
      }

      if (password !== confirmPassword) {
        showAlert('Passwords do not match.', 'error');
        return;
      }

      const submitBtn = document.getElementById('submit-action-btn');
      const submitBtnText = submitBtn.querySelector('span');

      const extraData = {};

      const phoneEl = document.getElementById('reg-phone');
      if (phoneEl) {
        extraData.phone = phoneEl.value.trim();
        const phoneDigits = extraData.phone.replace(/\D/g, '');
        if (phoneDigits.length !== 10) {
          showAlert('Phone number must be a valid 10-digit number.', 'error');
          return;
        }
      }

      const designationEl = document.getElementById('reg-designation');
      if (designationEl) extraData.designation = designationEl.value.trim();

      const deptEl = document.getElementById('reg-department');
      if (deptEl) {
        extraData.department = deptEl.value.trim();
        if ((role === 'faculty' || role === 'hod' || role === 'admin') && (!extraData.department || extraData.department === '')) {
          showAlert('Please select a valid Department.', 'error');
          return;
        }
      } else if (role === 'faculty') {
        showAlert('Department is required for faculty registration.', 'error');
        return;
      }

      const yearEl = document.getElementById('reg-year');
      if (yearEl) extraData.year = yearEl.value.trim();

      const semesterEl = document.getElementById('reg-semester');
      if (semesterEl) extraData.semester = semesterEl.value.trim();

      if (role === 'student') {
        const courseEl = document.getElementById('reg-course');
        const branchEl = document.getElementById('reg-branch');
        const batchEl = document.getElementById('reg-batch');
        const bloodGroupEl = document.getElementById('reg-blood-group');
        const dobEl = document.getElementById('reg-dob');
        const addressEl = document.getElementById('reg-address');
        const aadhaarEl = document.getElementById('reg-aadhaar');

        extraData.course = courseEl ? courseEl.value.trim() : 'B.E';
        extraData.branch = branchEl ? branchEl.value.trim() : 'Computer Science & Engineering';
        extraData.batch = batchEl ? batchEl.value.trim() : '2024-2028';
        extraData.bloodGroup = bloodGroupEl ? bloodGroupEl.value.trim() : 'Unknown';
        extraData.dob = dobEl ? dobEl.value.trim() : '';
        extraData.address = addressEl ? addressEl.value.trim() : '';
        extraData.aadhaarNo = aadhaarEl ? aadhaarEl.value.trim() : '';

        if (!extraData.course || !extraData.branch || !extraData.batch || !extraData.bloodGroup || !extraData.dob || !extraData.address || !extraData.aadhaarNo) {
          showAlert('Please fill in all required student details.', 'error');
          return;
        }

        if (!/^\d{12}$/.test(extraData.aadhaarNo)) {
          showAlert('Aadhaar number must contain exactly 12 digits.', 'error');
          return;
        }

        const dobDate = new Date(extraData.dob);
        if (isNaN(dobDate.getTime()) || dobDate > new Date()) {
          showAlert('Date of Birth cannot be a future date.', 'error');
          return;
        }
      }

      submitBtn.disabled = true;
      const originalText = submitBtnText.textContent;
      submitBtnText.textContent = 'Registering...';

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username,
            email,
            password,
            role,
            name,
            department: extraData.department,
            extraData,
            photo: croppedPhotoBase64
          })
        });

        let data = {};
        try {
          data = await response.json();
        } catch (err) {
          data = {};
        }

        if (!response.ok) {
          throw new Error(data.message || `Registration failed (${response.status}). Ensure backend API server is running.`);
        }

        const msg = data.message || 'Registration submitted successfully. Your account is waiting for HOD approval.';
        showAlert(msg, 'success');

        if (cardBox) {
          setTimeout(() => {
            cardBox.style.opacity = '0';
            cardBox.style.transform = 'translateY(-15px)';
            cardBox.style.transition = 'all 0.35s cubic-bezier(0.165, 0.84, 0.44, 1)';
          }, 1500);
        }
        
        setTimeout(() => {
          window.location.href = `/login.html?role=${role}`;
        }, 2200);

      } catch (error) {
        showAlert(error.message, 'error');
        submitBtn.disabled = false;
        submitBtnText.textContent = originalText;
      }
    });
  }

  // Initialize
  initRegisterPage();
});
