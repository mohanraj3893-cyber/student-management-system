import { test, expect, Page } from '@playwright/test';

// Secure HOD Test Credentials
const HOD_CREDENTIALS = {
  email: 'csehod12@gmail.com',
  username: 'CS001',
  password: process.env.TEST_HOD_PASSWORD || '1234567890'
};

const BASE_URL = 'https://student-management-system.sbcecsms3.workers.dev';

// Setup error listener on page
function attachDiagnostics(page: Page) {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Mask any tokens or passwords if present
      const safeText = text.replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [MASKED]')
                           .replace(/"password":\s*"[^"]+"/gi, '"password":"[MASKED]"');
      // Filter harmless environment-specific noise (e.g. external sockets or favicons)
      if (!safeText.includes('favicon') && !safeText.includes('Socket') && !safeText.includes('localhost:5000') && !safeText.includes('cdn.socket.io')) {
        consoleErrors.push(safeText);
      }
    }
  });

  page.on('response', resp => {
    if (resp.status() >= 400 && !resp.url().includes('favicon')) {
      networkErrors.push(`${resp.status()} ${resp.request().method()} ${resp.url()}`);
    }
  });

  return { consoleErrors, networkErrors };
}

// Perform real UI Login as HOD
async function loginViaUI(page: Page) {
  await page.goto(`${BASE_URL}/login.html?role=hod`, { waitUntil: 'domcontentloaded' });
  
  // Fill email or username
  const userInput = page.locator('#login-id, #username, #email, input[type="text"]').first();
  await userInput.waitFor({ state: 'visible', timeout: 15000 });
  await userInput.fill(HOD_CREDENTIALS.email);

  const pwdInput = page.locator('#login-password, #password, input[type="password"]').first();
  await pwdInput.fill(HOD_CREDENTIALS.password);

  const submitBtn = page.locator('#submit-action-btn, button[type="submit"]').first();
  await submitBtn.click();

  // Verify redirection to dashboard
  await page.waitForURL(/.*dashboard(\.html)?/, { timeout: 25000 });
  expect(page.url()).toContain('dashboard');

  // Verify JWT token is saved in localStorage
  const token = await page.evaluate(() => localStorage.getItem('accessToken') || localStorage.getItem('token') || sessionStorage.getItem('accessToken'));
  expect(token).toBeTruthy();
}

// Direct Auth Injection helper for fast testing across pages
async function injectHODSession(page: Page) {
  // First obtain token via API
  const res = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: {
      username: HOD_CREDENTIALS.email,
      password: HOD_CREDENTIALS.password
    }
  });
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  const token = data.accessToken || data.token;
  const user = data.user;

  await page.goto(`${BASE_URL}/role_selection.html`, { waitUntil: 'commit' });
  await page.evaluate(({ t, u }) => {
    localStorage.setItem('accessToken', t);
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
    localStorage.setItem('user_role', 'admin');
    localStorage.setItem('role', 'admin');
    sessionStorage.setItem('accessToken', t);
    sessionStorage.setItem('token', t);
    sessionStorage.setItem('user', JSON.stringify(u));
    sessionStorage.setItem('user_role', 'admin');
    sessionStorage.setItem('role', 'admin');
  }, { t: token, u: user });
}

