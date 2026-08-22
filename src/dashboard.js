import './style.css';

document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================
     1. ROUTING HASH SYSTEM & TAB CONTROLLER
     ========================================== */
  const sidebarLinks = document.querySelectorAll('.sidebar-menu-item');
  const tabPanels = document.querySelectorAll('.dashboard-tab-panel');
  const pageHeading = document.getElementById('page-title-heading');
  const pageSubHeading = document.getElementById('page-title-sub');

  const cachedStr = sessionStorage.getItem('sms_user_profile_cache');
  let userDept = 'Computer Science & Engineering';
  if (cachedStr) {
    try {
      const c = JSON.parse(cachedStr);
      if (c.user && c.user.department) userDept = c.user.department;
    } catch(e) {}
  }

  const routeTitles = {
    'dashboard': { title: `${userDept} Department`, sub: 'Academic Management Portal' },
    'students': { title: 'Students Management', sub: 'Manage students credentials and academic status' },
    'approval': { title: 'Registration Approvals', sub: 'Review pending registration applications' },
    'student-profile': { title: 'Student Profile Overview', sub: 'Detailed academic record for student' },
    'faculty': { title: 'Faculty Management', sub: 'Manage department teachers and qualification files' },
    'faculty-profile': { title: 'Faculty Profile Overview', sub: 'Qualifications and workload logs' },
    'subjects': { title: 'Department Curriculum Subjects', sub: 'Course syllabus and assigned staff advisors' },
    'attendance': { title: 'Daily Attendance Tracker', sub: 'Take and review student attendance grids' },
    'marks': { title: 'Internal Exam Assessment Marks', sub: 'Grade records and class averages' },
    'leave': { title: 'Student Leave Requests', sub: 'Approve or reject medical leaves' },
    'announcements': { title: 'Department Announcement Hub', sub: 'Create and broadcast academic notices' },
    'reports': { title: 'Academic Reports Downloader', sub: 'Download PDF or Excel reports for audit logs' },
    'settings': { title: 'Portal Management Settings', sub: 'System configurations and academic cycles' }
  };

  function router() {
    let hash = window.location.hash || '#dashboard';
    
    // Split hash in case of parameters
    let path = hash.substring(1);
    let params = {};
    
    if (path.includes('?')) {
      const parts = path.split('?');
      path = parts[0];
      const queryStr = parts[1];
      const pairs = queryStr.split('&');
      pairs.forEach(pair => {
        const [k, v] = pair.split('=');
        params[k] = v;
      });
    }

    // Hide all panel sections
    tabPanels.forEach(panel => panel.classList.remove('active'));
    
    // Remove active sidebar link classes
    sidebarLinks.forEach(link => link.classList.remove('active'));

    // Select current active panel
    const activePanel = document.getElementById(`tab-panel-${path}`);
    
    if (activePanel) {
      activePanel.classList.add('active');
      
      // Update headings
      const routeInfo = routeTitles[path] || { title: 'Computer Science & Engineering', sub: 'Academic Portal' };
      pageHeading.textContent = routeInfo.title;
      pageSubHeading.textContent = routeInfo.sub;

      // Update sidebar highlight
      const activeLink = document.getElementById(`menu-link-${path}`);
      if (activeLink) {
        activeLink.classList.add('active');
      }

      // Trigger profile loaders if needed
      if (path === 'student-profile' && params.id) {
        loadStudentProfile(params.id);
      }
      if (path === 'faculty-profile' && params.id) {
        loadFacultyProfile(params.id);
      }
    }

    // Scroll main window to top
    const scrollContent = document.querySelector('.workspace-scroll-content');
    if (scrollContent) {
      scrollContent.scrollTop = 0;
    }
  }

  // Bind hashchange listener
  window.addEventListener('hashchange', router);
  // Run on initial page load
  router();


  /* ==========================================
     2. STUDENT & FACULTY PROFILE LOADER
     ========================================== */
  async function loadStudentProfile(id) {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    try {
      const res = await fetch(`/api/students/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Student profile not found.');
      const student = await res.json();

      const nameEl = document.getElementById('profile-display-name');
      const regEl = document.getElementById('profile-display-reg');
      const gEl = document.getElementById('profile-display-guardian');
      const emailEl = document.getElementById('profile-display-email');
      const phoneEl = document.getElementById('profile-display-phone');
      const imgEl = document.getElementById('profile-display-img');

      if (nameEl) nameEl.textContent = student.name || 'Student';
      if (regEl) regEl.textContent = student.registerNumber || id;
      if (gEl) gEl.textContent = student.guardianName ? `${student.guardianName} (${student.guardianPhone || ''})` : 'N/A';
      if (emailEl) emailEl.textContent = student.user?.email || 'N/A';
      if (phoneEl) phoneEl.textContent = student.phone || 'N/A';
      if (imgEl) imgEl.src = (window.getAvatarUrl ? window.getAvatarUrl(student.name, student.photoPath) : (student.photoPath || ''));
    } catch (err) {
      console.error('Error fetching student profile:', err);
    }
  }

  async function loadFacultyProfile(id) {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    try {
      const res = await fetch(`/api/faculty/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Faculty profile not found.');
      const faculty = await res.json();

      const nameEl = document.getElementById('fac-profile-display-name');
      const idEl = document.getElementById('fac-profile-display-id');
      const emailEl = document.getElementById('fac-profile-display-email');
      const imgEl = document.getElementById('fac-profile-display-img');

      if (nameEl) nameEl.textContent = faculty.name || 'Faculty Member';
      if (idEl) idEl.textContent = faculty.employeeId || id;
      if (emailEl) emailEl.textContent = faculty.user?.email || 'N/A';
      if (imgEl) imgEl.src = (window.getAvatarUrl ? window.getAvatarUrl(faculty.name, faculty.photoPath) : (faculty.photoPath || ''));
    } catch (err) {
      console.error('Error fetching faculty profile:', err);
    }
  }

  // Profile Inner Tab Switching
  window.switchProfileTab = function(tabName) {
    const tabBtns = document.querySelectorAll('.profile-tab-btn');
    const tabPanelsInner = document.querySelectorAll('#tab-panel-student-profile .profile-tab-panel');

    // Remove active state
    tabBtns.forEach(btn => {
      btn.classList.remove('active');
      if (btn.textContent.toLowerCase().includes(tabName)) {
        btn.classList.add('active');
      }
    });

    tabPanelsInner.forEach(panel => {
      panel.classList.remove('active');
      if (panel.id === `profile-tab-${tabName}`) {
        panel.classList.add('active');
      }
    });
  };

  // Faculty Inner Tab Switching
  window.switchFacultyTab = function(tabName) {
    const tabBtns = document.querySelectorAll('#tab-panel-faculty-profile .profile-tab-btn');
    const tabPanelsInner = document.querySelectorAll('#tab-panel-faculty-profile .profile-tab-panel');

    tabBtns.forEach(btn => {
      btn.classList.remove('active');
      if (btn.textContent.toLowerCase().includes(tabName)) {
        btn.classList.add('active');
      }
    });

    tabPanelsInner.forEach(panel => {
      panel.classList.remove('active');
      if (panel.id === `fac-tab-${tabName}`) {
        panel.classList.add('active');
      }
    });
  };


  /* ==========================================
     3. INTERNAL MARKS AUTO-CALCULATOR
     ========================================== */
  const markInputs = document.querySelectorAll('.marks-score-input');
  
  if (markInputs.length > 0) {
    markInputs.forEach(input => {
      input.addEventListener('input', calculateClassStats);
    });
  }

  function calculateClassStats() {
    const scores = [];
    document.querySelectorAll('.marks-score-input').forEach(input => {
      const val = parseFloat(input.value);
      if (!isNaN(val)) {
        scores.push(val);
      }
    });

    if (scores.length > 0) {
      const sum = scores.reduce((a, b) => a + b, 0);
      const avg = sum / scores.length;
      const highest = Math.max(...scores);
      const lowest = Math.min(...scores);

      document.getElementById('marks-display-average').textContent = avg.toFixed(2);
      document.getElementById('marks-display-highest').textContent = highest.toFixed(2);
      document.getElementById('marks-display-lowest').textContent = lowest.toFixed(2);
    }
  }


  /* ==========================================
     4. REPORTS DOWNLOAD PROGRESS SKELETON
     ========================================== */
  const reportBtns = document.querySelectorAll('.btn-report-download');
  const skeletonLoader = document.getElementById('reports-skeleton-container');

  reportBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const fileType = e.target.getAttribute('data-type');
      
      // Show Loader Skeleton
      if (skeletonLoader) {
        skeletonLoader.style.display = 'block';
        skeletonLoader.scrollIntoView({ behavior: 'smooth' });
      }

      // Mock progress of download
      setTimeout(() => {
        if (skeletonLoader) {
          skeletonLoader.style.display = 'none';
        }
        alert(`Success: Report for [${fileType}] generated and downloaded successfully.`);
      }, 2000);
    });
  });


  /* ==========================================
     5. LEAVE & APPROVAL DIALOG POPUPS
     ========================================== */
  window.triggerRejectionReason = function(regNo) {
    const reason = prompt(`Specify Rejection Reason for Student (${regNo}):`);
    if (reason) {
      alert(`Student Registration ${regNo} rejected. Notification sent with reason: "${reason}"`);
    }
  };

  window.triggerLeaveRejection = function(regNo) {
    const reason = prompt(`Specify Leave Rejection Reason for Student (${regNo}):`);
    if (reason) {
      alert(`Leave Request for ${regNo} rejected. Reason: "${reason}"`);
    }
  };

  window.switchLeaveTab = function(tabName) {
    // Demo tab switching for leaves if more tags are added in future
    alert(`Switched to Leave ${tabName} list view`);
  };


  /* ==========================================
     6. PORTAL SETTINGS TABS
     ========================================== */
  window.switchSettingsTab = function(tabId) {
    const links = document.querySelectorAll('.settings-tab-link');
    const contents = document.querySelectorAll('.settings-tab-content');

    links.forEach(link => {
      link.classList.remove('active');
      if (link.textContent.toLowerCase().includes(tabId) || (tabId === 'dept' && link.textContent.toLowerCase().includes('department'))) {
        link.classList.add('active');
      }
    });

    contents.forEach(content => {
      content.classList.remove('active');
      if (content.id === `settings-tab-${tabId}`) {
        content.classList.add('active');
      }
    });
  };


  /* ==========================================
     7. SIDEBAR COLLAPSE TOGGLE
     ========================================== */
  const sidebar = document.getElementById('dashboard-sidebar');
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  const mainWorkspace = document.querySelector('.main-workspace-panel');

  if (collapseBtn && sidebar && mainWorkspace) {
    collapseBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      mainWorkspace.classList.toggle('sidebar-collapsed');
    });
  }


  /* ==========================================
     8. DARK MODE THEME SWITCHER
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

});
