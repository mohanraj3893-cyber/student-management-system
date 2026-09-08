import fs from 'fs';
import path from 'path';

const telemetryPath = path.join(process.cwd(), 'test-results', 'audit_telemetry.json');
const reportHtmlPath = path.join(process.cwd(), 'test-results', 'audit_report.html');
const reportMdPath = path.join(process.cwd(), 'test-results', 'audit_report.md');

if (!fs.existsSync(telemetryPath)) {
  console.log('No telemetry file found at:', telemetryPath);
  process.exit(0);
}

const raw = fs.readFileSync(telemetryPath, 'utf-8');
const entries = JSON.parse(raw);

// Deduplicate entries by name and viewport
const map = new Map();
entries.forEach(e => {
  const key = `${e.name}__${e.viewport}`;
  map.set(key, e);
});
const records = Array.from(map.values());

const totalPagesTested = records.length;
const overflowIssues = records.filter(r => r.hasHorizontalScroll);
const consoleIssues = records.filter(r => r.consoleErrors && r.consoleErrors.length > 0);
const networkIssues = records.filter(r => r.networkErrors && r.networkErrors.length > 0);
const a11yIssues = records.filter(r => r.missingA11y && r.missingA11y.length > 0);

// Classify bugs
const bugList = [];

overflowIssues.forEach(r => {
  bugList.push({
    page: r.name,
    viewport: r.viewport,
    issue: `Horizontal scroll overflow detected (${r.scrollWidth}px > ${r.innerWidth}px)`,
    severity: 'High',
    screenshot: r.screenshotPath
  });
});

consoleIssues.forEach(r => {
  r.consoleErrors.forEach(err => {
    bugList.push({
      page: r.name,
      viewport: r.viewport,
      issue: `Console Error: ${err}`,
      severity: err.includes('Uncaught') || err.includes('TypeError') ? 'High' : 'Medium',
      screenshot: r.screenshotPath
    });
  });
});

networkIssues.forEach(r => {
  r.networkErrors.forEach(net => {
    bugList.push({
      page: r.name,
      viewport: r.viewport,
      issue: `HTTP ${net.status} on ${net.url}`,
      severity: net.status >= 500 ? 'Critical' : 'Medium',
      screenshot: r.screenshotPath
    });
  });
});

a11yIssues.forEach(r => {
  r.missingA11y.forEach(a11y => {
    bugList.push({
      page: r.name,
      viewport: r.viewport,
      issue: `Accessibility: ${a11y.details}`,
      severity: 'Low',
      screenshot: r.screenshotPath
    });
  });
});

const criticalCount = bugList.filter(b => b.severity === 'Critical').length;
const highCount = bugList.filter(b => b.severity === 'High').length;
const mediumCount = bugList.filter(b => b.severity === 'Medium').length;
const lowCount = bugList.filter(b => b.severity === 'Low').length;

// Average performance
const avgLoad = Math.round(records.reduce((acc, r) => acc + (r.loadTimeMs || 0), 0) / (records.length || 1));
const avgFcp = Math.round(records.reduce((acc, r) => acc + (r.fcpMs || 0), 0) / (records.length || 1));
const avgDom = Math.round(records.reduce((acc, r) => acc + (r.domContentLoadedMs || 0), 0) / (records.length || 1));

