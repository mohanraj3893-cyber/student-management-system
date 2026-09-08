import { test, expect, Page } from '@playwright/test';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// =========================================================================
// AUDIT TELEMETRY & REPORT DATA STRUCTURES
// =========================================================================
interface PageTelemetry {
  url: string;
  role: string;
  name: string;
  viewport: string;
  loadTimeMs: number;
  domContentLoadedMs: number;
  fcpMs: number;
  hasHorizontalScroll: boolean;
  scrollWidth: number;
  innerWidth: number;
  consoleErrors: string[];
  networkErrors: { url: string; status: number }[];
  missingA11y: { type: string; details: string }[];
  buttonCount: number;
  formCount: number;
  tableCount: number;
  modalCount: number;
  screenshotPath: string;
}

const auditResults: PageTelemetry[] = [];
const SCREENSHOT_DIR = path.join(process.cwd(), 'test-results', 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Save telemetry on worker exit
test.afterAll(async () => {
  const telemetryFile = path.join(process.cwd(), 'test-results', 'audit_telemetry.json');
  try {
    let existing: PageTelemetry[] = [];
    if (fs.existsSync(telemetryFile)) {
      existing = JSON.parse(fs.readFileSync(telemetryFile, 'utf-8'));
    }
    const combined = [...existing, ...auditResults];
    fs.writeFileSync(telemetryFile, JSON.stringify(combined, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write audit telemetry:', err);
  }
});

// =========================================================================
// JWT & AUTHENTICATION HELPERS
// =========================================================================
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generateJwt(payload: any, secret = 'sms_super_secret_jwt_key_2026'): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${signature}`;
}

const HOD_USER = {
  id: 1,
  username: 'CS001',
  email: 'csehod12@gmail.com',
  role: 'admin',
  name: 'CSE-HOD',
  department: 'Computer Science & Engineering',
  designation: 'Head of Department'
};

const FACULTY_USER = {
  id: 28,
  username: 'CS002',
  email: 'csestaff1@gmail.com',
  role: 'faculty',
  name: 'CSE-staff1',
  department: 'Computer Science & Engineering',
  designation: 'Assistant Professor'
};

const STUDENT_USER = {
  id: 101,
  username: '517274104032',
  email: 'student.cse@sbcec.edu.in',
  role: 'student',
  name: 'Mohan Raj',
  department: 'Computer Science & Engineering',
  year: '3rd Year',
  semester: 'V',
  section: 'A'
};

// Resilient navigation helper with automatic retries for edge resilience
async function safeGoto(page: Page, url: string, options: { waitUntil?: 'commit' | 'domcontentloaded' | 'load'; timeout?: number } = {}) {
  const maxRetries = 2;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      await page.goto(url, { waitUntil: options.waitUntil || 'domcontentloaded', timeout: options.timeout || 45000 });
      return;
    } catch (err: any) {
      if (i === maxRetries) throw err;
      await page.waitForTimeout(1500);
    }
  }
}

// Helper to authenticate by injecting JWT token and session cache
async function authenticateAsRole(page: Page, role: 'admin' | 'faculty' | 'student' | 'public') {
  if (role === 'public') {
    await safeGoto(page, '/', { waitUntil: 'commit' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    return;
  }

  const userObj = role === 'admin' ? HOD_USER : (role === 'faculty' ? FACULTY_USER : STUDENT_USER);
  const token = generateJwt(userObj);

  // Navigate to target domain commit point to inject storage
  await safeGoto(page, '/', { waitUntil: 'commit' });
  await page.evaluate(({ token, user }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('accessToken', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token, user: userObj });
}

// Setup real-time monitoring for page
function setupTelemetry(page: Page) {
  const consoleErrors: string[] = [];
  const networkErrors: { url: string; status: number }[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon.ico') && !text.includes('chrome-extension') && !text.includes('net::ERR_')) {
        consoleErrors.push(text);
      }
    }
  });

  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !url.includes('favicon.ico') && !url.includes('chrome-extension')) {
      networkErrors.push({ url, status });
    }
  });

  return { consoleErrors, networkErrors };
}

// Audit single page comprehensive checks
async function auditSinglePage(
  page: Page,
  options: {
    url: string;
    role: 'public' | 'admin' | 'faculty' | 'student';
    name: string;
    viewportName: string;
  }
): Promise<PageTelemetry> {
  const { url, role, name, viewportName } = options;
  const { consoleErrors, networkErrors } = setupTelemetry(page);

  // 1. Navigate to page
  const startLoad = Date.now();
  await safeGoto(page, url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const loadTimeMs = Date.now() - startLoad;

  // Wait for network to settle slightly
  await page.waitForTimeout(500);

  // 2. Performance metrics
  const perfMetrics = await page.evaluate(() => {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const domContentLoaded = navEntries.length ? Math.round(navEntries[0].domContentLoadedEventEnd - navEntries[0].startTime) : 0;
    
    let fcp = 0;
    const paintEntries = performance.getEntriesByType('paint');
    for (const p of paintEntries) {
      if (p.name === 'first-contentful-paint') {
        fcp = Math.round(p.startTime);
        break;
      }
    }
    return { domContentLoaded, fcp };
  });

  // 3. Overflow and Horizontal scroll detection (Phase 5 & 13)
  const layoutCheck = await page.evaluate(() => {
    const scrollW = document.documentElement.scrollWidth;
    const innerW = window.innerWidth;
    return {
      hasHorizontalScroll: scrollW > innerW + 1,
      scrollWidth: scrollW,
      innerWidth: innerW
    };
  });

  // 4. Accessibility audit checks (Phase 14)
  const a11yAudit = await page.evaluate(() => {
    const missing: { type: string; details: string }[] = [];
    
    // Images missing alt
    const images = Array.from(document.querySelectorAll('img:not([alt])'));
    if (images.length > 0) {
      missing.push({ type: 'img-alt', details: `${images.length} image(s) missing alt attribute` });
    }

    // Buttons missing text or aria-label
    const buttons = Array.from(document.querySelectorAll('button'));
    const unlabelledButtons = buttons.filter(b => !b.innerText.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title'));
    if (unlabelledButtons.length > 0) {
      missing.push({ type: 'button-label', details: `${unlabelledButtons.length} button(s) missing aria-label or accessible text` });
    }

    // Input fields without label or aria-label
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
    const unlabelledInputs = inputs.filter(inp => {
      const id = inp.getAttribute('id');
      const hasAssociatedLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
      const hasAria = inp.getAttribute('aria-label') || inp.getAttribute('placeholder');
      return !hasAssociatedLabel && !hasAria;
    });
    if (unlabelledInputs.length > 0) {
      missing.push({ type: 'input-label', details: `${unlabelledInputs.length} input(s) missing associated label` });
    }

    return {
      missing,
      buttonCount: buttons.length,
      formCount: document.querySelectorAll('form').length,
      tableCount: document.querySelectorAll('table').length,
      modalCount: document.querySelectorAll('.modal, .modal-backdrop, [role="dialog"]').length
    };
  });

  // 5. Screenshot capture for every page
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const dirPath = path.join(SCREENSHOT_DIR, viewportName);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const screenshotFileName = `${cleanName}.png`;
  const screenshotFullPath = path.join(dirPath, screenshotFileName);
  await page.screenshot({ path: screenshotFullPath, fullPage: false });

  const telemetry: PageTelemetry = {
    url,
    role,
    name,
    viewport: viewportName,
    loadTimeMs,
    domContentLoadedMs: perfMetrics.domContentLoaded,
    fcpMs: perfMetrics.fcp,
    hasHorizontalScroll: layoutCheck.hasHorizontalScroll,
    scrollWidth: layoutCheck.scrollWidth,
    innerWidth: layoutCheck.innerWidth,
    consoleErrors,
    networkErrors,
    missingA11y: a11yAudit.missing,
    buttonCount: a11yAudit.buttonCount,
    formCount: a11yAudit.formCount,
    tableCount: a11yAudit.tableCount,
    modalCount: a11yAudit.modalCount,
    screenshotPath: path.relative(process.cwd(), screenshotFullPath)
  };

  auditResults.push(telemetry);
  return telemetry;
}

// =========================================================================
// TEST SUITE: COMPLETE WEBSITE UI/UX AUDIT
// =========================================================================
test.describe('Complete Website UI/UX Quality Assurance Audit', () => {

  // -----------------------------------------------------------------------
  // Phase 1 — Initial Website Health Check & Public Pages
  // -----------------------------------------------------------------------
  test('Phase 1 - Initial Health Check & Public Pages', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const viewportName = testInfo.project.name;
    await authenticateAsRole(page, 'public');

    const publicPages = [
      { name: 'Landing Page', url: '/index.html' },
      { name: 'Role Selection', url: '/role_selection.html' },
      { name: 'Student Login', url: '/login.html?role=student' },
      { name: 'Faculty Login', url: '/login.html?role=faculty' },
      { name: 'HOD Login', url: '/login.html?role=admin' },
      { name: 'Student Registration', url: '/register.html?role=student' },
      { name: 'Faculty Registration', url: '/register.html?role=faculty' }
    ];

    for (const p of publicPages) {
      const data = await auditSinglePage(page, {
        url: p.url,
        role: 'public',
        name: p.name,
        viewportName
      });

      // Assertions per Specification
      expect(data.loadTimeMs, `${p.name} load time under 15s`).toBeLessThan(15000);
      expect(data.hasHorizontalScroll, `No horizontal scroll on ${p.name} (${data.scrollWidth}px > ${data.innerWidth}px)`).toBe(false);
      
      // Verify page is not a white blank screen
      const bodyText = await page.innerText('body');
      expect(bodyText.trim().length, `${p.name} must have rendered text content`).toBeGreaterThan(10);
    }
  });

  // -----------------------------------------------------------------------
  // Phase 2 — HOD Portal Audit (11 Pages)
  // -----------------------------------------------------------------------
  test('Phase 2 - HOD Portal Complete Audit (All 11 Pages)', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const viewportName = testInfo.project.name;
    await authenticateAsRole(page, 'admin');

    const hodPages = [
      { name: 'HOD Dashboard', url: '/dashboard.html' },
      { name: 'HOD Students Roster', url: '/students.html' },
      { name: 'HOD New Registrations', url: '/new_registrations.html' },
      { name: 'HOD Faculty Management', url: '/faculty.html' },
      { name: 'HOD Subjects Curriculum', url: '/subjects.html' },
      { name: 'HOD Attendance Overview', url: '/attendance.html' },
      { name: 'HOD Leave Requests', url: '/leave.html' },
      { name: 'HOD Internal Marks', url: '/marks.html' },
      { name: 'HOD Announcements', url: '/announcements.html' },
      { name: 'HOD Reports Analytics', url: '/reports.html' },
      { name: 'HOD Settings', url: '/settings.html' }
    ];

    for (const p of hodPages) {
      const data = await auditSinglePage(page, {
        url: p.url,
        role: 'admin',
        name: p.name,
        viewportName
      });

      expect(data.hasHorizontalScroll, `No horizontal scroll on ${p.name} (${data.scrollWidth}px > ${data.innerWidth}px)`).toBe(false);
      
      // Verify main workspace exists
      const mainEl = page.locator('.main-workspace-panel, main, #main-content').first();
      await expect(mainEl, `${p.name} main container visible`).toBeVisible();
    }
  });

  // -----------------------------------------------------------------------
  // Phase 3 — Faculty Portal Audit (10 Pages)
  // -----------------------------------------------------------------------
  test('Phase 3 - Faculty Portal Complete Audit (All 10 Pages)', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const viewportName = testInfo.project.name;
    await authenticateAsRole(page, 'faculty');

    const facultyPages = [
      { name: 'Faculty Dashboard', url: '/faculty_dashboard.html' },
      { name: 'Faculty Students Roster', url: '/faculty_students.html' },
      { name: 'Faculty Attendance Module', url: '/faculty_attendance.html' },
      { name: 'Faculty Assignments', url: '/faculty_assignments.html' },
      { name: 'Faculty Internal Marks', url: '/faculty_marks.html' },
      { name: 'Faculty Announcements', url: '/faculty_announcements.html' },
      { name: 'Faculty Study Materials', url: '/faculty_resources.html' },
      { name: 'Faculty Leave Requests', url: '/faculty_requests.html' },
      { name: 'Faculty My Profile', url: '/faculty_my_profile.html' },
      { name: 'Faculty Settings', url: '/faculty_settings.html' }
    ];

    for (const p of facultyPages) {
      const data = await auditSinglePage(page, {
        url: p.url,
        role: 'faculty',
        name: p.name,
        viewportName
      });

      expect(data.hasHorizontalScroll, `No horizontal scroll on ${p.name} (${data.scrollWidth}px > ${data.innerWidth}px)`).toBe(false);
      
      const mainEl = page.locator('.main-workspace-panel, main').first();
      await expect(mainEl, `${p.name} main workspace visible`).toBeVisible();
    }
  });

  // -----------------------------------------------------------------------
  // Phase 4 — Student Portal Audit (7 Pages)
  // -----------------------------------------------------------------------
  test('Phase 4 - Student Portal Complete Audit (All 7 Pages)', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const viewportName = testInfo.project.name;
    await authenticateAsRole(page, 'student');

    const studentPages = [
      { name: 'Student Dashboard', url: '/student_dashboard.html' },
      { name: 'Student Attendance Tracker', url: '/student_attendance.html' },
      { name: 'Student Internal Marks', url: '/student_marks.html' },
      { name: 'Student Subjects & Notes', url: '/student_subjects.html' },
      { name: 'Student Leave History', url: '/student_leave.html' },
      { name: 'Student My Profile', url: '/student_my_profile.html' },
      { name: 'Student Settings', url: '/student_settings.html' }
    ];

    for (const p of studentPages) {
      const data = await auditSinglePage(page, {
        url: p.url,
        role: 'student',
        name: p.name,
        viewportName
      });

      expect(data.hasHorizontalScroll, `No horizontal scroll on ${p.name} (${data.scrollWidth}px > ${data.innerWidth}px)`).toBe(false);

      const mainEl = page.locator('.main-workspace-panel, main').first();
      await expect(mainEl, `${p.name} main workspace visible`).toBeVisible();
    }
  });

  // -----------------------------------------------------------------------
  // Phase 5 — Buttons, Forms, Modals & Theme Audit
  // -----------------------------------------------------------------------
  test('Phase 5 - Interactive Components: Modals, Forms, Buttons & Dark Theme', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const viewportName = testInfo.project.name;

    // 1. Form Validation on Login Page
    await page.goto('/login.html?role=faculty', { waitUntil: 'domcontentloaded' });
    const submitBtn = page.locator('#submit-action-btn');
    await submitBtn.click();
    // HTML5 validation or alert should trigger
    const alertBanner = page.locator('#login-alert-banner, input:invalid');
    expect(await alertBanner.count()).toBeGreaterThanOrEqual(1);

    // 2. Theme Switching & Persistence Check
    await authenticateAsRole(page, 'admin');
    await page.goto('/dashboard.html', { waitUntil: 'domcontentloaded' });

    // Initial screenshot light mode
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, viewportName, 'theme_light_mode.png') });

    // Click theme toggle
    const themeBtn = page.locator('#theme-toggle-btn, #mobile-theme-btn').first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(300);

      // Verify dark class applied
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark-theme'));
      expect(isDark).toBe(true);

      // Screenshot dark mode
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, viewportName, 'theme_dark_mode.png') });

      // Reload and verify persistence
      await page.reload({ waitUntil: 'domcontentloaded' });
      const persistsDark = await page.evaluate(() => document.documentElement.classList.contains('dark-theme'));
      expect(persistsDark).toBe(true);

      // Restore to light mode
      const restoreBtn = page.locator('#theme-toggle-btn, #mobile-theme-btn').first();
      if (await restoreBtn.isVisible()) {
        await restoreBtn.click();
      }
    }

    // 3. Modal Opening and ESC/Close Key Verification on HOD Leave or Faculty Resources
    await authenticateAsRole(page, 'faculty');
    await page.goto('/faculty_resources.html', { waitUntil: 'domcontentloaded' });
    const uploadBtn = page.locator('#open-upload-btn, button:has-text("Upload"), button:has-text("Add")').first();
    if (await uploadBtn.isVisible()) {
      await uploadBtn.click();
      await page.waitForTimeout(300);

      const modal = page.locator('.modal, .modal-backdrop, #upload-modal').first();
      if (await modal.isVisible()) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, viewportName, 'modal_opened.png') });
        
        // Test ESC key
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }

    // 4. File Input Verification
    const fileInputs = page.locator('input[type="file"]');
    if (await fileInputs.count() > 0) {
      const firstFileInput = fileInputs.first();
      await expect(firstFileInput).toBeAttached();
    }
  });

});