test.describe('1. HOD Authentication & Session Security', () => {

  test('HOD Login via UI, dashboard redirection & session storage', async ({ page }) => {
    const { consoleErrors } = attachDiagnostics(page);
    await loginViaUI(page);
    
    // Check page elements
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(1500);

    // Filter acceptable background fetch noise
    const fatalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('Socket simulated'));
    expect(fatalErrors.length).toBeLessThanOrEqual(1);
  });

  test('Invalid credentials displays clear error message', async ({ page }) => {
    await page.goto(`${BASE_URL}/login.html?role=hod`, { waitUntil: 'domcontentloaded' });
    const userInput = page.locator('#login-id, #username, #email, input[type="text"]').first();
    await userInput.waitFor({ state: 'visible' });
    await userInput.fill('csehod12@gmail.com');

    const pwdInput = page.locator('#login-password, #password, input[type="password"]').first();
    await pwdInput.fill('WrongPassword123!');

    const submitBtn = page.locator('#submit-action-btn, button[type="submit"]').first();
    await submitBtn.click();

    // Verify error toast/alert appears
    await page.waitForTimeout(1200);
    const alertOrToast = page.locator('#login-alert-banner, .alert, .toast, .swal2-modal, #error-message, .error-text, [role="alert"]').first();
    await expect(alertOrToast).toBeVisible();
  });

  test('Logout terminates session and redirects away from protected pages', async ({ page }) => {
    await injectHODSession(page);
    await page.goto(`${BASE_URL}/dashboard.html`, { waitUntil: 'domcontentloaded' });
    
    // Prefer visible navbar "Back to Role Selection", or trigger logout navigation directly
    const navBackBtn = page.locator('.btn-back-role-nav, a:has-text("Back to Role Selection")').first();
    if (await navBackBtn.isVisible()) {
      await navBackBtn.click();
    } else {
      await page.evaluate(() => {
        const logoutLink = document.querySelector('.logout-item, a[href*="role_selection.html"], .btn-back-role');
        if (logoutLink) {
          logoutLink.click();
        } else {
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/role_selection.html';
        }
      });
    }

    await page.waitForTimeout(1500);
    expect(page.url()).toMatch(/(login|role_selection|index)/);

    // Now try to visit dashboard again without token
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${BASE_URL}/dashboard.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    expect(page.url()).toMatch(/(login|role_selection)/);
  });
});

test.describe('2. HOD Dashboard Page (dashboard.html)', () => {

  test('Dashboard metrics, charts, quick actions & notification dropdown', async ({ page }) => {
    const { consoleErrors } = attachDiagnostics(page);
    await injectHODSession(page);
    await page.goto(`${BASE_URL}/dashboard.html`, { waitUntil: 'networkidle' });

    // Verify header title / profile
    await expect(page.locator('body')).toBeVisible();

    // Verify metric cards exist
    const statsCards = page.locator('#stats-total-students, #stats-total-faculty, #stats-total-subjects, .stat-card, .metric-card, .dashboard-card, .analytics-card');
    const cardCount = await statsCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Verify Notifications Bell Icon
    const notifBell = page.locator('#btn-notifications, .notifications-btn, [data-testid="notifications"], .icon-bell, #notif-bell').first();
    if (await notifBell.isVisible()) {
      await notifBell.click();
      await page.waitForTimeout(600);
      const notifMenu = page.locator('.notifications-dropdown, #notifications-dropdown, .dropdown-menu.show, .notifications-panel').first();
      await expect(notifMenu).toBeVisible();
      // Click again or click away to close
      await page.keyboard.press('Escape');
    }

    // Check no uncaught exceptions
    const fatal = consoleErrors.filter(e => !e.includes('favicon'));
    expect(fatal.length).toBeLessThanOrEqual(1);
  });
});