// HTML Generation
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSE Department Portal — UI/UX Automated Audit Report</title>
  <style>
    :root {
      --primary: #0056D2;
      --bg: #F8FAFC;
      --surface: #FFFFFF;
      --text: #0F172A;
      --text-muted: #64748B;
      --border: #E2E8F0;
      --danger: #EF4444;
      --warning: #F59E0B;
      --info: #3B82F6;
      --success: #10B981;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      margin: 0;
      padding: 24px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      background: var(--surface);
      padding: 28px;
      border-radius: 12px;
      border: 1px solid var(--border);
      margin-bottom: 24px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    h1 {
      margin: 0 0 8px 0;
      font-size: 1.8rem;
      color: var(--primary);
    }
    .meta {
      color: var(--text-muted);
      font-size: 0.9rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--surface);
      padding: 20px;
      border-radius: 10px;
      border: 1px solid var(--border);
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }
    .stat-val {
      font-size: 2rem;
      font-weight: 700;
      margin-top: 4px;
    }
    .badge-critical { color: var(--danger); }
    .badge-high { color: #EA580C; }
    .badge-medium { color: var(--warning); }
    .badge-low { color: var(--info); }
    .badge-pass { color: var(--success); }

    .card {
      background: var(--surface);
      border-radius: 12px;
      border: 1px solid var(--border);
      padding: 24px;
      margin-bottom: 24px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 0.9rem;
    }
    th, td {
      padding: 12px;
      border-bottom: 1px solid var(--border);
      text-align: left;
    }
    th {
      background: #F1F5F9;
      font-weight: 600;
      color: var(--text-muted);
    }
    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .tag-critical { background: #FEE2E2; color: #991B1B; }
    .tag-high { background: #FFEDD5; color: #9A3412; }
    .tag-medium { background: #FEF3C7; color: #92400E; }
    .tag-low { background: #E0E7FF; color: #3730A3; }
    .tag-pass { background: #D1FAE5; color: #065F46; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>CSE Department Portal — 100% UI/UX Automated Audit</h1>
      <div class="meta">Target: <strong>https://student-management-system.sbcecsms3.workers.dev/</strong> • Generated: <strong>${new Date().toLocaleString()}</strong></div>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="meta">Total Audits</div>
        <div class="stat-val badge-pass">${totalPagesTested}</div>
      </div>
      <div class="stat-card">
        <div class="meta">Critical Bugs</div>
        <div class="stat-val ${criticalCount > 0 ? 'badge-critical' : 'badge-pass'}">${criticalCount}</div>
      </div>
      <div class="stat-card">
        <div class="meta">High Severity</div>
        <div class="stat-val ${highCount > 0 ? 'badge-high' : 'badge-pass'}">${highCount}</div>
      </div>
      <div class="stat-card">
        <div class="meta">Avg Load Time</div>
        <div class="stat-val">${avgLoad}ms</div>
      </div>
      <div class="stat-card">
        <div class="meta">Avg FCP</div>
        <div class="stat-val">${avgFcp}ms</div>
      </div>
    </div>

    <div class="card">
      <h2>Discovered Issues & Bug Classification (${bugList.length})</h2>
      ${bugList.length === 0 ? '<p style="color:var(--success); font-weight:600;">🎉 Zero UI/UX bugs discovered! All pages render with 100% precision and zero horizontal scroll.</p>' : `
      <table>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Page</th>
            <th>Viewport</th>
            <th>Issue Details</th>
            <th>Artifact</th>
          </tr>
        </thead>
        <tbody>
          ${bugList.map(b => `
          <tr>
            <td><span class="tag tag-${b.severity.toLowerCase()}">${b.severity}</span></td>
            <td><strong>${b.page}</strong></td>
            <td>${b.viewport}</td>
            <td>${b.issue}</td>
            <td><a href="../${b.screenshot}" target="_blank">View Screenshot</a></td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      `}
    </div>

    <div class="card">
      <h2>Audited Pages Roster (${records.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Page Name</th>
            <th>Portal Role</th>
            <th>Viewport</th>
            <th>Load Time</th>
            <th>FCP</th>
            <th>Horizontal Scroll</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(r => `
          <tr>
            <td><strong>${r.name}</strong></td>
            <td>${r.role.toUpperCase()}</td>
            <td>${r.viewport}</td>
            <td>${r.loadTimeMs}ms</td>
            <td>${r.fcpMs}ms</td>
            <td>${r.hasHorizontalScroll ? '<span class="tag tag-high">OVERFLOW</span>' : '<span class="tag tag-pass">ZERO OVERFLOW</span>'}</td>
            <td>${!r.hasHorizontalScroll && (!r.consoleErrors || r.consoleErrors.length === 0) ? '<span class="tag tag-pass">HEALTHY</span>' : '<span class="tag tag-medium">FLAGGED</span>'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

  </div>
</body>
</html>`;

fs.writeFileSync(reportHtmlPath, html, 'utf-8');

// Markdown Generation
let md = `# CSE Department Portal — Automated UI/UX Audit Report

**Target URL**: https://student-management-system.sbcecsms3.workers.dev/  
**Generated**: ${new Date().toISOString()}  
**Total Pages Tested**: ${totalPagesTested}  
**Average Load Time**: ${avgLoad}ms  
**Average First Contentful Paint**: ${avgFcp}ms  

---

## 📊 Summary Metrics

| Metric | Value |
|---|---|
| **Total Pages Tested** | ${totalPagesTested} |
| **Critical Issues** | ${criticalCount} |
| **High Severity Issues** | ${highCount} |
| **Medium Severity Issues** | ${mediumCount} |
| **Low / Accessibility Warnings** | ${lowCount} |
| **Horizontal Scroll Overflows** | ${overflowIssues.length} |

---

## 🐛 Bug Classification

${bugList.length === 0 ? '✅ **Zero UI/UX bugs discovered! All pages pass inspection.**' : ''}
${bugList.map(b => `- **[${b.severity.toUpperCase()}]** \`${b.page}\` (${b.viewport}): ${b.issue}`).join('\n')}

---

## 📋 Audited Pages

| Page | Role | Viewport | Load (ms) | FCP (ms) | Horizontal Scroll |
|---|---|---|:---:|:---:|:---:|
${records.map(r => `| ${r.name} | ${r.role.toUpperCase()} | ${r.viewport} | ${r.loadTimeMs} | ${r.fcpMs} | ${r.hasHorizontalScroll ? '⚠️ Overflow' : '✅ Clean'} |`).join('\n')}
`;

fs.writeFileSync(reportMdPath, md, 'utf-8');
console.log(`Report generated successfully!`);
console.log(`HTML: ${reportHtmlPath}`);
console.log(`Markdown: ${reportMdPath}`);
