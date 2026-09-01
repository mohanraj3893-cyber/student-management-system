import './api_config.js';
import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  /* ==========================================
     ROLE CONFIGURATIONS (MATCHING MOCKUPS)
     ========================================== */
  const configs = {
    admin: {
      themeClass: 'theme-admin',
      bgUrl: '/hero_illustration.jpg', // realistic CS department building
      slogan: 'Smart Campus.<br>Smarter Management.',
      desc: 'A complete solution to manage students, faculty, attendance, academics and more — all in one place.',
      tags: [
        { text: 'Student Records', icon: '👥' },
        { text: 'Attendance System', icon: '📅' },
        { text: 'Leave Management', icon: '📄' },
        { text: 'Reports & Analytics', icon: '📊' }
      ],
      badgeText: 'HOD LOGIN',
      badgeIconSvg: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <polyline points="9 11 11 13 15 9"></polyline>
        </svg>
      `,
      welcomeHeading: 'Welcome Back, HOD!',
      welcomeSub: 'Sign in to access the HOD dashboard',
      idLabel: 'HOD ID / Email',
      idPlaceholder: 'Enter your HOD ID or email'
    },
    faculty: {
      themeClass: 'theme-faculty',
      bgUrl: '/faculty_role.jpg', // realistic classroom
      slogan: 'Inspire. Teach.<br>Shape the Future.',
      desc: 'Empowering educators with smart academic tools for a better learning experience.',
      tags: [
        { text: 'Manage Classes', icon: '👥' },
        { text: 'Mark Attendance', icon: '📅' },
        { text: 'Enter Marks', icon: '📝' },
        { text: 'Track Performance', icon: '📊' }
      ],
      badgeText: 'FACULTY LOGIN',
      badgeIconSvg: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      `,
      welcomeHeading: 'Welcome Back, Faculty!',
      welcomeSub: 'Sign in to manage your classes and students',
      idLabel: 'Employee ID / Email',
      idPlaceholder: 'Enter your employee ID or email'
    },
    student: {
      themeClass: 'theme-student',
      bgUrl: '/student_role.jpg', // realistic library/study
      slogan: 'Dream. Learn.<br>Achieve More.',
      desc: 'Your academic journey, simplified and powered by technology.',
      tags: [
        { text: 'View Profile', icon: '👤' },
        { text: 'Attendance', icon: '📅' },
        { text: 'View Results', icon: '📊' },
        { text: 'Apply for Leave', icon: '📄' }
      ],
      badgeText: 'STUDENT LOGIN',
      badgeIconSvg: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
        </svg>
      `,
      welcomeHeading: 'Welcome Back, Student!',
      welcomeSub: 'Sign in to access your academic portal',
      idLabel: 'Register Number / Email',
      idPlaceholder: 'Enter your register number or email'
    }
  };

  /* ==========================================
     CONTROLLER DETECT URL PARAMETER
     ========================================== */
  const urlParams = new URLSearchParams(window.location.search);
  let role = urlParams.get('role');
  if (role && role.toLowerCase() === 'hod') role = 'admin';
  
  // Default to admin if parameter is empty or incorrect
  if (!role || !configs[role]) {
    role = 'admin';
  }

  const currentConfig = configs[role];

  // Update Container Class
  const container = document.getElementById('login-theme-container');
  container.className = `login-split-wrapper ${currentConfig.themeClass}`;

  // Update Left Panel Details
  const leftPanelBg = document.getElementById('left-panel-bg');
  leftPanelBg.style.backgroundImage = `url('${currentConfig.bgUrl}')`;

  const slogan = document.getElementById('left-slogan');
  slogan.innerHTML = currentConfig.slogan;

  const desc = document.getElementById('left-desc');
  desc.textContent = currentConfig.desc;

  // Build Left Panel Checklist Tags
  const tagsGrid = document.getElementById('left-tags-grid');
  tagsGrid.innerHTML = ''; // clear placeholders
  currentConfig.tags.forEach(tag => {
    const tagNode = document.createElement('div');
    tagNode.className = 'left-panel-tag-card';
    tagNode.innerHTML = `
      <span class="tag-card-icon">${tag.icon}</span>
      <span class="tag-card-text">${tag.text}</span>
    `;
    tagsGrid.appendChild(tagNode);
  });

  // Update Right Panel Badge
  const badgeIcon = document.getElementById('role-badge-icon');
  badgeIcon.innerHTML = currentConfig.badgeIconSvg;

  const badgeText = document.getElementById('role-badge-text');
  badgeText.textContent = currentConfig.badgeText;

  // Update Form Headings
  const welcomeHeading = document.getElementById('welcome-heading');
  welcomeHeading.textContent = currentConfig.welcomeHeading;

  const welcomeSub = document.getElementById('welcome-sub');
  welcomeSub.textContent = currentConfig.welcomeSub;

  // Update Inputs
  const idLabel = document.getElementById('login-id-label');
  idLabel.textContent = currentConfig.idLabel;

  const idInput = document.getElementById('login-id');
  idInput.placeholder = currentConfig.idPlaceholder;

  // Dynamically route registration link to the registration portal with active role
  const registerPrompt = document.querySelector('.login-register-prompt');
  if (registerPrompt) {
    const regRole = (role === 'admin' || role === 'hod') ? 'hod' : role;
    registerPrompt.style.display = 'block';
    registerPrompt.innerHTML = `
      New to the portal? <a href="/register.html?role=${regRole}" class="login-register-link" id="register-link-btn">Register Now</a>
    `;
  }

  /* ==========================================
     PASSWORD SHOW/HIDE INTERACTION
     ========================================== */
  const passwordInput = document.getElementById('login-password');
  const toggleBtn = document.getElementById('password-toggle-btn');
  const eyeIcon = document.getElementById('eye-icon');

  if (toggleBtn && passwordInput && eyeIcon) {
    toggleBtn.addEventListener('click', () => {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.classList.add('visible');
        // Modify eye icon to slashed state
        eyeIcon.innerHTML = `
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
      } else {
        passwordInput.type = 'password';
        toggleBtn.classList.remove('visible');
        // Restore standard eye icon
        eyeIcon.innerHTML = `
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        `;
      }
    });
  }

  /* ==========================================
     PAGE ENTRY ANIMATION FADE IN & REDIRECT SUBMIT
     ========================================== */
  const loginForm = document.getElementById('login-form');
  const loginBox = document.querySelector('.login-card-inner');

  function showAlert(message, type = 'error') {
    const existingAlert = document.getElementById('login-alert-banner');
    if (existingAlert) {
      existingAlert.remove();
    }

    const alertDiv = document.createElement('div');
    alertDiv.id = 'login-alert-banner';
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
  
  if (loginBox) {
    loginBox.style.opacity = '0';
    loginBox.style.transform = 'translateY(15px)';
    loginBox.style.transition = 'all 0.5s ease-out';
    
    setTimeout(() => {
      loginBox.style.opacity = '1';
      loginBox.style.transform = 'translateY(0)';
    }, 100);
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = idInput.value.trim();
      const password = passwordInput.value;
      const submitBtn = document.getElementById('submit-action-btn');
      const submitBtnText = submitBtn.querySelector('span');

      // Set loading state
      submitBtn.disabled = true;
      const originalText = submitBtnText.textContent;
      submitBtnText.textContent = 'Signing in...';

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password })
        });

        let data = {};
        try {
          data = await response.json();
        } catch (err) {
          data = {};
        }

        if (!response.ok) {
          throw new Error(data.message || `Login failed (${response.status}). Please check credentials.`);
        }

        // Clear any previous session or cached state completely
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user));

        showAlert('Login successful! Redirecting...', 'success');

        if (loginBox) {
          setTimeout(() => {
            loginBox.style.opacity = '0';
            loginBox.style.transform = 'translateY(-15px)';
            loginBox.style.transition = 'all 0.35s cubic-bezier(0.165, 0.84, 0.44, 1)';
          }, 500);
        }
        
        setTimeout(() => {
          if (role === 'student') {
            window.location.href = '/student_dashboard.html';
          } else if (role === 'faculty') {
            window.location.href = '/faculty_dashboard.html';
          } else {
            window.location.href = '/dashboard.html';
          }
        }, 900);

      } catch (error) {
        showAlert(error.message, 'error');
        submitBtn.disabled = false;
        submitBtnText.textContent = originalText;
      }
    });
  }
});