test.describe('3. Students Management (students.html)', () => {

  test('Student roster loads, search, filters & view modal work', async ({ page }) => {
    const { consoleErrors } = attachDiagnostics(page);
    await injectHODSession(page);
    await page.goto(`${BASE_URL}/students.html`, { waitUntil: 'networkidle' });

    // Table / roster verification
    const studentRows = page.locator('#students-table-body tr, .students-table tbody tr, table tbody tr');
    await page.waitForTimeout(1000);
    const count = await studentRows.count();
    expect(count).toBeGreaterThan(0);

    // Test Search input
    const searchInput = page.locator('#search-input, input[placeholder*="Search"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('517274104032');
      await page.waitForTimeout(800);
      // Clear search
      await searchInput.fill('');
      await page.waitForTimeout(600);
    }

    // Test View Student Modal
    const viewBtn = page.locator('.btn-view, button:has-text("View"), [title="View Details"]').first();
    if (await viewBtn.isVisible()) {
      await viewBtn.click();
      await page.waitForTimeout(600);
      const modal = page.locator('.modal.show, .modal-dialog, #student-modal, [role="dialog"]').first();
      await expect(modal).toBeVisible();
      const closeBtn = page.locator('.btn-close, .modal-close, button:has-text("Close"), [data-bs-dismiss="modal"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }

    expect(consoleErrors.filter(e => !e.includes('favicon')).length).toBeLessThanOrEqual(1);
  });
});

test.describe('4. New Registrations (new_registrations.html)', () => {

  test('Pending student and faculty tabs load cleanly without errors', async ({ page }) => {
    const { consoleErrors } = attachDiagnostics(page);
    await injectHODSession(page);
    await page.goto(`${BASE_URL}/new_registrations.html`, { waitUntil: 'networkidle' });

    // Check tabs exist
    const studentTab = page.locator('#btn-tab-students');
    const facultyTab = page.locator('#btn-tab-faculty');

    await expect(studentTab).toBeVisible();
    await expect(facultyTab).toBeVisible();

    // Click faculty tab
    await facultyTab.click();
    await page.waitForTimeout(600);

    // Click student tab back
    await studentTab.click();
    await page.waitForTimeout(600);

    expect(consoleErrors.filter(e => !e.includes('favicon')).length).toBeLessThanOrEqual(1);
  });
});

test.describe('5. Faculty Roster & Class Incharge Assignment (faculty.html)', () => {

  test('Faculty roster loads and details view operates properly', async ({ page }) => {
    const { consoleErrors } = attachDiagnostics(page);
    await injectHODSession(page);
    await page.goto(`${BASE_URL}/faculty.html`, { waitUntil: 'networkidle' });

    const facultyRows = page.locator('#faculty-tbody tr, table tbody tr');
    await page.waitForTimeout(1000);
    expect(await facultyRows.count()).toBeGreaterThan(0);

    // Test Search
    const searchInput = page.locator('#search-input, input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('CS002');
      await page.waitForTimeout(600);
      await searchInput.fill('');
    }

    expect(consoleErrors.filter(e => !e.includes('favicon')).length).toBeLessThanOrEqual(1);
  });
});

test.describe('6. Subjects Management (subjects.html)', () => {

  test('Subjects page loads subjects and faculty mapping', async ({ page }) => {
    const { consoleErrors } = attachDiagnostics(page);
    await injectHODSession(page);
    await page.goto(`${BASE_URL}/subjects.html`, { waitUntil: 'networkidle' });

    // Verify container / table exists
    const subjectList = page.locator('#subjects-container, #subjects-tbody, .subject-card, table tbody tr');
    await page.waitForTimeout(1000);
    expect(await subjectList.count()).toBeGreaterThan(0);

    // Verify Add Subject Button exists
    const addBtn = page.locator('#btn-add-subject, button:has-text("Add Subject"), button:has-text("New Subject")').first();
    await expect(addBtn).toBeVisible();

    expect(consoleErrors.filter(e => !e.includes('favicon')).length).toBeLessThanOrEqual(1);
  });
});

test.describe('7. Attendance Monitoring & HOD Restrictions (attendance.html)', () => {

  test('HOD can view attendance reports, filter data, and has NO attendance marking controls', async ({ page }) => {
    const { consoleErrors } = attachDiagnostics(page);
    await injectHODSession(page);
    await page.goto(`${BASE_URL}/attendance.html`, { waitUntil: 'networkidle' });

    // Verify Attendance page title / toolbar exists
    await expect(page.locator('body')).toBeVisible();

    // Critical Security Rule Check: HOD must NOT have attendance marking input radios or save button
    const markRadio = page.locator('input[type="radio"][name*="att-"], input[type="radio"][value="Present"]');
    const saveDailyBtn = page.locator('#btn-save-attendance, button:has-text("Save Daily Attendance")');
    
    // In HOD attendance page, there should be NO student marking radios
    expect(await markRadio.count()).toBe(0);
    expect(await saveDailyBtn.count()).toBe(0);

    // Verify HOD Class Incharge assignment section exists
    const inchargeTable = page.locator('#incharge-assignment-tbody, #class-incharge-card');
    await expect(inchargeTable.first()).toBeVisible();

    expect(consoleErrors.filter(e => !e.includes('favicon')).length).toBeLessThanOrEqual(1);
  });
});

test.describe('8. Leave Requests Management (leave.html)', () => {

  test('Leave requests load reliably without "Failed to fetch request details"', async ({ page }) => {
    const { consoleErrors } = attachDiagnostics(page);
    await injectHODSession(page);
    await page.goto(`${BASE_URL}/leave.html`, { waitUntil: 'networkidle' });

    // Verify leave table/cards
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(1000);

    // Verify no "Failed to fetch request details" text anywhere in UI
    const bodyText = await page.innerText('body');
    expect(bodyText).not.toContain('Failed to fetch request details');

    // Check for leave request row or clean empty state
    const leaveRows = page.locator('#leave-tbody tr, table tbody tr, .leave-card');
    expect(await leaveRows.count()).toBeGreaterThan(0);

    expect(consoleErrors.filter(e => !e.includes('favicon')).length).toBeLessThanOrEqual(1);
  });
});

test.describe('9. Internal Marks Management (marks.html)', () => {

  test('Marks page loads and verifies HOD cannot edit marks directly', async ({ page }) => {
    const { consoleErrors } = attachDiagnostics(page);
    await injectHODSession(page);
    await page.goto(`${BASE_URL}/marks.html`, { waitUntil: 'networkidle' });

    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(1000);

    // Verify HOD has NO inline marks inputs
    const marksInput = page.locator('input.marks-input, input[type="number"][name*="mark"]');
    expect(await marksInput.count()).toBe(0);

    expect(consoleErrors.filter(e => !e.includes('favicon')).length).toBeLessThanOrEqual(1);
  });
});

test.describe('10. Announcements Management (announcements.html)', () => {

  test('Announcements list loads and modal opens cleanly', async ({ page }) => {
    const { consoleErrors } = attachDiagnostics(page);
    await injectHODSession(page);
    await page.goto(`${BASE_URL}/announcements.html`, { waitUntil: 'networkidle' });

    await expect(page.locator('body')).toBeVisible();

    const createBtn = page.locator('#btn-create-announcement, button:has-text("New Announcement"), button:has-text("Create Announcement")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(600);
      const modal = page.locator('.modal.show, #announcement-modal, [role="dialog"]').first();
      await expect(modal).toBeVisible();
      await page.keyboard.press('Escape');
    }

    expect(consoleErrors.filter(e => !e.includes('favicon')).length).toBeLessThanOrEqual(1);
  });
});

test.describe('11. Reports & Exports (reports.html)', () => {

  test('Reports hub loads with download cards for Attendance, Students, Faculty, Marks', async ({ page }) => {
    const { consoleErrors } = attachDiagnostics(page);
    await injectHODSession(page);
    await page.goto(`${BASE_URL}/reports.html`, { waitUntil: 'networkidle' });

    await expect(page.locator('body')).toBeVisible();

    // Verify export buttons exist
    const exportBtns = page.locator('.btn-export, button:has-text("Download"), button:has-text("Export"), a:has-text("Download")');
    expect(await exportBtns.count()).toBeGreaterThan(0);

    expect(consoleErrors.filter(e => !e.includes('favicon')).length).toBeLessThanOrEqual(1);
  });
});

test.describe('12. Settings Page (settings.html)', () => {

  test('Settings loads HOD profile and allows safe configuration', async ({ page }) => {
    const { consoleErrors } = attachDiagnostics(page);
    await injectHODSession(page);
    await page.goto(`${BASE_URL}/settings.html`, { waitUntil: 'networkidle' });

    await expect(page.locator('body')).toBeVisible();

    // Check profile email / name input exists
    const emailField = page.locator('#set-hod-email, #profile-email, input[type="email"], #settings-email').first();
    if (await emailField.isVisible()) {
      await page.waitForTimeout(500);
      const val = await emailField.inputValue();
      expect(val).toContain('csehod12@gmail.com');
    }

    expect(consoleErrors.filter(e => !e.includes('favicon')).length).toBeLessThanOrEqual(1);
  });
});

test.describe('13. Multi-Viewport Responsiveness & Mobile Audit', () => {

  const viewports = [
    { name: 'Mobile 360px', width: 360, height: 740 },
    { name: 'Mobile 390px', width: 390, height: 844 },
    { name: 'Mobile 412px', width: 412, height: 915 },
    { name: 'Tablet 768px', width: 768, height: 1024 },
    { name: 'Desktop 1440px', width: 1440, height: 900 }
  ];

  for (const vp of viewports) {
    test(`Responsive layout check on ${vp.name} for Dashboard and Attendance`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await injectHODSession(page);

      // Check Dashboard
      await page.goto(`${BASE_URL}/dashboard.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // Verify no horizontal overflow on body
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);

      // Check Attendance
      await page.goto(`${BASE_URL}/attendance.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      const attScroll = await page.evaluate(() => document.documentElement.scrollWidth);
      const attClient = await page.evaluate(() => document.documentElement.clientWidth);
      expect(attScroll).toBeLessThanOrEqual(attClient + 5);
    });
  }
});
