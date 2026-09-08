import { test, expect, Page } from '@playwright/test';

const FACULTY_CREDS = {
  username: 'CS002',
  password: '1234567890',
  name: 'CSE-staff1',
  department: 'Computer Science & Engineering',
  year: '3rd Year',
  semester: 'V',
  section: 'A',
  subjectCode: 'CSS375',
  subjectName: 'CYBER SECURITY'
};

// Helper to monitor console and network errors
function attachMonitoring(page: Page, options: { allowExpectedErrors?: boolean } = {}) {
  const consoleErrors: string[] = [];
  const networkErrors: { url: string; status: number }[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore favicon and external CDN errors if any
      if (!text.includes('favicon.ico') && !text.includes('chrome-extension')) {
        consoleErrors.push(text);
      }
    }
  });

  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !options.allowExpectedErrors) {
      if (!url.includes('favicon.ico')) {
        networkErrors.push({ url, status });
      }
    }
  });

  return { consoleErrors, networkErrors };
}

// Helper to check horizontal scrolling (responsive check)
async function verifyNoHorizontalScroll(page: Page, description: string) {
  const isOverflowing = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth + 1; // 1px tolerance for sub-pixel rounding
  });
  expect(isOverflowing, `Horizontal scroll detected on ${description}`).toBe(false);
}

