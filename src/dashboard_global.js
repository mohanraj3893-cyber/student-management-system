import './api_config.js';
import './style.css';
import { initPushNotifications } from './push_notifications.js';

// Ensure PWA Manifest link exists in document head
if (!document.querySelector('link[rel="manifest"]')) {
  const manifestLink = document.createElement('link');
  manifestLink.rel = 'manifest';
  manifestLink.href = '/manifest.webmanifest';
  document.head.appendChild(manifestLink);
}

document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================
     0. DYNAMIC ACCENT COLOR THEME INJECTION (FACULTY / STUDENT / ADMIN)
     ========================================== */
  const path = window.location.pathname.toLowerCase();
  if (path.includes('faculty_')) {
    // Faculty Theme: Light Green
    document.documentElement.style.setProperty('--primary-blue', '#0F9D58');
    document.documentElement.style.setProperty('--dark-blue', '#0B7E45');
    document.documentElement.style.setProperty('--light-blue', '#E6F6ED');
    document.documentElement.style.setProperty('--primary-gradient', 'linear-gradient(135deg, #0F9D58 0%, #0B7E45 100%)');
    document.documentElement.style.setProperty('--hover-gradient', 'linear-gradient(135deg, #0B7E45 0%, #085E33 100%)');
    document.documentElement.style.setProperty('--shadow-md', '0 8px 24px rgba(15, 157, 88, 0.08)');
    document.documentElement.style.setProperty('--shadow-lg', '0 16px 40px rgba(15, 157, 88, 0.1)');
    document.documentElement.style.setProperty('--primary-blue-alpha', 'rgba(15, 157, 88, 0.25)');
  } else if (path.includes('student_')) {
    // Student Theme: Violet/Purple
    document.documentElement.style.setProperty('--primary-blue', '#6A1B9A');
    document.documentElement.style.setProperty('--dark-blue', '#55147C');
    document.documentElement.style.setProperty('--light-blue', '#F1E8FB');
    document.documentElement.style.setProperty('--primary-gradient', 'linear-gradient(135deg, #6A1B9A 0%, #55147C 100%)');
    document.documentElement.style.setProperty('--hover-gradient', 'linear-gradient(135deg, #55147C 0%, #420D62 100%)');
    document.documentElement.style.setProperty('--shadow-md', '0 8px 24px rgba(106, 27, 154, 0.08)');
    document.documentElement.style.setProperty('--shadow-lg', '0 16px 40px rgba(106, 27, 154, 0.1)');
    document.documentElement.style.setProperty('--primary-blue-alpha', 'rgba(106, 27, 154, 0.25)');
  } else {
    // Admin/HOD Theme: Professional Blue
    document.documentElement.style.setProperty('--primary-blue', '#0056D2');
    document.documentElement.style.setProperty('--dark-blue', '#0043A4');
    document.documentElement.style.setProperty('--light-blue', '#E6F0FD');
    document.documentElement.style.setProperty('--primary-gradient', 'linear-gradient(135deg, #0056D2 0%, #0043A4 100%)');
    document.documentElement.style.setProperty('--hover-gradient', 'linear-gradient(135deg, #0043A4 0%, #003078 100%)');
    document.documentElement.style.setProperty('--shadow-md', '0 8px 24px rgba(0, 86, 210, 0.08)');
    document.documentElement.style.setProperty('--shadow-lg', '0 16px 40px rgba(0, 86, 210, 0.1)');
    document.documentElement.style.setProperty('--primary-blue-alpha', 'rgba(0, 86, 210, 0.25)');
  }

  /* ==========================================
     1. SIDEBAR COLLAPSE CONTROL (WITH STATE PERSISTENCE)
     ========================================== */
  const sidebar = document.getElementById('dashboard-sidebar');
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  const mainWorkspace = document.querySelector('.main-workspace-panel');

  // Load and apply previous sidebar state (Desktop only)
  const isMobile = window.innerWidth <= 768;
  if (!isMobile && localStorage.getItem('sidebar-collapsed') === 'true' && sidebar && mainWorkspace) {
    sidebar.classList.add('collapsed');
    mainWorkspace.classList.add('sidebar-collapsed');
  } else if (sidebar && mainWorkspace) {
    sidebar.classList.remove('collapsed');
    mainWorkspace.classList.remove('sidebar-collapsed');
  }

  // Remove initialization class to release CSS transitions safely after a tiny timeout
  setTimeout(() => {
    document.documentElement.classList.remove('sidebar-collapsed-init');
    document.documentElement.classList.remove('no-transition');
  }, 50);

  if (collapseBtn && sidebar && mainWorkspace) {
    collapseBtn.addEventListener('click', () => {
      const currentlyCollapsed = sidebar.classList.toggle('collapsed');
      mainWorkspace.classList.toggle('sidebar-collapsed');
      
      // Persist in localStorage
      localStorage.setItem('sidebar-collapsed', currentlyCollapsed ? 'true' : 'false');
    });
  }

  /* ==========================================
     2. DARK MODE THEME CONTROL (WITH STATE PERSISTENCE)
     ========================================== */
  const themeToggle = document.getElementById('theme-toggle-btn');
  const currentTheme = localStorage.getItem('theme');
  
  if (currentTheme === 'dark') {
    document.documentElement.classList.add('dark-theme');
    updateThemeIcon(true);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark-theme');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      updateThemeIcon(isDark);
    });
  }

  function updateThemeIcon(isDark) {
    if (!themeToggle) return;
    if (isDark) {
      themeToggle.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `;
    } else {
      themeToggle.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      `;
    }
  }

  /* ==========================================
     3. DELEGATE SUBMIT ON LOGIN FADE OUT
     ========================================== */
  const loginForm = document.getElementById('login-form');
  const loginBox = document.querySelector('.login-card-inner');

  if (loginForm && loginBox) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      loginBox.style.opacity = '0';
      loginBox.style.transform = 'translateY(-15px)';
      loginBox.style.transition = 'all 0.35s cubic-bezier(0.165, 0.84, 0.44, 1)';
      
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 300);
    });
  }

  /* ==========================================
     MOBILE DRAWER NAVIGATION (DYNAMIC TOPBAR & TOGGLE)
     ========================================== */
  function setupMobileDrawer() {
    const sidebar = document.getElementById('dashboard-sidebar') || document.querySelector('.sidebar-panel');
    if (!sidebar) return;

    const path = window.location.pathname.toLowerCase();
    const isFacultyPage = path.includes('faculty_');
    const isStudentPage = path.includes('student_');
    const isAdminPage = !isFacultyPage && !isStudentPage;

    const themeColor = isFacultyPage ? '#059669' : (isStudentPage ? '#6A1B9A' : '#0056D2');
    const portalSubtitle = isFacultyPage ? 'FACULTY WORKSPACE' : (isStudentPage ? 'STUDENT PORTAL' : 'DEPARTMENT PORTAL');
    const profileHref = isFacultyPage ? '/faculty_my_profile.html' : (isStudentPage ? '/student_my_profile.html' : '/settings.html');

    let topbar = document.querySelector('.mobile-header-bar');
    if (!topbar) {
      topbar = document.createElement('div');
      topbar.className = 'mobile-header-bar';
      topbar.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <button id="mobile-menu-toggle" aria-label="Toggle Navigation Menu" style="background:transparent; border:none; color:inherit; cursor:pointer; padding:4px; font-size:1.3rem; display:flex; align-items:center; border-radius:6px; min-height:44px; min-width:40px; justify-content:center;">
            ☰
          </button>
          <div style="width:34px; height:34px; border-radius:50%; background:${themeColor}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#FFFFFF"/><path d="M2 17L12 22L22 17" stroke="#FFFFFF" stroke-width="2"/><path d="M2 12L12 17L22 12" stroke="#FFFFFF" stroke-width="2"/></svg>
          </div>
          <div style="display:flex; flex-direction:column;">
            <span style="font-weight:800; font-size:0.95rem; font-family: var(--font-primary); color:${themeColor}; line-height:1.1;">CSE Portal</span>
            <span style="font-size:0.65rem; color:#64748B; font-weight:600; text-transform:uppercase; letter-spacing:0.03em;">${portalSubtitle}</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <button id="mobile-notif-btn" class="notification-bell-btn" aria-label="Notifications" style="background:#F1F5F9; border:none; color:#1E293B; cursor:pointer; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; position:relative; font-size:1rem;">
            🔔
            <span class="bell-badge-count" style="position:absolute; top:-2px; right:-2px; width:16px; height:16px; background:#EF4444; color:white; font-size:10px; font-weight:700; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid white;">4</span>
          </button>
          <button id="mobile-theme-btn" aria-label="Toggle Dark Mode" style="background:#F1F5F9; border:none; color:#1E293B; cursor:pointer; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1rem;">
            🌙
          </button>
          <a href="${profileHref}" class="mobile-profile-link" aria-label="My Profile" style="color:inherit; text-decoration:none; display:flex; align-items:center; justify-content:center;">
            <div style="width:36px; height:36px; border-radius:50%; overflow:hidden; border:2px solid ${themeColor};">
              <img class="mobile-avatar-img" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%230056D2'/%3E%3Ctext x='32' y='41' font-family='Inter, sans-serif' font-size='28' font-weight='700' fill='white' text-anchor='middle'%3EU%3C/text%3E%3C/svg%3E" alt="Avatar" style="width:100%; height:100%; object-fit:cover;">
            </div>
          </a>
        </div>
      `;
      document.body.insertBefore(topbar, document.body.firstChild);

      const themeBtn = document.getElementById('mobile-theme-btn');
      if (themeBtn) {
        themeBtn.addEventListener('click', () => {
          const isDark = document.documentElement.classList.toggle('dark-theme');
          localStorage.setItem('theme', isDark ? 'dark' : 'light');
          themeBtn.textContent = isDark ? '☀️' : '🌙';
        });
      }
    }

    let backdrop = document.querySelector('.mobile-sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'mobile-sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    const toggleBtns = document.querySelectorAll('#mobile-menu-toggle, #sidebar-collapse-btn, .btn-sidebar-collapse');
    toggleBtns.forEach(toggleBtn => {
      if (toggleBtn && !toggleBtn.dataset.bound) {
        toggleBtn.dataset.bound = 'true';
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = sidebar.classList.toggle('mobile-open');
          backdrop.classList.toggle('active', isOpen);
          document.body.style.overflow = isOpen ? 'hidden' : '';
        });
      }
    });

    if (backdrop && !backdrop.dataset.bound) {
      backdrop.dataset.bound = 'true';
      backdrop.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
      });
    }

    sidebar.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('mobile-open');
          backdrop.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    });
  }

  setupMobileDrawer();

  /* ==========================================
     MOBILE BOTTOM NAVIGATION & MORE MENU SHEET
     ========================================== */
  function setupMobileBottomNav() {
    const currentPath = window.location.pathname.toLowerCase();
    const isFaculty = currentPath.includes('faculty_');
    const isStudent = currentPath.includes('student_');
    const isAdmin = !isFaculty && !isStudent;

    if (!document.querySelector('.mobile-bottom-nav')) {
      const bottomNav = document.createElement('nav');
      bottomNav.className = 'mobile-bottom-nav';

      if (isFaculty) {
        const isDash = currentPath.includes('faculty_dashboard.html');
        const isStud = currentPath.includes('faculty_students.html');
        const isAtt = currentPath.includes('faculty_attendance.html');
        const isMarks = currentPath.includes('faculty_marks.html');
        const isClassIncharge = sessionStorage.getItem('sms_is_class_incharge') !== 'false';

        if (isClassIncharge) {
          bottomNav.innerHTML = `
            <a href="/faculty_dashboard.html" class="mobile-nav-item ${isDash ? 'active' : ''}">
              <span class="mobile-nav-icon">🏠</span>
              <span class="mobile-nav-label">Dashboard</span>
            </a>
            <a href="/faculty_students.html" class="mobile-nav-item ${isStud ? 'active' : ''}">
              <span class="mobile-nav-icon">👥</span>
              <span class="mobile-nav-label">Students</span>
            </a>
            <a href="/faculty_attendance.html" class="mobile-nav-item ${isAtt ? 'active' : ''}">
              <span class="mobile-nav-icon">📅</span>
              <span class="mobile-nav-label">Attendance</span>
            </a>
            <a href="/faculty_marks.html" class="mobile-nav-item ${isMarks ? 'active' : ''}">
              <span class="mobile-nav-icon">📊</span>
              <span class="mobile-nav-label">Exams & Marks</span>
            </a>
            <button id="mobile-more-btn" class="mobile-nav-item">
              <span class="mobile-nav-icon">💬</span>
              <span class="mobile-nav-label">More</span>
            </button>
          `;
        } else {
          bottomNav.innerHTML = `
            <a href="/faculty_dashboard.html" class="mobile-nav-item ${isDash ? 'active' : ''}">
              <span class="mobile-nav-icon">🏠</span>
              <span class="mobile-nav-label">Dashboard</span>
            </a>
            <a href="/faculty_students.html" class="mobile-nav-item ${isStud ? 'active' : ''}">
              <span class="mobile-nav-icon">👥</span>
              <span class="mobile-nav-label">Students</span>
            </a>
            <a href="/faculty_marks.html" class="mobile-nav-item ${isMarks ? 'active' : ''}">
              <span class="mobile-nav-icon">📊</span>
              <span class="mobile-nav-label">Exams & Marks</span>
            </a>
            <button id="mobile-more-btn" class="mobile-nav-item">
              <span class="mobile-nav-icon">💬</span>
              <span class="mobile-nav-label">More</span>
            </button>
          `;
        }
      } else if (isStudent) {
        const isDash = currentPath.includes('student_dashboard.html');
        const isAtt = currentPath.includes('student_attendance.html');
        const isMarks = currentPath.includes('student_marks.html');
        const isLeave = currentPath.includes('student_leave.html');

        bottomNav.innerHTML = `
          <a href="/student_dashboard.html" class="mobile-nav-item ${isDash ? 'active' : ''}">
            <span class="mobile-nav-icon">🏠</span>
            <span class="mobile-nav-label">Dashboard</span>
          </a>
          <a href="/student_attendance.html" class="mobile-nav-item ${isAtt ? 'active' : ''}">
            <span class="mobile-nav-icon">📊</span>
            <span class="mobile-nav-label">Attendance</span>
          </a>
          <a href="/student_marks.html" class="mobile-nav-item ${isMarks ? 'active' : ''}">
            <span class="mobile-nav-icon">📋</span>
            <span class="mobile-nav-label">Marks</span>
          </a>
          <a href="/student_leave.html" class="mobile-nav-item ${isLeave ? 'active' : ''}">
            <span class="mobile-nav-icon">📝</span>
            <span class="mobile-nav-label">Leave</span>
          </a>
          <button id="mobile-more-btn" class="mobile-nav-item">
            <span class="mobile-nav-icon">☰</span>
            <span class="mobile-nav-label">More</span>
          </button>
        `;
      } else {
        const isDash = currentPath.includes('dashboard.html') || currentPath === '/';
        const isStud = currentPath.includes('students.html');
        const isAtt = currentPath.includes('attendance.html');
        const isLeave = currentPath.includes('leave.html');
        const isMore = currentPath.includes('reports.html') || currentPath.includes('settings.html') || currentPath.includes('faculty.html');

        bottomNav.innerHTML = `
          <a href="/dashboard.html" class="mobile-nav-item ${isDash ? 'active' : ''}">
            <span class="mobile-nav-icon">🏠</span>
            <span class="mobile-nav-label">Dashboard</span>
          </a>
          <a href="/students.html" class="mobile-nav-item ${isStud ? 'active' : ''}">
            <span class="mobile-nav-icon">🎓</span>
            <span class="mobile-nav-label">Students</span>
          </a>
          <a href="/attendance.html" class="mobile-nav-item ${isAtt ? 'active' : ''}">
            <span class="mobile-nav-icon">📅</span>
            <span class="mobile-nav-label">Attendance</span>
          </a>
          <a href="/leave.html" class="mobile-nav-item ${isLeave ? 'active' : ''}">
            <span class="mobile-nav-icon">📑</span>
            <span class="mobile-nav-label">Leave Requests</span>
          </a>
          <button id="mobile-more-btn" class="mobile-nav-item ${isMore ? 'active' : ''}">
            <span class="mobile-nav-icon">•••</span>
            <span class="mobile-nav-label">More</span>
          </button>
        `;
      }

      document.body.appendChild(bottomNav);

      const sheet = document.createElement('div');
      sheet.id = 'mobile-more-sheet';
      sheet.className = 'mobile-bottom-sheet';

      if (isFaculty) {
        sheet.innerHTML = `
          <div class="mobile-sheet-backdrop"></div>
          <div class="mobile-sheet-content">
            <div class="mobile-sheet-handle"></div>
            <h3 class="mobile-sheet-title">Faculty Workspace Options</h3>
            <div class="mobile-sheet-grid">
              <a href="/faculty_my_profile.html" class="mobile-sheet-item">
                <span class="sheet-item-icon">👤</span>
                <span class="sheet-item-text">My Profile</span>
              </a>
              <a href="/faculty_assignments.html" class="mobile-sheet-item">
                <span class="sheet-item-icon">📝</span>
                <span class="sheet-item-text">Assignments</span>
              </a>
              <a href="/faculty_announcements.html" class="mobile-sheet-item">
                <span class="sheet-item-icon">📣</span>
                <span class="sheet-item-text">Announcements</span>
              </a>
              <a href="/faculty_resources.html" class="mobile-sheet-item">
                <span class="sheet-item-icon">📁</span>
                <span class="sheet-item-text">Study Resources</span>
              </a>
              <a href="/faculty_requests.html" class="mobile-sheet-item">
                <span class="sheet-item-icon">📄</span>
                <span class="sheet-item-text">Leave Requests</span>
              </a>
              <button id="mobile-logout-btn" class="mobile-sheet-item text-danger">
                <span class="sheet-item-icon">🚪</span>
                <span class="sheet-item-text">Logout</span>
              </button>
            </div>
          </div>
        `;
      } else if (isStudent) {
        sheet.innerHTML = `
          <div class="mobile-sheet-backdrop"></div>
          <div class="mobile-sheet-content">
            <div class="mobile-sheet-handle"></div>
            <h3 class="mobile-sheet-title">Student Portal Options</h3>
            <div class="mobile-sheet-grid">
              <a href="/student_my_profile.html" class="mobile-sheet-item">
                <span class="sheet-item-icon">👤</span>
                <span class="sheet-item-text">My Profile</span>
              </a>
              <a href="/student_subjects.html" class="mobile-sheet-item">
                <span class="sheet-item-icon">📚</span>
                <span class="sheet-item-text">Course Materials</span>
              </a>
              <a href="/student_settings.html" class="mobile-sheet-item">
                <span class="sheet-item-icon">⚙️</span>
                <span class="sheet-item-text">Settings</span>
              </a>
              <a href="/announcements.html" class="mobile-sheet-item">
                <span class="sheet-item-icon">🔔</span>
                <span class="sheet-item-text">Notifications</span>
              </a>
              <button id="mobile-logout-btn" class="mobile-sheet-item text-danger">
                <span class="sheet-item-icon">🚪</span>
                <span class="sheet-item-text">Logout</span>
              </button>
            </div>
          </div>
        `;
      } else {
        sheet.innerHTML = `
          <div class="mobile-sheet-backdrop"></div>
          <div class="mobile-sheet-content">
            <div class="mobile-sheet-handle"></div>
            <h3 class="mobile-sheet-title">Department Management</h3>
            <div class="mobile-sheet-grid">
              <a href="/faculty.html" class="mobile-sheet-item">
                <span class="sheet-item-icon">🏛</span>
                <span class="sheet-item-text">Faculty</span>
              </a>
              <a href="/subjects.html" class="mobile-sheet-item">
                <span class="sheet-item-icon">📚</span>
                <span class="sheet-item-text">Subjects</span>
              </a>
              <a href="/marks.html" class="mobile-sheet-item">
                <span class="sheet-item-icon">📊</span>
                <span class="sheet-item-text">Marks</span>
              </a>
              <a href="/reports.html" class="mobile-sheet-item">
                <span class="sheet-item-icon">📄</span>
                <span class="sheet-item-text">Reports</span>
              </a>
              <a href="/settings.html" class="mobile-sheet-item">
                <span class="sheet-item-icon">⚙️</span>
                <span class="sheet-item-text">Settings</span>
              </a>
              <button id="mobile-logout-btn" class="mobile-sheet-item text-danger">
                <span class="sheet-item-icon">🚪</span>
                <span class="sheet-item-text">Logout</span>
              </button>
            </div>
          </div>
        `;
      }
      document.body.appendChild(sheet);

      const moreBtn = document.getElementById('mobile-more-btn');
      const sheetBackdrop = sheet.querySelector('.mobile-sheet-backdrop');
      const logoutBtn = document.getElementById('mobile-logout-btn');

      if (moreBtn) {
        moreBtn.addEventListener('click', () => {
          sheet.classList.add('active');
          document.body.style.overflow = 'hidden';
        });
      }

      if (sheetBackdrop) {
        sheetBackdrop.addEventListener('click', () => {
          sheet.classList.remove('active');
          document.body.style.overflow = '';
        });
      }

      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          localStorage.removeItem('accessToken');
          sessionStorage.removeItem('sms_user_profile_cache');
          window.location.href = '/login.html';
        });
      }
    }
  }

  setupMobileBottomNav();

  /* ==========================================
     4. DYNAMIC DATA & PROFILE LOADER WITH FAST CACHING
     ========================================== */
  async function loadDashboardData() {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (!token) {
      window.location.href = '/login.html';
      return;
    }

    // 0. Fast Instant Render from Session Cache
    const cachedStr = sessionStorage.getItem('sms_user_profile_cache');
    if (cachedStr) {
      try {
        const cachedData = JSON.parse(cachedStr);
        // Mark as from-cache so route guards do NOT redirect based on potentially stale data
        cachedData._fromCache = true;
        populateDashboardUI(cachedData);
      } catch (e) {}
    }

    try {
      const res = await fetch('/api/dashboard/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          sessionStorage.removeItem('sms_user_profile_cache');
          window.location.href = '/login.html';
          return;
        }
        throw new Error('Failed to fetch dashboard stats.');
      }

      const data = await res.json();
      sessionStorage.setItem('sms_user_profile_cache', JSON.stringify(data));
      populateDashboardUI(data);

      // Enable notification system for all roles (Admin, Faculty, Student)
      initNotificationSystem(token, data.user.role);

      // Initialize Real-Time WebSocket connection
      initRealtimeClient(token, data.user.role);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }

  function initRealtimeClient(token, role) {
    if (window.smsSocketConnected) return;

    function connectSocket() {
      if (!window.io) return;
      const socket = window.io({
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      });

      window.smsSocketConnected = true;
      window.smsSocket = socket;

      socket.on('connect', () => {
        console.log('⚡ Connected to Real-Time Socket.IO server.');
      });

      const handleRealtimeEvent = (data) => {
        // Update bell badge counter
        document.querySelectorAll('.bell-badge-count').forEach(badge => {
          const curr = parseInt(badge.textContent || '0') || 0;
          const next = curr + 1;
          badge.textContent = next;
          badge.style.display = 'flex';
        });

        // Broadcast DOM custom event for page-specific live updates without refresh
        window.dispatchEvent(new CustomEvent('sms:realtime_event', { detail: data }));
      };

      socket.on('NEW_STUDENT_REGISTRATION', handleRealtimeEvent);
      socket.on('NEW_FACULTY_REGISTRATION', handleRealtimeEvent);
      socket.on('LEAVE_REQUEST_CREATED', handleRealtimeEvent);
      socket.on('LEAVE_REQUEST_APPROVED', handleRealtimeEvent);
      socket.on('LEAVE_REQUEST_REJECTED', handleRealtimeEvent);
      socket.on('ANNOUNCEMENT_PUBLISHED', handleRealtimeEvent);
      socket.on('REGISTRATION_APPROVED', handleRealtimeEvent);
      socket.on('REGISTRATION_REJECTED', handleRealtimeEvent);
      socket.on('CLASS_INCHARGE_ASSIGNED', handleRealtimeEvent);
      socket.on('REGISTRATION_LIST_CHANGED', handleRealtimeEvent);
    }

    if (!window.io && !document.getElementById('socket-io-js')) {
      const s = document.createElement('script');
      s.id = 'socket-io-js';
      s.src = '/socket.io/socket.io.js';
      s.onload = connectSocket;
      document.head.appendChild(s);
    } else {
      connectSocket();
    }
  }

  function populateDashboardUI(data) {
    const currentPath = window.location.pathname.toLowerCase();
    const userRole = data.user.role; // 'admin', 'faculty', 'student'

    document.body.classList.remove('theme-student', 'theme-faculty', 'theme-admin');
    document.body.classList.add(`theme-${userRole}`);

    if (userRole === 'student') {
      if (
        !currentPath.includes('student_') && 
        !currentPath.endsWith('announcements.html') && 
        !currentPath.endsWith('login.html') && 
        !currentPath.endsWith('role_selection.html') && 
        !currentPath.endsWith('register.html') &&
        currentPath !== '/' &&
        currentPath !== '/index.html'
      ) {
        window.location.href = '/student_dashboard.html';
        return;
      }
    } else if (userRole === 'faculty') {
      const isClassIncharge = Boolean(data.user && data.user.isClassIncharge);
      sessionStorage.setItem('sms_is_class_incharge', isClassIncharge ? 'true' : 'false');

      // If not a class incharge, hide the Attendance nav link and dashboard tile.
      // DO NOT redirect away from faculty_attendance – the page itself shows
      // a friendly "No class assigned" message for non-class-incharge faculty.
      if (!isClassIncharge) {
        const isOnAttendancePage = currentPath.includes('faculty_attendance');
        if (!isOnAttendancePage) {
          document.querySelectorAll('a[href*="faculty_attendance.html"]').forEach(link => {
            const item = link.closest('li, .mobile-nav-item, .bottom-nav-item');
            if (item) {
              item.style.display = 'none';
            } else {
              link.style.display = 'none';
            }
          });
          document.querySelectorAll('[onclick*="faculty_attendance.html"]').forEach(tile => {
            tile.style.display = 'none';
          });
        }
      }

      // If on any attendance page, completely bypass all redirects – attendance pages manage their own state
      if (currentPath.includes('attendance')) {
        console.log('[DashboardGlobal] On attendance page – all global redirects bypassed.');
        return;
      }

      if (
        !currentPath.includes('faculty_') && 
        !currentPath.includes('student_profile.html') &&
        !currentPath.endsWith('announcements.html') && 
        !currentPath.endsWith('login.html') && 
        !currentPath.endsWith('role_selection.html') && 
        !currentPath.endsWith('register.html') &&
        currentPath !== '/' &&
        currentPath !== '/index.html'
      ) {
        console.warn('[DashboardGlobal] Redirecting faculty to faculty_dashboard.html from', currentPath);
        window.location.href = '/faculty_dashboard.html';
        return;
      }
    } else if (userRole === 'admin') {
      if (currentPath.includes('attendance')) {
        return;
      }
      if (
        (currentPath.includes('student_') || currentPath.includes('faculty_')) &&
        !currentPath.includes('student_profile.html') &&
        !currentPath.includes('faculty_profile.html')
      ) {
        window.location.href = '/dashboard.html';
        return;
      }
    }

    // Inject "Back to Role Selection" button in the global top navbar
    const navRight = document.querySelector('.navbar-right');
    if (navRight && !navRight.querySelector('.btn-back-role-nav')) {
      const backBtn = document.createElement('a');
      backBtn.href = '/role_selection.html';
      backBtn.className = 'btn-back-role-nav';
      backBtn.style.cssText = 'display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.85rem; border-radius: 8px; background-color: #EFF6FF; color: #0056D2; font-size: 0.82rem; font-weight: 600; text-decoration: none; border: 1px solid #DBEAFE; transition: all 0.2s ease; margin-right: 0.75rem; cursor: pointer; height: 36px; white-space: nowrap; flex-shrink: 0;';
      backBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>Back to Role Selection</span>
      `;
      
      backBtn.addEventListener('mouseenter', () => {
        backBtn.style.backgroundColor = '#2563EB';
        backBtn.style.color = '#FFFFFF';
      });
      backBtn.addEventListener('mouseleave', () => {
        backBtn.style.backgroundColor = '#EFF6FF';
        backBtn.style.color = '#2563EB';
      });
      
      backBtn.addEventListener('click', () => {
        localStorage.removeItem('accessToken');
        sessionStorage.removeItem('sms_user_profile_cache');
      });
      
      navRight.insertBefore(backBtn, navRight.firstChild);
    }

      // Handle Logout & Back to Role Selection globally
      document.addEventListener('click', (e) => {
        const logoutLink = e.target.closest('a[href*="role_selection.html"], .logout-item, .btn-back-role');
        if (logoutLink) {
          localStorage.removeItem('accessToken');
        }
      });

      // 1. Role normalization & fallback handling
      const roleLower = String(data.user.role || '').toLowerCase().trim();
      const isAdminOrHOD = roleLower === 'admin' || roleLower === 'hod';
      const isFacultyRole = roleLower === 'faculty';

      const userName = data.user.name || data.user.username || '';
      const userDept = (data.user && data.user.department) ? data.user.department : 'Computer Science & Engineering';

      const deptShortMap = {
        'Computer Science & Engineering': 'CSE',
        'Information Technology': 'IT',
        'Electronics & Communication Engineering': 'ECE',
        'Electrical & Electronics Engineering': 'EEE',
        'Artificial Intelligence & Data Science': 'AI&DS'
      };

      function getDeptShort(dept) {
        if (!dept) return 'CSE';
        const str = String(dept).trim();
        if (deptShortMap[str]) return deptShortMap[str];

        const lower = str.toLowerCase();
        if (lower.includes('information') || lower.includes('it')) return 'IT';
        if (lower.includes('electronics') || lower.includes('ece')) return 'ECE';
        if (lower.includes('electrical') || lower.includes('eee')) return 'EEE';
        if (lower.includes('artificial') || lower.includes('aids')) return 'AI&DS';
        if (lower.includes('computer') || lower.includes('cse')) return 'CSE';

        return str;
      }

      const deptShort = getDeptShort(userDept);

      // Dynamic Sidebar Logo & Header Titles
      document.querySelectorAll('.sidebar-logo-block .logo-title, .logo-title').forEach(el => {
        el.textContent = deptShort;
      });
      document.querySelectorAll('.sidebar-logo-block .logo-subtitle, .logo-subtitle').forEach(el => {
        el.textContent = `Department Portal`;
      });
      document.querySelectorAll('.navbar-title-block .navbar-title, .navbar-title').forEach(el => {
        el.textContent = `${userDept} Department`;
      });
      document.querySelectorAll('.mobile-portal-title').forEach(el => {
        el.textContent = `${deptShort} Portal`;
      });

      // Dynamic Browser Page Title for All Pages
      if (document.title) {
        const rawTitle = document.title;
        const pageName = rawTitle.split('|')[0].trim() || 'Dashboard';
        document.title = `${pageName} | ${deptShort} Portal`;
      }

      // 2. Populate global navbar/sidebar profile names and roles across desktop and mobile
      const navNames = document.querySelectorAll('.nav-profile-name, #nav-profile-name');
      const sidebarNames = document.querySelectorAll('.profile-widget-name, #sidebar-profile-name');
      const navRoles = document.querySelectorAll('.nav-profile-role, #nav-profile-role');
      const sidebarRoles = document.querySelectorAll('.profile-widget-role, #sidebar-profile-role');

      if (userName) {
        navNames.forEach(el => el.textContent = userName);
        sidebarNames.forEach(el => el.textContent = userName);
      }

      let roleText = 'Student';
      if (isAdminOrHOD) roleText = `HOD - ${deptShort}`;
      else if (isFacultyRole) roleText = `Faculty - ${deptShort}`;

      navRoles.forEach(el => el.textContent = roleText);
      sidebarRoles.forEach(el => {
        el.textContent = isAdminOrHOD ? `HOD – ${userDept} Department` : (data.user.designation || `Faculty - ${deptShort}`);
      });

      // Always update avatar images across desktop & mobile
      window.getAvatarUrl = function(name, photoPath) {
        if (photoPath && typeof photoPath === 'string' && photoPath.trim() !== '' && photoPath !== 'null' && photoPath !== 'undefined') {
          return photoPath.trim();
        }
        const initial = (name && typeof name === 'string' && name.trim() !== '')
          ? name.trim().charAt(0).toUpperCase()
          : 'U';
        
        const palette = ['#0056D2', '#0F9D58', '#6A1B9A', '#D97706', '#DC2626', '#2563EB', '#7C3AED'];
        const charCode = initial.charCodeAt(0) || 85;
        const bg = palette[charCode % palette.length];

        return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='${encodeURIComponent(bg)}'/%3E%3Ctext x='32' y='41' font-family='Inter, sans-serif' font-size='28' font-weight='700' fill='white' text-anchor='middle'%3E${initial}%3C/text%3E%3C/svg%3E`;
      };

      const _avatarSrc = window.getAvatarUrl(userName, data.user.photoPath);
      document.querySelectorAll('img.nav-profile-avatar, .nav-profile-avatar img, .nav-profile-block img, img.profile-widget-avatar, .profile-widget-avatar img, img.mobile-avatar-img, .mobile-avatar-img img, #nav-student-avatar, #sidebar-student-avatar, #nav-faculty-avatar, #sidebar-faculty-avatar, #nav-profile-avatar, #sidebar-profile-avatar').forEach(img => {
        img.src = _avatarSrc;
        img.alt = userName;
      });

      // 3. Populate greetings & subtitles across desktop and mobile greeting nodes
      const greetingTitles = document.querySelectorAll('#faculty-greeting-name, #welcome-user-title, #faculty-header-greeting, #mobile-greeting-name, .welcome-banner h1, .welcome-banner h2');
      const greetingSubtitles = document.querySelectorAll('#faculty-greeting-dept, #welcome-user-subtitle, #faculty-header-sub, .welcome-banner p');

      greetingTitles.forEach(el => {
        if (isAdminOrHOD) {
          el.textContent = userName ? `Welcome back, ${userName} 👏` : `Welcome back 👏`;
        } else if (isFacultyRole) {
          el.textContent = userName ? `Good Morning, ${userName} 👋` : `Good Morning 👋`;
        } else {
          el.textContent = userName ? `Hello, ${userName}! 🖐️` : `Hello! 🖐️`;
        }
      });

      greetingSubtitles.forEach(el => {
        if (isAdminOrHOD) {
          if (el.id === 'welcome-user-subtitle') {
            const currentPath = window.location.pathname.toLowerCase();
            if (currentPath.includes('attendance')) {
              el.textContent = `Head of Department (HOD) | ${userDept}`;
            } else {
              el.textContent = `Here's what's happening in ${userDept} Department today.`;
            }
          } else {
            el.textContent = `Head of Department (HOD) | ${userDept}`;
          }
        } else if (isFacultyRole) {
          el.textContent = `${data.user.designation || 'Faculty Member'} | ${userDept}`;
        } else {
          el.textContent = `Student | ${userDept}`;
        }
      });

      document.querySelectorAll('.leave-dept-subtitle, .navbar-subtitle').forEach(el => {
        if (el.textContent && (el.textContent.includes('leave') || el.textContent.includes('requests') || el.textContent.includes('duty'))) {
          el.textContent = `Approve or reject leave & duty requests from ${userDept} department`;
        }
      });

      const totalStudents = document.getElementById('stats-total-students');
      const totalFaculty = document.getElementById('stats-total-faculty');
      const totalSubjects = document.getElementById('stats-total-subjects');
      const attendanceRate = document.getElementById('stats-attendance-rate');
      const pendingLeaves = document.getElementById('stats-pending-leaves');

      if (totalStudents) totalStudents.textContent = data.stats.totalStudents;
      if (totalFaculty) totalFaculty.textContent = data.stats.totalFaculty;
      if (totalSubjects) totalSubjects.textContent = data.stats.totalSubjects;
      if (attendanceRate) attendanceRate.textContent = (data.stats.attendancePercentage !== null && data.stats.attendancePercentage !== undefined && data.stats.attendancePercentage > 0) ? `${data.stats.attendancePercentage}%` : 'N/A';
      if (pendingLeaves) pendingLeaves.textContent = data.stats.pendingLeaves;

      // Populate Top Banner Academic Card (Semester, Department, Dynamic Last Login)
      const semesterBanner = document.getElementById('dashboard-banner-semester');
      const departmentBanner = document.getElementById('dashboard-banner-department');
      const lastLoginBanner = document.getElementById('dashboard-banner-last-login');

      if (semesterBanner) semesterBanner.textContent = 'Odd Semester';
      if (departmentBanner) departmentBanner.textContent = data.user.department || 'Computer Science & Engineering';
      
      if (lastLoginBanner) {
        const rawTime = data.user.lastLogin || localStorage.getItem('sms_last_login');
        if (rawTime) {
          const d = new Date(rawTime);
          if (!isNaN(d.getTime())) {
            const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            lastLoginBanner.textContent = `${dateStr}, ${timeStr}`;
          } else {
            lastLoginBanner.textContent = 'Just now';
          }
        } else {
          lastLoginBanner.textContent = 'Just now';
        }
      }

  }

  function initRealtimeClient(token, role) {
    if (window.smsSocketConnected) return;

    function connectSocket() {
      if (!window.io) return;
      const socket = window.io({
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      });

      window.smsSocketConnected = true;
      window.smsSocket = socket;

      socket.on('connect', () => {
        console.log('⚡ Connected to Real-Time Socket.IO server.');
      });

      const handleRealtimeEvent = (data) => {
        if (window.refreshNotificationsGlobal) {
          window.refreshNotificationsGlobal();
        }
        window.dispatchEvent(new CustomEvent('sms:realtime_event', { detail: data }));
      };

      socket.on('NEW_STUDENT_REGISTRATION', handleRealtimeEvent);
      socket.on('NEW_FACULTY_REGISTRATION', handleRealtimeEvent);
      socket.on('LEAVE_REQUEST_CREATED', handleRealtimeEvent);
      socket.on('LEAVE_REQUEST_APPROVED', handleRealtimeEvent);
      socket.on('LEAVE_REQUEST_REJECTED', handleRealtimeEvent);
      socket.on('ANNOUNCEMENT_PUBLISHED', handleRealtimeEvent);
      socket.on('NOTIFICATION_CREATED', handleRealtimeEvent);
      socket.on('REGISTRATION_APPROVED', handleRealtimeEvent);
      socket.on('REGISTRATION_REJECTED', handleRealtimeEvent);
      socket.on('CLASS_INCHARGE_ASSIGNED', handleRealtimeEvent);
      socket.on('REGISTRATION_LIST_CHANGED', handleRealtimeEvent);
    }

    if (!window.io && !document.getElementById('socket-io-js')) {
      const s = document.createElement('script');
      s.id = 'socket-io-js';
      s.src = '/socket.io/socket.io.js';
      s.onload = connectSocket;
      document.head.appendChild(s);
    } else {
      connectSocket();
    }
  }

  // Global Notification Engine initialized immediately for all pages
  function initNotificationSystem(authToken, currentRole) {
    if (currentRole && currentRole !== 'user') {
      window.smsUserRole = currentRole;
    }
    if (window.smsNotifSystemInitialized) return;
    window.smsNotifSystemInitialized = true;

    if (!document.getElementById('notif-system-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'notif-system-styles';
      styleEl.textContent = `
        .notification-dropdown {
          display: none;
          position: fixed;
          width: 360px;
          max-width: calc(100vw - 24px);
          max-height: 480px;
          background: #ffffff;
          border-radius: 14px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
          border: 1px solid #e2e8f0;
          z-index: 20000;
          flex-direction: column;
          overflow: hidden;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }
        .notif-header {
          padding: 12px 16px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .notif-header-title {
          font-weight: 700;
          font-size: 14px;
          color: #0f172a;
        }
        .notif-mark-all-btn {
          font-size: 12px;
          color: #0056D2;
          font-weight: 600;
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .notif-mark-all-btn:hover {
          background: #eff6ff;
        }
        .notif-body {
          overflow-y: auto;
          flex: 1;
          max-height: 420px;
        }
        .notif-item {
          display: flex;
          align-items: flex-start;
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          cursor: pointer;
          transition: background-color 0.15s ease;
          gap: 12px;
          position: relative;
        }
        .notif-item:hover {
          background-color: #f8fafc;
        }
        .notif-item.unread {
          background-color: #f0f7ff;
        }
        .notif-item.unread::before {
          content: '';
          position: absolute;
          left: 6px;
          top: 18px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #0056D2;
        }
        .notif-icon-badge {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }
        .notif-icon-student { background: #eff6ff; color: #0056D2; }
        .notif-icon-faculty { background: #ecfdf5; color: #10B981; }
        .notif-icon-leave { background: #fff7ed; color: #ea580c; }
        .notif-icon-system { background: #f3e8ff; color: #9333ea; }
        .notif-content-block {
          flex: 1;
          min-width: 0;
        }
        .notif-msg-text {
          font-size: 13px;
          font-weight: 500;
          color: #1e293b;
          margin: 0 0 4px 0;
          line-height: 1.35;
        }
        .notif-time-stamp {
          font-size: 11px;
          color: #64748b;
          margin: 0;
        }
        .notif-empty-state {
          padding: 32px 16px;
          text-align: center;
          color: #64748b;
          font-size: 13px;
        }
      `;
      document.head.appendChild(styleEl);
    }

    let dropdown = document.getElementById('notification-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'notification-dropdown';
      dropdown.className = 'notification-dropdown';
      dropdown.innerHTML = `
        <div class="notif-header">
          <span class="notif-header-title">Notifications</span>
          <button class="notif-mark-all-btn" id="notif-mark-all-action">Mark all as read</button>
        </div>
        <div class="notif-body" id="notif-body-container"></div>
      `;
      document.body.appendChild(dropdown);

      dropdown.querySelector('#notif-mark-all-action').addEventListener('click', async (e) => {
        e.stopPropagation();
        const activeToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || authToken;
        try {
          await fetch('/api/notifications/read-all', {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${activeToken}` }
          });
          await loadNotifications();
        } catch (err) {
          console.error('Error marking all as read:', err);
        }
      });
    }

    function positionDropdown(btn) {
      const rect = btn.getBoundingClientRect();
      dropdown.style.top = `${rect.bottom + 8}px`;
      let calculatedLeft = rect.right - 340;
      const minLeft = 10;
      const maxLeft = Math.max(10, window.innerWidth - 350);
      if (calculatedLeft < minLeft) calculatedLeft = minLeft;
      if (calculatedLeft > maxLeft) calculatedLeft = maxLeft;
      dropdown.style.left = `${calculatedLeft}px`;
    }

    // Global event delegation for all notification bell triggers
    document.addEventListener('click', (e) => {
      const bellBtn = e.target.closest('.notification-bell-btn, #nav-notification-btn, #notif-bell, #mobile-notif-btn, #notif-btn, button[aria-label*="Notification"], button[aria-label*="notification"]');
      if (bellBtn) {
        e.stopPropagation();
        e.preventDefault();
        positionDropdown(bellBtn);
        const isOpen = dropdown.style.display === 'flex';
        dropdown.style.display = isOpen ? 'none' : 'flex';
        if (!isOpen) {
          loadNotifications();
        }
        return;
      }

      if (dropdown && dropdown.style.display === 'flex' && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    window.refreshNotificationsGlobal = loadNotifications;

    // Initial load to populate badges
    loadNotifications();

    async function loadNotifications() {
      const activeToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || authToken;
      const container = document.getElementById('notif-body-container');

      if (!activeToken) {
        if (container) {
          container.innerHTML = `
            <div class="notif-empty-state">
              <div style="font-size: 1.8rem; margin-bottom: 0.4rem;">🔔</div>
              <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">Authentication Required</div>
              <div>Please log in to view your notifications.</div>
            </div>
          `;
        }
        return;
      }

      if (container && dropdown.style.display === 'flex') {
        container.innerHTML = `
          <div style="padding: 28px 16px; text-align: center; color: #64748b; font-size: 13px;">
            <div style="font-size: 1.2rem; margin-bottom: 0.25rem;">⏳</div>
            Loading notifications...
          </div>
        `;
      }

      try {
        const res = await fetch('/api/notifications', {
          headers: { 'Authorization': `Bearer ${activeToken}` }
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('accessToken');
            sessionStorage.removeItem('sms_user_profile_cache');
          }
          if (container) {
            container.innerHTML = `
              <div style="padding: 24px 16px; text-align: center; color: #ef4444; font-size: 13px;">
                <div style="font-size: 1.2rem; margin-bottom: 0.25rem;">⚠️</div>
                <div style="font-weight: 600; margin-bottom: 0.25rem;">Unable to load notifications.</div>
                <button id="notif-retry-btn" style="background: #eff6ff; color: #0056d2; border: 1px solid #dbeafe; padding: 4px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px;">Try again</button>
              </div>
            `;
            const retryBtn = container.querySelector('#notif-retry-btn');
            if (retryBtn) retryBtn.onclick = () => loadNotifications();
          }
          return;
        }

        const data = await res.json();
        const unreadCount = data.unreadCount || 0;
        const notifications = data.notifications || [];

        // Update all bell badges on current page
        document.querySelectorAll('.bell-badge-count').forEach(badge => {
          badge.textContent = unreadCount;
          badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        });

        if (!container) return;
        container.innerHTML = '';

        if (notifications.length === 0) {
          container.innerHTML = `
            <div class="notif-empty-state">
              <div style="font-size: 1.8rem; margin-bottom: 0.4rem;">🔔</div>
              <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">No notifications</div>
              <div>You're all caught up.</div>
            </div>
          `;
          return;
        }

        notifications.forEach(item => {
          const div = document.createElement('div');
          div.className = `notif-item ${item.isRead ? '' : 'unread'}`;

          let icon = '📢';
          let iconClass = 'notif-icon-system';
          const msgLower = (item.message || '').toLowerCase();
          const typeLower = (item.type || '').toLowerCase();

          if (typeLower.includes('student') || (msgLower.includes('student') && msgLower.includes('registration'))) {
            icon = '🎓';
            iconClass = 'notif-icon-student';
          } else if (typeLower.includes('faculty') || (msgLower.includes('faculty') && msgLower.includes('registration'))) {
            icon = '👨‍🏫';
            iconClass = 'notif-icon-faculty';
          } else if (typeLower.includes('leave') || msgLower.includes('leave')) {
            icon = '📝';
            iconClass = 'notif-icon-leave';
          }

          const timeStr = formatRelativeTime(item.createdAt);

          div.innerHTML = `
            <div class="notif-icon-badge ${iconClass}">${icon}</div>
            <div class="notif-content-block">
              <p class="notif-msg-text">${item.message}</p>
              <p class="notif-time-stamp">${timeStr}</p>
            </div>
          `;

          div.addEventListener('click', async () => {
            dropdown.style.display = 'none';
            if (!item.isRead) {
              try {
                await fetch(`/api/notifications/${item.id}/read`, {
                  method: 'PUT',
                  headers: { 'Authorization': `Bearer ${activeToken}` }
                });
                item.isRead = true;
                // Immediate badge decrease
                const currentBadges = document.querySelectorAll('.bell-badge-count');
                currentBadges.forEach(b => {
                  const val = Math.max(0, (parseInt(b.textContent || '0') || 1) - 1);
                  b.textContent = val;
                  b.style.display = val > 0 ? 'flex' : 'none';
                });
              } catch (e) {}
            }

            const role = window.smsUserRole || currentRole || 'student';
            if (typeLower.includes('announcement') || msgLower.includes('announcement')) {
              if (role === 'student') window.location.href = '/student_dashboard.html';
              else if (role === 'faculty') window.location.href = '/faculty_announcements.html';
              else window.location.href = '/announcements.html';
            } else if (msgLower.includes('faculty')) {
              window.location.href = '/new_registrations.html?tab=faculty';
            } else if (msgLower.includes('student') || msgLower.includes('registration')) {
              window.location.href = '/new_registrations.html?tab=students';
            } else if (msgLower.includes('leave')) {
              if (role === 'faculty') window.location.href = '/faculty_requests.html';
              else if (role === 'student') window.location.href = '/student_leave.html';
              else window.location.href = '/leave.html';
            } else {
              window.location.href = role === 'student' ? '/student_dashboard.html' : (role === 'faculty' ? '/faculty_dashboard.html' : '/dashboard.html');
            }
          });

          container.appendChild(div);
        });

      } catch (err) {
        console.error('Error loading notifications:', err);
        if (container) {
          container.innerHTML = `
            <div style="padding: 24px 16px; text-align: center; color: #ef4444; font-size: 13px;">
              <div style="font-size: 1.2rem; margin-bottom: 0.25rem;">⚠️</div>
              <div style="font-weight: 600; margin-bottom: 0.25rem;">Unable to load notifications.</div>
              <button id="notif-retry-btn" style="background: #eff6ff; color: #0056d2; border: 1px solid #dbeafe; padding: 4px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px;">Try again</button>
            </div>
          `;
          const retryBtn = container.querySelector('#notif-retry-btn');
          if (retryBtn) retryBtn.onclick = () => loadNotifications();
        }
      }
    }

    function formatRelativeTime(dateInput) {
      if (!dateInput) return 'Recently';
      const d = new Date(dateInput);
      const now = new Date();
      const diffSec = Math.floor((now - d) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  }

  // Initialize notification and push system immediately on page load
  const initialToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  if (initialToken) {
    initNotificationSystem(initialToken, 'user');
    initPushNotifications(initialToken);
  }

  loadDashboardData();

});