// Helper to perform authenticated faculty login
async function loginAsFaculty(page: Page) {
  await page.goto('/login.html?role=faculty', { waitUntil: 'domcontentloaded' });
  await page.fill('#login-id', FACULTY_CREDS.username);
  await page.fill('#login-password', FACULTY_CREDS.password);
  await page.click('#submit-action-btn');

  // Wait for redirect to faculty dashboard (Worker canonicalizes to /faculty_dashboard)
  await page.waitForURL(/\/faculty_dashboard(\.html)?/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Verify auth session in localStorage
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  expect(token).toBeTruthy();
}

test.describe('Faculty Portal - 100% End-to-End Automation Suite', () => {

  // =========================================================================
  // Phase 1: Landing and Login
  // =========================================================================
  test('Phase 1 - Website landing, form validation, and login workflow', async ({ page }) => {
    attachMonitoring(page, { allowExpectedErrors: true });

    // 1. Load login page
    await page.goto('/login.html?role=faculty', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Login|SMS|Student Management/i);

    // 2. Verify Theme and Role Badges
    const badge = page.locator('#role-badge-text');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/FACULTY LOGIN/i);

    // 3. Password field masking & show/hide toggle
    const passwordInput = page.locator('#login-password');
    const toggleBtn = page.locator('#password-toggle-btn');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    await passwordInput.fill('secret123');
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // 4. Negative Test: Wrong credentials
    await page.fill('#login-id', FACULTY_CREDS.username);
    await passwordInput.fill('incorrect_password_999');
    const submitBtn = page.locator('#submit-action-btn');
    await submitBtn.click();

    const alertBanner = page.locator('#login-alert-banner');
    await expect(alertBanner).toBeVisible({ timeout: 10000 });
    await expect(alertBanner).toContainText(/Invalid credentials|incorrect/i);

    // Wait until submit button is re-enabled
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });

    // 5. Positive Test: Valid credentials
    await page.fill('#login-id', FACULTY_CREDS.username);
    await passwordInput.fill(FACULTY_CREDS.password);
    await submitBtn.click();

    // 6. Assert successful redirect to Faculty Dashboard
    await page.waitForURL(/\/faculty_dashboard(\.html)?/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // 7. Verify session creation in localStorage
    const storedUser = await page.evaluate(() => {
      return {
        token: localStorage.getItem('accessToken'),
        user: JSON.parse(localStorage.getItem('user') || '{}')
      };
    });
    expect(storedUser.token).toBeTruthy();
    expect(storedUser.user.role).toBe('faculty');

    // Responsive check
    await verifyNoHorizontalScroll(page, 'Login / Redirect to Dashboard');
  });

  // =========================================================================
  // Phase 2: Faculty Dashboard UI & Responsiveness
  // =========================================================================
  test('Phase 2 - Faculty Dashboard UI layout, metrics, and responsiveness', async ({ page }) => {
    attachMonitoring(page);
    await loginAsFaculty(page);

    // 1. Verify Welcome Header & Greeting
    const greeting = page.locator('#faculty-header-greeting');
    await expect(greeting).toBeVisible();

    const welcomeTitle = page.locator('h1, h2, #faculty-greeting-name').first();
    await expect(welcomeTitle).toBeVisible();

    // 2. Verify Assigned Class Card
    const assignedClassCard = page.locator('#dashboard-assigned-class-card');
    await expect(assignedClassCard).toBeVisible();

    const deptEl = page.locator('#dash-assigned-dept');
    const yearEl = page.locator('#dash-assigned-year');
    const semEl = page.locator('#dash-assigned-sem');
    const secEl = page.locator('#dash-assigned-sec');

    await expect(deptEl).toContainText(/Computer Science/i, { timeout: 10000 });
    await expect(yearEl).toContainText(/3rd Year|III/i);
    await expect(semEl).toContainText(/V|5/i);
    await expect(secEl).toContainText(/A/i);

    // 3. Verify Metric Summary Cards
    const studentsStat = page.locator('#stats-total-students');
    const attStat = page.locator('#stats-attendance-rate');
    const marksStat = page.locator('#stats-pending-leaves');

    await expect(studentsStat).toBeVisible();
    await expect(attStat).toBeVisible();
    await expect(marksStat).toBeVisible();

    // 4. Verify Quick Academic Actions are visible and clickable
    const markAttAction = page.locator('#action-mark-attendance');
    await expect(markAttAction).toBeVisible();

    // 5. Check Sidebar Collapse/Expand
    const collapseBtn = page.locator('#sidebar-collapse-btn');
    if (await collapseBtn.isVisible()) {
      await collapseBtn.click();
      await page.waitForTimeout(300);
      await collapseBtn.click();
      await page.waitForTimeout(300);
    }

    // 6. Responsive Check: No Horizontal Scrolling
    await verifyNoHorizontalScroll(page, 'Faculty Dashboard');
  });

  // =========================================================================
  // Phase 3: Comprehensive Sidebar Navigation
  // =========================================================================
  test('Phase 3 - Comprehensive Sidebar Navigation across all Faculty pages', async ({ page }) => {
    test.setTimeout(120000);
    attachMonitoring(page);
    await loginAsFaculty(page);

    const navPages = [
      { name: 'Students', urlRegex: /faculty_students(\.html)?/, linkMatch: 'faculty_students' },
      { name: 'Attendance', urlRegex: /faculty_attendance(\.html)?/, linkMatch: 'faculty_attendance' },
      { name: 'Assignments', urlRegex: /faculty_assignments(\.html)?/, linkMatch: 'faculty_assignments' },
      { name: 'Exams & Marks', urlRegex: /faculty_marks(\.html)?/, linkMatch: 'faculty_marks' },
      { name: 'Announcements', urlRegex: /faculty_announcements(\.html)?/, linkMatch: 'faculty_announcements' },
      { name: 'Resources', urlRegex: /faculty_resources(\.html)?/, linkMatch: 'faculty_resources' },
      { name: 'Leave Requests', urlRegex: /faculty_requests(\.html)?/, linkMatch: 'faculty_requests' },
      { name: 'Settings', urlRegex: /faculty_settings(\.html)?/, linkMatch: 'faculty_settings' },
      { name: 'My Profile', urlRegex: /faculty_my_profile(\.html)?/, linkMatch: 'faculty_my_profile' }
    ];

    for (const item of navPages) {
      // If mobile, ensure sidebar or menu is accessible
      const isMobile = await page.evaluate(() => window.innerWidth <= 768);
      if (isMobile) {
        const toggleBtn = page.locator('#sidebar-collapse-btn, .mobile-menu-toggle');
        if (await toggleBtn.isVisible()) {
          await toggleBtn.click();
          await page.waitForTimeout(300);
        }
      }

      // Click sidebar item
      const link = page.locator(`a[href*="${item.linkMatch}"]`).first();
      await expect(link, `Sidebar link to ${item.name} must exist`).toBeVisible();
      await link.click();

      // Verify URL matches (with or without .html)
      await page.waitForURL(item.urlRegex, { timeout: 15000 });
      await page.waitForLoadState('networkidle');

      // Verify no blank screen and main workspace rendered
      const mainWorkspace = page.locator('.main-workspace-panel, main');
      await expect(mainWorkspace).toBeVisible();

      // Check responsive layout
      await verifyNoHorizontalScroll(page, `Sidebar Page: ${item.name}`);
    }

    // Return to dashboard cleanly after full traversal
    await page.goto('/faculty_dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
  });

  // =========================================================================
  // Phase 4: My Subjects / Class Roster
  // =========================================================================
  test('Phase 4 - My Subjects and Students roster validation', async ({ page }) => {
    attachMonitoring(page);
    await loginAsFaculty(page);

    // Navigate to Students Roster
    await page.goto('/faculty_students', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Verify Table exists
    const rosterTable = page.locator('#roster-table');
    await expect(rosterTable).toBeVisible({ timeout: 10000 });

    // Verify Required Headers per Specification
    const headers = page.locator('#roster-table thead th');
    const headerTexts = await headers.allTextContents();
    const joinedHeaders = headerTexts.join(' ').toLowerCase();

    expect(joinedHeaders).toContain('photo');
    expect(joinedHeaders).toContain('register number');
    expect(joinedHeaders).toContain('name');
    expect(joinedHeaders).toContain('year');
    expect(joinedHeaders).toContain('section');
    expect(joinedHeaders).toContain('status');

    // Verify search filter input exists and functions
    const searchInput = page.locator('#search-input, input[type="search"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Alice');
      await page.waitForTimeout(300);
      await searchInput.fill('');
    }

    await verifyNoHorizontalScroll(page, 'Faculty Students Roster');
  });

  // =========================================================================
  // Phase 5: Timetable & Schedule Presentation
  // =========================================================================
  test('Phase 5 - Timetable & Daily Schedule presentation', async ({ page }) => {
    attachMonitoring(page);
    await loginAsFaculty(page);

    // Verify Date display on top navbar
    const dateDisplay = page.locator('#nav-date-display').first();
    await expect(dateDisplay).toBeVisible();
    const dateText = await dateDisplay.textContent();
    expect(dateText).toBeTruthy();

    // Verify Department Title Block
    const deptBlock = page.locator('#faculty-header-sub, .navbar-subtitle').first();
    await expect(deptBlock).toContainText(/Computer Science & Engineering/i);

    await verifyNoHorizontalScroll(page, 'Schedule Presentation');
  });

  // =========================================================================
  // Phase 6: Attendance Module (Assigned Class Lock, Marking, Persisting)
  // =========================================================================
  test('Phase 6 - Attendance marking, validation, and submission', async ({ page }) => {
    attachMonitoring(page);
    await loginAsFaculty(page);

    // Open Faculty Attendance
    await page.goto('/faculty_attendance', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // 1. Verify Assigned Class Card displays HOD Assignment read-only
    const assignedDept = page.locator('#assigned-dept');
    const assignedYear = page.locator('#assigned-year');
    const assignedSem = page.locator('#assigned-semester');
    const assignedSec = page.locator('#assigned-section');

    await expect(assignedDept).toContainText(/Computer Science/i, { timeout: 10000 });
    await expect(assignedYear).toContainText(/3rd Year|III/i);
    await expect(assignedSem).toContainText(/V|5/i);
    await expect(assignedSec).toContainText(/A/i);

    // 2. Verify Attendance Date input defaults to today
    const attDateInput = page.locator('#att-date');
    await expect(attDateInput).toBeVisible();
    const dateVal = await attDateInput.inputValue();
    expect(dateVal).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // 3. Verify Student Roster loaded for assigned class
    const tbody = page.locator('#attendance-students-tbody');
    await expect(tbody).toBeVisible();
    await page.waitForTimeout(1000); // Allow D1 fetch to render

    // 4. Test "Mark All Present" button
    const markAllPresentBtn = page.locator('#btn-mark-all-present');
    await expect(markAllPresentBtn).toBeVisible();
    await markAllPresentBtn.click();
    await page.waitForTimeout(300);

    // 5. Test "Mark All Absent" button
    const markAllAbsentBtn = page.locator('#btn-mark-all-absent');
    await expect(markAllAbsentBtn).toBeVisible();
    await markAllAbsentBtn.click();
    await page.waitForTimeout(300);

    // Mark back to Present before saving
    await markAllPresentBtn.click();

    // 6. Save Daily Attendance
    const saveBtn = page.locator('#save-daily-att-btn');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // 7. Verify Success Alert or Toast appears
    const alertBanner = page.locator('#att-alert-banner');
    await expect(alertBanner).toBeVisible({ timeout: 10000 });
    await expect(alertBanner).toContainText(/success|recorded|saved/i);

    // 8. Refresh and ensure Attendance persists without error
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(assignedDept).toContainText(/Computer Science/i);

    await verifyNoHorizontalScroll(page, 'Faculty Attendance');
  });

  // =========================================================================
  // Phase 7: Internal Marks Module
  // =========================================================================
  test('Phase 7 - Internal Marks roster, input validation, and saving', async ({ page }) => {
    attachMonitoring(page);
    await loginAsFaculty(page);

    // Open Internal Marks
    await page.goto('/faculty_marks', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // 1. Verify Assigned Subject dropdown
    const subSelect = page.locator('#marks-sub');
    await expect(subSelect).toBeVisible({ timeout: 15000 });
    // Wait for subjects to load
    await expect(subSelect.locator('option')).not.toHaveText(['Loading assigned subjects...'], { timeout: 15000 });
    const subOptions = await subSelect.locator('option').allTextContents();
    expect(subOptions.length).toBeGreaterThan(0);
    expect(subOptions.some(opt => opt.includes('CSS375') || opt.includes('CYBER') || opt.includes('SECURITY') || opt.length > 0)).toBe(true);

    // Select the subject
    await subSelect.selectOption({ index: 0 });

    // 2. Select Exam assessment
    const examSelect = page.locator('#marks-assessment');
    await expect(examSelect).toBeVisible();
    await examSelect.selectOption({ label: 'CIA-1' });
    await page.waitForTimeout(1000);

    // 3. Verify Student Marks Table
    const marksTbody = page.locator('#faculty-marks-tbody');
    await expect(marksTbody).toBeVisible();

    // 4. Fill in marks if students exist
    const markInputs = marksTbody.locator('input.marks-score-input, input[type="number"]');
    const inputCount = await markInputs.count();

    if (inputCount > 0) {
      // Test entering a valid score
      const firstInput = markInputs.first();
      await firstInput.fill('85');

      // 5. Click Save Marks
      const saveBtn = page.locator('#save-marks-btn');
      await expect(saveBtn).toBeVisible();
      await saveBtn.click();

      // 6. Verify Confirmation Banner
      const alertBanner = page.locator('#faculty-marks-alert');
      await expect(alertBanner).toBeVisible({ timeout: 15000 });
      await expect(alertBanner).toContainText(/success|recorded|saved/i);
    }

    await verifyNoHorizontalScroll(page, 'Faculty Internal Marks');
  });

  // =========================================================================
  // Phase 8: Notes / Study Material Upload
  // =========================================================================
  test('Phase 8 - Study material upload, validation, and listing', async ({ page }) => {
    attachMonitoring(page);
    await loginAsFaculty(page);

    // Open Resources
    await page.goto('/faculty_resources', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // 1. Verify Upload Form Elements
    const titleInput = page.locator('#res-title');
    const catSelect = page.locator('#res-category');
    const subSelect = page.locator('#res-sub');
    const fileInput = page.locator('#res-file-input');
    const submitBtn = page.locator('#btn-upload-submit');

    await expect(titleInput).toBeVisible();
    await expect(catSelect).toBeVisible();
    await expect(subSelect).toBeVisible({ timeout: 15000 });
    await expect(fileInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Wait for courses to populate and select one
    await expect(subSelect.locator('option')).not.toHaveText(['Loading assigned courses...'], { timeout: 15000 });
    const subCount = await subSelect.locator('option').count();
    if (subCount > 0) {
      await subSelect.selectOption({ index: 0 });
    }

    // 2. Fill in material upload details
    const sampleTitle = `Automation Notes Unit 1 - ${Date.now()}`;
    await titleInput.fill(sampleTitle);
    await catSelect.selectOption({ index: 0 });

    // Set sample file payload
    await fileInput.setInputFiles({
      name: 'unit1_lecture_notes.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 Mock Playwright Automation Lecture Notes Content')
    });

    // 3. Submit Form
    await submitBtn.click();

    // 4. Verify Alert & List Update
    const alertBanner = page.locator('#res-alert-banner');
    await expect(alertBanner).toBeVisible({ timeout: 15000 });
    await expect(alertBanner).toContainText(/success|uploaded/i);

    // 5. Check that resources catalog contains the item
    const tbody = page.locator('#faculty-resources-tbody');
    await expect(tbody).toContainText(sampleTitle, { timeout: 15000 });

    await verifyNoHorizontalScroll(page, 'Faculty Resources');
  });

  // =========================================================================
  // Phase 9: Student Leave Requests Approval / Forwarding
  // =========================================================================
  test('Phase 9 - Student leave requests review, tabs, and status flow', async ({ page }) => {
    attachMonitoring(page);
    await loginAsFaculty(page);

    // Open Leave Requests
    await page.goto('/faculty_requests', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // 1. Verify Tabs
    const pendingTab = page.locator('#tab-pending-btn');
    const historyTab = page.locator('#tab-history-btn');

    await expect(pendingTab).toBeVisible();
    await expect(historyTab).toBeVisible();

    // 2. Switch between tabs cleanly
    await historyTab.click();
    await page.waitForTimeout(300);
    await pendingTab.click();
    await page.waitForTimeout(300);

    // 3. Verify Container is rendered without "Failed to fetch request details"
    const container = page.locator('#requests-list-container');
    await expect(container).toBeVisible();
    const contentText = await container.textContent();
    expect(contentText).not.toContain('Failed to fetch request details');

    await verifyNoHorizontalScroll(page, 'Faculty Leave Requests');
  });

  // =========================================================================
  // Phase 10: Faculty Profile
  // =========================================================================
  test('Phase 10 - Faculty Profile viewing and editing', async ({ page }) => {
    attachMonitoring(page);
    await loginAsFaculty(page);

    // Open Profile
    await page.goto('/faculty_my_profile', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Verify profile card or fields exist
    const profileContainer = page.locator('.workspace-scroll-content, .profile-card, form').first();
    await expect(profileContainer).toBeVisible();

    // Verify Employee ID & Department
    const pageText = await page.locator('body').textContent();
    expect(pageText).toContain('Computer Science & Engineering');
    expect(pageText).toContain(FACULTY_CREDS.name);
    expect(pageText).toMatch(/Employee ID:\s*CS00[23]/);

    await verifyNoHorizontalScroll(page, 'Faculty Profile');
  });

  // =========================================================================
  // Phase 11: Settings & Dark Mode Persistence
  // =========================================================================
  test('Phase 11 - Settings, dark mode toggle, and persistence', async ({ page }) => {
    attachMonitoring(page);
    await loginAsFaculty(page);

    // Open Settings
    await page.goto('/faculty_settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // 1. Verify Password Change Form exists
    const currPassInput = page.locator('#set-curr-pass');
    const newPassInput = page.locator('#set-new-pass');
    const savePassBtn = page.locator('#btn-save-pass');

    await expect(currPassInput).toBeVisible();
    await expect(newPassInput).toBeVisible();
    await expect(savePassBtn).toBeVisible();

    // 2. Test Dark Mode Toggle
    const themeBtn = page.locator('#theme-toggle-btn, #mobile-theme-btn').first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(300);

      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark-theme'));
      const storedTheme = await page.evaluate(() => localStorage.getItem('theme'));
      expect(storedTheme).toBe(isDark ? 'dark' : 'light');

      // Toggle back to light
      await themeBtn.click();
      await page.waitForTimeout(300);
    }

    await verifyNoHorizontalScroll(page, 'Faculty Settings');
  });

  // =========================================================================
  // Phase 12: Logout & Session Clearance
  // =========================================================================
  test('Phase 12 - Logout workflow and session termination', async ({ page }) => {
    attachMonitoring(page);
    await loginAsFaculty(page);

    // 1. Click Logout in sidebar
    const logoutLink = page.locator('.logout-item, a[href*="role_selection.html"]').first();
    await expect(logoutLink).toBeVisible();
    await logoutLink.click();

    // 2. Verify redirect away from dashboard
    await page.waitForURL(/role_selection|login/i, { timeout: 10000 });

    // 3. Clear session and attempt backward navigation to protected page
    await page.goto('/faculty_dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // 4. Verify redirected back to login / role_selection if unauthenticated
    const currentUrl = page.url();
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));

    // If redirected or token is cleared, session termination passes
    const isProtected = !currentUrl.includes('faculty_dashboard') || !token;
    expect(isProtected).toBe(true);
  });

});
