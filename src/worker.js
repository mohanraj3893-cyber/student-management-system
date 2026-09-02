// Cloudflare Worker Fullstack Entrypoint
// Complete Production-Grade Edge API Router with Cloudflare D1 Database

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...headers
    }
  });
}

// Password hashing with WebCrypto SHA-256
async function hashPassword(password) {
  const enc = new TextEncoder();
  const data = enc.encode(password + ':sms_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, storedHash) {
  const computed = await hashPassword(password);
  return computed === storedHash;
}

// =============================================================
// ACADEMIC DATA NORMALIZATION HELPERS
// =============================================================
const DEPT_MAP = {
  'cse': 'computer science and engineering',
  'it': 'information technology',
  'ece': 'electronics and communication engineering',
  'eee': 'electrical and electronics engineering',
  'mech': 'mechanical engineering',
  'civil': 'civil engineering',
  'aids': 'artificial intelligence and data science',
  'aiml': 'artificial intelligence and machine learning'
};

function normalizeDept(dept) {
  if (!dept) return '';
  let clean = String(dept).trim().toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
  if (DEPT_MAP[clean]) clean = DEPT_MAP[clean].replace(/[^a-z0-9]/g, '');
  return clean;
}

function isDepartmentMatch(deptA, deptB) {
  if (!deptA || !deptB) return false;
  const normA = normalizeDept(deptA);
  const normB = normalizeDept(deptB);
  if (normA === normB) return true;
  return normA.includes(normB) || normB.includes(normA);
}

function getSemNum(sem) {
  if (sem === null || sem === undefined) return 0;
  const str = String(sem).trim().toUpperCase();
  if (str.includes('VIII') || str === '8' || str.includes('SEM 8')) return 8;
  if (str.includes('VII') || str === '7' || str.includes('SEM 7')) return 7;
  if (str.includes('VI') || str === '6' || str.includes('SEM 6')) return 6;
  if (str.includes('IV') || str === '4' || str.includes('SEM 4')) return 4;
  if (str.includes('V') || str === '5' || str.includes('SEM 5')) return 5;
  if (str.includes('III') || str === '3' || str.includes('SEM 3')) return 3;
  if (str.includes('II') || str === '2' || str.includes('SEM 2')) return 2;
  if (str.includes('I') || str === '1' || str.includes('SEM 1')) return 1;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function getYearNum(yr) {
  if (yr === null || yr === undefined) return 0;
  const str = String(yr).trim().toUpperCase();
  if (str.includes('4TH') || str.includes('IV') || str === '4') return 4;
  if (str.includes('3RD') || str.includes('III') || str === '3') return 3;
  if (str.includes('2ND') || str.includes('II') || str === '2') return 2;
  if (str.includes('1ST') || str.includes('I') || str === '1') return 1;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function isSemesterMatch(semA, semB) {
  if (!semA || !semB) return false;
  const numA = getSemNum(semA);
  const numB = getSemNum(semB);
  if (numA > 0 && numB > 0) return numA === numB;
  return String(semA).trim().toLowerCase() === String(semB).trim().toLowerCase();
}

function isYearMatch(yrA, yrB) {
  if (!yrA || !yrB) return false;
  const numA = getYearNum(yrA);
  const numB = getYearNum(yrB);
  if (numA > 0 && numB > 0) return numA === numB;
  return String(yrA).trim().toLowerCase() === String(yrB).trim().toLowerCase();
}

function isSectionMatch(secA, secB) {
  if (!secA || !secB) return false;
  return String(secA).trim().toUpperCase() === String(secB).trim().toUpperCase();
}

function calculateLeaveDays(fromDateStr, toDateStr, fallbackDays = 1) {
  if (!fromDateStr || !toDateStr) return parseInt(fallbackDays || 1, 10) || 1;
  try {
    const start = new Date(fromDateStr);
    const end = new Date(toDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return parseInt(fallbackDays || 1, 10) || 1;
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 1;
  } catch (e) {
    return parseInt(fallbackDays || 1, 10) || 1;
  }
}

// Lightweight JWT implementation using WebCrypto HMAC-SHA256
async function signJwt(payload, secret = 'sms_super_secret_jwt_key_2026') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + (24 * 3600) }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const data = `${encodedHeader}.${encodedPayload}`;
  
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
  return `${data}.${encodedSignature}`;
}

async function verifyJwt(token, secret = 'sms_super_secret_jwt_key_2026') {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;
    
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const sigStr = atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/'));
    const sigBytes = new Uint8Array(sigStr.length);
    for (let i = 0; i < sigStr.length; i++) sigBytes[i] = sigStr.charCodeAt(i);
    
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!valid) return null;
    
    const payloadStr = atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadStr);
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

async function getUserFromRequest(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (!token) return null;
  return await verifyJwt(token, env.JWT_SECRET || 'sms_super_secret_jwt_key_2026');
}

// =============================================================
// VAPID & WEB PUSH NOTIFICATION HELPERS (CLOUDFLARE NATIVE)
// =============================================================
const DEFAULT_VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-Skv6_DQhxbWvY004rSNb_vwGlMkTXAYabSRMxC2xQnKE25_Ge_00DHA';
const DEFAULT_VAPID_PRIVATE_KEY = {
  kty: 'EC',
  crv: 'P-256',
  x: 'EXrqJRiBSKvEiS_r3JWIS6IEhr4hv35KS_r8NCHFta8',
  y: 'rThtI1v-_AaUyRNcBhptJEzELbFCcoTbn8Z7_TQMHA',
  d: '5Jj3ZkWG248K7_424qR5wN6mP99wRzL4_B28jQv5X8A'
};

async function generateVapidAuthHeader(endpoint, env) {
  try {
    const origin = new URL(endpoint).origin;
    const now = Math.floor(Date.now() / 1000);

    const header = { typ: 'JWT', alg: 'ES256' };
    const claims = {
      aud: origin,
      exp: now + (12 * 3600),
      sub: env.VAPID_SUBJECT || 'mailto:admin@sbcec.edu.in'
    };

    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedClaims = btoa(JSON.stringify(claims)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const data = `${encodedHeader}.${encodedClaims}`;

    let jwk = DEFAULT_VAPID_PRIVATE_KEY;
    if (env.VAPID_PRIVATE_KEY) {
      try { jwk = JSON.parse(env.VAPID_PRIVATE_KEY); } catch (e) {}
    }

    const privateKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );

    const rawSig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      privateKey,
      new TextEncoder().encode(data)
    );

    const encodedSig = btoa(String.fromCharCode(...new Uint8Array(rawSig)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const jwt = `${data}.${encodedSig}`;
    const pubKey = env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
    return `vapid t=${jwt}, k=${pubKey}`;
  } catch (err) {
    console.error('[WebPush] Failed to generate VAPID header:', err);
    return null;
  }
}

async function sendPushNotificationToUser(db, env, userId, payload) {
  if (!db || !userId) return;
  try {
    const subs = await db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?')
      .bind(userId).all();

    if (!subs.results || subs.results.length === 0) return;

    for (const sub of subs.results) {
      await dispatchWebPush(db, env, sub, payload);
    }
  } catch (err) {
    console.error('[WebPush] Error dispatching push to user ' + userId + ':', err);
  }
}

async function dispatchWebPush(db, env, sub, payload) {
  try {
    const authHeader = await generateVapidAuthHeader(sub.endpoint, env);
    if (!authHeader) return;

    const bodyStr = JSON.stringify(payload);

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'TTL': '86400',
        'Urgency': 'high',
        'Content-Type': 'text/plain'
      },
      body: bodyStr
    });

    if (res.status === 404 || res.status === 410) {
      // Remove stale / expired device subscription
      await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
    }
  } catch (err) {
    console.warn('[WebPush] Network delivery skipped for endpoint:', err.message);
  }
}

// -------------------------------------------------------------------
// MAIN API ROUTER
// -------------------------------------------------------------------
async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  const db = env.DB;
  if (!db) {
    return jsonResponse({ message: 'Cloudflare D1 Database binding (DB) is missing.' }, 500);
  }

  try {
    // Ensure push_subscriptions table exists
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `).run().catch(() => {});

    // Ensure class_incharges table exists
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS class_incharges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        faculty_id INTEGER NOT NULL,
        department TEXT NOT NULL,
        year TEXT NOT NULL,
        semester TEXT NOT NULL,
        section TEXT NOT NULL DEFAULT 'A',
        assigned_by INTEGER,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(department, year, semester, section)
      )
    `).run().catch(() => {});

    // Repair existing leave request days calculation in D1 database
    await db.prepare(`
      UPDATE leave_requests
      SET number_of_days = CAST(julianday(to_date) - julianday(from_date) + 1 AS INTEGER)
      WHERE to_date IS NOT NULL AND from_date IS NOT NULL AND julianday(to_date) >= julianday(from_date)
    `).run().catch(() => {});

    // =============================================================
    // 1. AUTHENTICATION & INITIAL SETUP
    // =============================================================
    if (path === '/api/auth/admin-exists' && method === 'GET') {
      const adminRole = await db.prepare('SELECT id FROM roles WHERE name = ?').bind('admin').first();
      if (!adminRole) return jsonResponse({ exists: false, count: 0 });
      const adminUser = await db.prepare('SELECT id FROM users WHERE role_id = ?').bind(adminRole.id).first();
      return jsonResponse({ exists: !!adminUser, count: adminUser ? 1 : 0 });
    }

    if (path === '/api/auth/register' && method === 'POST') {
      const body = await request.json();
      const { username, email, password, role, name, extraData, photo, department } = body;

      if (!username || !email || !password || !role || !name) {
        return jsonResponse({ message: 'All registration fields are required.' }, 400);
      }

      // Check duplicate username / email
      const existing = await db.prepare('SELECT id, username, email FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)')
        .bind(username, email).first();

      if (existing) {
        if (existing.username.toLowerCase() === username.toLowerCase()) {
          const label = role.toLowerCase() === 'student' ? 'Register number' : 'Employee ID';
          return jsonResponse({ message: `${label} already registered.` }, 409);
        }
        return jsonResponse({ message: 'Email is already registered.' }, 409);
      }

      const normalizedRole = (role.toLowerCase() === 'hod' || role.toLowerCase() === 'admin') ? 'admin' : role.toLowerCase();
      const roleRow = await db.prepare('SELECT id FROM roles WHERE name = ?').bind(normalizedRole).first();
      if (!roleRow) {
        return jsonResponse({ message: `Role '${role}' is not supported.` }, 400);
      }

      const passwordHash = await hashPassword(password);
      const isApproved = normalizedRole === 'admin' ? 1 : 0; // Initial HOD auto-approved

      await db.prepare(
        'INSERT INTO users (username, email, password_hash, role_id, is_approved, is_active) VALUES (?, ?, ?, ?, ?, 1)'
      ).bind(username, email, passwordHash, roleRow.id, isApproved).run();

      const userRow = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
      const userId = userRow ? userRow.id : null;
      const targetDept = department || extraData?.department || 'Computer Science & Engineering';

      if (normalizedRole === 'student') {
        await db.prepare(`
          INSERT INTO students (user_id, name, register_number, department, year, semester, section, phone, photo_path, guardian_name, guardian_phone)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          userId,
          name || '',
          username || '',
          targetDept || '',
          extraData?.year || 'I-Year',
          extraData?.semester || 'I',
          extraData?.section || 'A',
          extraData?.phone || '',
          photo || '',
          extraData?.guardianName || '',
          extraData?.guardianPhone || ''
        ).run();
      } else if (normalizedRole === 'faculty' || normalizedRole === 'admin') {
        await db.prepare(`
          INSERT INTO faculty (user_id, name, employee_id, designation, department, phone, photo_path, qualification)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          userId,
          name || '',
          username || '',
          extraData?.designation || (normalizedRole === 'admin' ? 'Head of Department' : 'Assistant Professor'),
          targetDept || '',
          extraData?.phone || '',
          photo || '',
          extraData?.qualification || 'M.Tech / Ph.D'
        ).run();
      }

      if (normalizedRole !== 'admin') {
        const hod = await db.prepare(`
          SELECT u.id 
          FROM users u
          JOIN roles r ON u.role_id = r.id
          JOIN faculty f ON f.user_id = u.id
          WHERE (r.name = 'admin' OR r.name = 'hod') 
            AND f.department = ? 
            AND u.is_approved = 1
          LIMIT 1
        `).bind(targetDept).first();

        if (hod && hod.id) {
          const notifType = normalizedRole === 'student' ? 'NEW_STUDENT_REGISTRATION' : 'NEW_FACULTY_REGISTRATION';
          const notifTitle = normalizedRole === 'student' ? 'New Student Registration' : 'New Faculty Registration';
          const notifMessage = normalizedRole === 'student'
            ? `A new ${extraData?.year || 'I-Year'} ${targetDept} student (${name || username}) is waiting for approval.`
            : `A new faculty member (${name || username}) has registered for ${targetDept} and is waiting for approval.`;
          const targetUrl = normalizedRole === 'student' ? '/new_registrations.html?tab=students' : '/new_registrations.html?tab=faculty';

          await db.prepare(`
            INSERT INTO notifications (user_id, message, is_read, type, related_id)
            VALUES (?, ?, 0, ?, ?)
          `).bind(hod.id, notifMessage, notifType, userId).run();

          await sendPushNotificationToUser(db, env, hod.id, {
            title: notifTitle,
            body: notifMessage,
            url: targetUrl,
            type: notifType
          });
        }
      }

      const successMsg = normalizedRole === 'admin' 
        ? 'HOD account created successfully! You can now log in.' 
        : 'Registration submitted successfully. Waiting for HOD approval.';

      return jsonResponse({ success: true, message: successMsg, userId });
    }

    if (path === '/api/auth/login' && method === 'POST') {
      const body = await request.json();
      const { username, password } = body;

      if (!username || !password) {
        return jsonResponse({ message: 'Username and password are required.' }, 400);
      }

      const user = await db.prepare(`
        SELECT u.id, u.username, u.email, u.password_hash, u.is_approved, u.is_active, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?)
      `).bind(username, username).first();

      if (!user) return jsonResponse({ message: 'Invalid credentials. User not found.' }, 401);

      const isValid = await verifyPassword(password, user.password_hash);
      if (!isValid) return jsonResponse({ message: 'Invalid credentials. Password incorrect.' }, 401);

      if (!user.is_approved && user.role_name !== 'admin') {
        return jsonResponse({ message: 'Account is pending HOD approval. Please contact administrator.' }, 403);
      }

      let profileData = {};
      if (user.role_name === 'student') {
        profileData = await db.prepare('SELECT * FROM students WHERE user_id = ?').bind(user.id).first() || {};
      } else {
        profileData = await db.prepare('SELECT * FROM faculty WHERE user_id = ?').bind(user.id).first() || {};
      }

      const token = await signJwt({
        id: user.id,
        username: user.username,
        role: user.role_name,
        name: profileData.name || user.username,
        department: profileData.department || 'Computer Science & Engineering'
      }, env.JWT_SECRET || 'sms_super_secret_jwt_key_2026');

      return jsonResponse({
        success: true,
        message: 'Login successful',
        token,
        accessToken: token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role_name,
          name: profileData.name || user.username,
          department: profileData.department,
          photoPath: profileData.photo_path
        }
      });
    }

    if (path === '/api/auth/logout' && method === 'POST') {
      return jsonResponse({ success: true, message: 'Logged out successfully.' });
    }

    // =============================================================
    // 2. USER PROFILE & SETTINGS
    // =============================================================
    if (path === '/api/auth/profile' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const user = await db.prepare(`
        SELECT u.id, u.username, u.email, r.name as role_name
        FROM users u JOIN roles r ON u.role_id = r.id
        WHERE u.id = ?
      `).bind(authUser.id).first();

      if (!user) return jsonResponse({ message: 'User not found' }, 404);

      let details = {};
      if (user.role_name === 'student') {
        details = await db.prepare('SELECT * FROM students WHERE user_id = ?').bind(user.id).first() || {};
      } else {
        details = await db.prepare('SELECT * FROM faculty WHERE user_id = ?').bind(user.id).first() || {};
      }

      return jsonResponse({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role_name,
        ...details
      });
    }

    if (path === '/api/auth/profile' && method === 'PUT') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const body = await request.json();
      if (authUser.role === 'student') {
        await db.prepare(`
          UPDATE students SET phone = ?, guardian_name = ?, guardian_phone = ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).bind(body.phone || '', body.guardianName || body.guardian_name || '', body.guardianPhone || body.guardian_phone || '', authUser.id).run();
      } else {
        await db.prepare(`
          UPDATE faculty SET phone = ?, designation = ?, qualification = ?, research_area = ?, publications = ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).bind(body.phone || '', body.designation || '', body.qualification || '', body.researchArea || body.research_area || '', body.publications || '', authUser.id).run();
      }

      return jsonResponse({ success: true, message: 'Profile updated successfully.' });
    }

    if (path === '/api/auth/profile/photo' && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const body = await request.json();
      const photo = body.photo || '';

      if (authUser.role === 'student') {
        await db.prepare('UPDATE students SET photo_path = ? WHERE user_id = ?').bind(photo, authUser.id).run();
      } else {
        await db.prepare('UPDATE faculty SET photo_path = ? WHERE user_id = ?').bind(photo, authUser.id).run();
      }

      return jsonResponse({ success: true, message: 'Profile photo updated successfully.', photoPath: photo });
    }

    if (path === '/api/auth/change-password' && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const body = await request.json();
      const { currentPassword, newPassword } = body;

      const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(authUser.id).first();
      const isValid = await verifyPassword(currentPassword, user.password_hash);
      if (!isValid) return jsonResponse({ message: 'Current password is incorrect.' }, 400);

      const newHash = await hashPassword(newPassword);
      await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, authUser.id).run();

      return jsonResponse({ success: true, message: 'Password changed successfully.' });
    }

    // =============================================================
    // 3. REGISTRATIONS APPROVAL WORKFLOW (HOD ONLY)
    // =============================================================
    if ((path === '/api/auth/registrations/pending' || path === '/api/auth/pending-registrations' || path === '/api/auth/pending-faculty-registrations') && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser || authUser.role !== 'admin') return jsonResponse({ message: 'Forbidden' }, 403);

      // Extract verified HOD department from database record
      const hodFaculty = await db.prepare('SELECT department FROM faculty WHERE user_id = ?').bind(authUser.id).first();
      const hodDept = hodFaculty?.department || authUser.department;

      let query = `
        SELECT u.id as user_id, u.id as id, u.username, u.email, u.created_at, r.name as role_name,
               COALESCE(s.name, f.name) as name,
               COALESCE(s.department, f.department) as department,
               s.register_number, s.year, s.semester, s.section, s.phone, s.photo_path,
               f.employee_id, f.designation, f.photo_path as faculty_photo
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN students s ON s.user_id = u.id
        LEFT JOIN faculty f ON f.user_id = u.id
        WHERE u.is_approved = 0 AND r.name != 'admin'
      `;
      const params = [];
      if (hodDept) {
        query += ' AND COALESCE(s.department, f.department) = ?';
        params.push(hodDept);
      }
      query += ' ORDER BY u.created_at DESC';

      const pendingUsers = await db.prepare(query).bind(...params).all();
      const allList = pendingUsers.results || [];
      const students = allList.filter(u => u.role_name === 'student').map(u => ({
        ...u,
        userId: u.user_id,
        registerNumber: u.register_number,
        photoPath: u.photo_path,
        createdAt: u.created_at
      }));
      const faculty = allList.filter(u => u.role_name === 'faculty').map(u => ({
        ...u,
        userId: u.user_id,
        employeeId: u.employee_id,
        photoPath: u.faculty_photo || u.photo_path,
        createdAt: u.created_at
      }));

      return jsonResponse({
        success: true,
        registrations: allList,
        students,
        faculty,
        count: allList.length
      });
    }

    // Approve Registration
    const approveMatch = path.match(/^\/api\/auth\/(?:registrations|faculty-registrations|approve-user)\/(\d+)(?:\/approve)?$/);
    if (approveMatch && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser || authUser.role !== 'admin') return jsonResponse({ message: 'Forbidden' }, 403);

      const targetUserId = approveMatch[1];
      await db.prepare('UPDATE users SET is_approved = 1 WHERE id = ?').bind(targetUserId).run();
      await db.prepare("UPDATE notifications SET is_read = 1 WHERE related_id = ? AND (type = 'NEW_STUDENT_REGISTRATION' OR type = 'NEW_FACULTY_REGISTRATION' OR type = 'NEW_REGISTRATION')")
        .bind(targetUserId).run();
      return jsonResponse({ success: true, message: 'User approved successfully.' });
    }

    // Reject Registration
    const rejectMatch = path.match(/^\/api\/auth\/(?:registrations|faculty-registrations|reject-user)\/(\d+)(?:\/reject)?$/);
    if (rejectMatch && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser || authUser.role !== 'admin') return jsonResponse({ message: 'Forbidden' }, 403);

      const targetUserId = rejectMatch[1];
      await db.prepare('DELETE FROM students WHERE user_id = ?').bind(targetUserId).run();
      await db.prepare('DELETE FROM faculty WHERE user_id = ?').bind(targetUserId).run();
      await db.prepare('DELETE FROM users WHERE id = ?').bind(targetUserId).run();
      await db.prepare("DELETE FROM notifications WHERE related_id = ? AND (type = 'NEW_STUDENT_REGISTRATION' OR type = 'NEW_FACULTY_REGISTRATION' OR type = 'NEW_REGISTRATION')")
        .bind(targetUserId).run();
      return jsonResponse({ success: true, message: 'Registration rejected and removed.' });
    }

    // =============================================================
    // 4. DASHBOARD STATS
    // =============================================================
    if (path === '/api/dashboard/stats' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const userRow = await db.prepare(`
        SELECT u.id, u.username, u.email, r.name as role_name
        FROM users u JOIN roles r ON u.role_id = r.id
        WHERE u.id = ?
      `).bind(authUser.id).first();

      let profileData = {};
      let isClassIncharge = false;

      if (userRow?.role_name === 'student') {
        profileData = await db.prepare('SELECT * FROM students WHERE user_id = ?').bind(authUser.id).first() || {};
      } else {
        profileData = await db.prepare('SELECT * FROM faculty WHERE user_id = ?').bind(authUser.id).first() || {};
        if (profileData.id) {
          const inchargeCheck = await db.prepare('SELECT id FROM class_incharges WHERE faculty_id = ?').bind(profileData.id).first();
          isClassIncharge = Boolean(inchargeCheck);
        }
      }

      const dept = profileData.department || authUser.department || 'Computer Science & Engineering';

      const studentCount = await db.prepare('SELECT COUNT(*) as count FROM students WHERE department = ?').bind(dept).first();
      const facultyCount = await db.prepare('SELECT COUNT(*) as count FROM faculty WHERE department = ?').bind(dept).first();
      const subjectCount = await db.prepare('SELECT COUNT(*) as count FROM subjects WHERE department = ?').bind(dept).first();
      const pendingLeaves = await db.prepare("SELECT COUNT(*) as count FROM leave_requests WHERE status LIKE '%PENDING%'").first();
      const pendingRegs = await db.prepare("SELECT COUNT(*) as count FROM users WHERE is_approved = 0").first();

      const userObj = {
        id: userRow?.id || authUser.id,
        username: userRow?.username || authUser.username,
        email: userRow?.email || '',
        role: userRow?.role_name || authUser.role,
        name: profileData.name || authUser.name || userRow?.username,
        department: dept,
        designation: profileData.designation || (userRow?.role_name === 'admin' ? 'Head of Department' : ''),
        photoPath: profileData.photo_path || '',
        isClassIncharge: isClassIncharge
      };

      const statsObj = {
        totalStudents: studentCount?.count || 0,
        totalFaculty: facultyCount?.count || 0,
        totalSubjects: subjectCount?.count || 0,
        pendingLeaves: pendingLeaves?.count || 0,
        pendingRegistrations: pendingRegs?.count || 0,
        attendanceRate: 94.2
      };

      return jsonResponse({
        success: true,
        user: userObj,
        stats: statsObj,
        ...statsObj
      });
    }

    // =============================================================
    // 5. STUDENTS MODULE
    // =============================================================
    if (path === '/api/students' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      const isHod = authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'hod');

      let department = url.searchParams.get('department');
      // If caller is HOD, ALWAYS enforce their verified department from D1 as single source of truth
      if (isHod) {
        const hodFac = await db.prepare('SELECT department FROM faculty WHERE user_id = ?').bind(authUser.id).first();
        if (hodFac?.department) {
          department = hodFac.department;
        }
      }

      const year = url.searchParams.get('year');
      const semester = url.searchParams.get('semester');
      const section = url.searchParams.get('section');

      let query = 'SELECT s.*, u.email FROM students s JOIN users u ON s.user_id = u.id WHERE u.is_approved = 1';
      const params = [];

      if (department) { query += ' AND s.department = ?'; params.push(department); }
      if (year && year !== 'ALL') { query += ' AND s.year = ?'; params.push(year); }
      if (semester && semester !== 'ALL') { query += ' AND s.semester = ?'; params.push(semester); }
      if (section && section !== 'ALL') { query += ' AND s.section = ?'; params.push(section); }

      query += ' ORDER BY s.year ASC, s.semester ASC, s.name ASC';
      const results = await db.prepare(query).bind(...params).all();
      const mapped = (results.results || []).map(s => ({
        ...s,
        registerNumber: s.register_number || s.registerNumber,
        photoPath: s.photo_path || s.photoPath
      }));
      return jsonResponse({ success: true, count: mapped.length, students: mapped });
    }

    const studentIdMatch = path.match(/^\/api\/students\/(\d+)$/);
    if (studentIdMatch && method === 'GET') {
      const student = await db.prepare('SELECT s.*, u.email FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ?').bind(studentIdMatch[1]).first();
      if (!student) return jsonResponse({ message: 'Student not found' }, 404);
      return jsonResponse({
        success: true,
        student: {
          ...student,
          registerNumber: student.register_number || student.registerNumber,
          photoPath: student.photo_path || student.photoPath
        }
      });
    }

    if (studentIdMatch && method === 'PUT') {
      const body = await request.json();
      await db.prepare(`
        UPDATE students SET name = ?, phone = ?, year = ?, semester = ?, section = ?, guardian_name = ?, guardian_phone = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(body.name || '', body.phone || '', body.year || 'I-Year', body.semester || 'I', body.section || 'A', body.guardian_name || body.guardianName || '', body.guardian_phone || body.guardianPhone || '', studentIdMatch[1]).run();
      return jsonResponse({ success: true, message: 'Student updated successfully.' });
    }

    if (studentIdMatch && method === 'DELETE') {
      const authUser = await getUserFromRequest(request, env);
      const isHod = authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'hod');
      if (!isHod) return jsonResponse({ message: 'Forbidden. HOD access required.' }, 403);
      const student = await db.prepare('SELECT user_id FROM students WHERE id = ?').bind(studentIdMatch[1]).first();
      if (student) {
        await db.prepare('DELETE FROM students WHERE id = ?').bind(studentIdMatch[1]).run();
        await db.prepare('DELETE FROM users WHERE id = ?').bind(student.user_id).run();
      }
      return jsonResponse({ success: true, message: 'Student deleted successfully.' });
    }

    // =============================================================
    // 6. FACULTY MODULE
    // =============================================================
    if (path === '/api/faculty' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      const department = url.searchParams.get('department');
      let query = 'SELECT f.*, u.email FROM faculty f JOIN users u ON f.user_id = u.id WHERE u.is_approved = 1';
      const params = [];
      if (department) {
        query += ' AND f.department = ?';
        params.push(department);
      } else if (authUser && authUser.role === 'admin') {
        const hodFac = await db.prepare('SELECT department FROM faculty WHERE user_id = ?').bind(authUser.id).first();
        if (hodFac?.department) {
          query += ' AND f.department = ?';
          params.push(hodFac.department);
        }
      }
      query += ' ORDER BY f.name ASC';
      const results = await db.prepare(query).bind(...params).all();
      const mapped = (results.results || []).map(f => ({
        ...f,
        employeeId: f.employee_id || f.employeeId,
        photoPath: f.photo_path || f.photoPath
      }));
      return jsonResponse({ success: true, faculty: mapped, count: mapped.length });
    }

    if (path === '/api/faculty/my-students' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const isHod = String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'hod';

      if (isHod) {
        const hodFac = await db.prepare('SELECT department FROM faculty WHERE user_id = ?').bind(authUser.id).first();
        const dept = hodFac?.department;
        let query = 'SELECT s.*, u.email FROM students s JOIN users u ON s.user_id = u.id WHERE u.is_approved = 1';
        const params = [];
        if (dept) {
          query += ' AND s.department = ?';
          params.push(dept);
        }
        query += ' ORDER BY s.name ASC';
        const results = await db.prepare(query).bind(...params).all();
        const mapped = (results.results || []).map(s => ({
          ...s,
          registerNumber: s.register_number || s.registerNumber,
          photoPath: s.photo_path || s.photoPath
        }));
        return jsonResponse({ success: true, count: mapped.length, students: mapped });
      }

      const faculty = await db.prepare('SELECT id, department FROM faculty WHERE user_id = ?').bind(authUser.id).first();
      if (!faculty) return jsonResponse({ success: true, count: 0, students: [] });

      // Students from classes assigned to this faculty as Incharge OR enrolled in their subjects
      let students = await db.prepare(`
        SELECT DISTINCT s.*, u.email
        FROM students s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN class_incharges ci ON ci.department = s.department AND ci.year = s.year AND ci.semester = s.semester AND ci.section = s.section
        LEFT JOIN subjects sub ON sub.department = s.department AND sub.year = s.year AND sub.semester = s.semester AND sub.section = s.section
        WHERE (ci.faculty_id = ? OR sub.faculty_id = ?) AND u.is_approved = 1
        ORDER BY s.name ASC
      `).bind(faculty.id, faculty.id).all();

      let studentList = students.results || [];

      // Fallback: If faculty has no specific class/subject assignments yet, return department students
      if (studentList.length === 0 && faculty.department) {
        const deptStudents = await db.prepare(`
          SELECT s.*, u.email
          FROM students s
          JOIN users u ON s.user_id = u.id
          WHERE s.department = ? AND u.is_approved = 1
          ORDER BY s.name ASC
        `).bind(faculty.department).all();
        studentList = deptStudents.results || [];
      }

      const mapped = studentList.map(s => ({
        ...s,
        registerNumber: s.register_number || s.registerNumber,
        photoPath: s.photo_path || s.photoPath
      }));

      return jsonResponse({ success: true, count: mapped.length, students: mapped });
    }

    const facultyIdMatch = path.match(/^\/api\/faculty\/(\d+)$/);
    if (facultyIdMatch && method === 'GET') {
      const fac = await db.prepare('SELECT f.*, u.email FROM faculty f JOIN users u ON f.user_id = u.id WHERE f.id = ?').bind(facultyIdMatch[1]).first();
      if (!fac) return jsonResponse({ message: 'Faculty not found' }, 404);
      return jsonResponse({
        success: true,
        faculty: {
          ...fac,
          employeeId: fac.employee_id || fac.employeeId,
          photoPath: fac.photo_path || fac.photoPath
        }
      });
    }

    // =============================================================
    // 7. CLASS INCHARGE MODULE
    // =============================================================
    if ((path === '/api/class-incharge' || path === '/api/class-incharges' || path === '/api/admin/class-incharges' || path === '/api/admin/class-incharge') && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      let query = `
        SELECT ci.*, f.name as faculty_name, f.employee_id
        FROM class_incharges ci
        JOIN faculty f ON ci.faculty_id = f.id
        WHERE 1=1
      `;
      const params = [];
      if (authUser && authUser.role === 'admin') {
        const hodFac = await db.prepare('SELECT department FROM faculty WHERE user_id = ?').bind(authUser.id).first();
        if (hodFac?.department) {
          query += ' AND ci.department = ?';
          params.push(hodFac.department);
        }
      }
      query += ' ORDER BY ci.year, ci.semester, ci.section';
      const results = await db.prepare(query).bind(...params).all();
      const mapped = (results.results || []).map(ci => ({
        ...ci,
        facultyId: ci.faculty_id || ci.facultyId,
        facultyName: ci.faculty_name || ci.facultyName,
        employeeId: ci.employee_id || ci.employeeId
      }));
      return jsonResponse({ success: true, count: mapped.length, classIncharges: mapped, assignments: mapped });
    }

    if ((path === '/api/class-incharge/assign' || path === '/api/class-incharges/assign' || path === '/api/admin/class-incharges/assign' || path === '/api/admin/class-incharge/assign') && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      const isHod = authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'hod');
      if (!isHod) {
        return jsonResponse({ message: 'Forbidden. HOD access required.' }, 403);
      }

      const body = await request.json().catch(() => ({}));
      const { year, semester, section, facultyId } = body;

      if (!year || !semester || !facultyId) {
        return jsonResponse({ message: 'Year, semester, and facultyId are required.' }, 400);
      }

      // Verify faculty exists
      let targetFaculty = await db.prepare('SELECT id, name, department, user_id FROM faculty WHERE id = ? OR user_id = ?').bind(facultyId, facultyId).first();
      if (!targetFaculty) {
        const userFac = await db.prepare('SELECT id, username as name FROM users WHERE id = ?').bind(facultyId).first();
        if (userFac) {
          targetFaculty = { id: userFac.id, name: userFac.name, department: 'Computer Science & Engineering' };
        }
      }

      if (!targetFaculty) {
        return jsonResponse({ message: 'Selected faculty member not found in database.' }, 404);
      }

      // Determine department from request body or HOD profile or target faculty
      let department = body.department;
      if (!department) {
        const hodFac = await db.prepare('SELECT department FROM faculty WHERE user_id = ?').bind(authUser.id).first();
        department = hodFac?.department || targetFaculty?.department || 'Computer Science & Engineering';
      }

      try {
        // Remove existing assignment for this class to prevent duplicates
        await db.prepare(`
          DELETE FROM class_incharges 
          WHERE department = ? AND year = ? AND semester = ? AND section = ?
        `).bind(department, year, semester, section || 'A').run().catch(() => {});

        // Insert new assignment with fallback
        try {
          await db.prepare(`
            INSERT INTO class_incharges (department, year, semester, section, faculty_id, assigned_by, assigned_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(department, year, semester, section || 'A', targetFaculty.id, authUser.id).run();
        } catch (insertErr) {
          await db.prepare(`
            INSERT OR REPLACE INTO class_incharges (department, year, semester, section, faculty_id, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(department, year, semester, section || 'A', targetFaculty.id).run();
        }

        return jsonResponse({
          success: true,
          message: `Assigned ${targetFaculty.name} as Class Incharge for ${year} (Sem ${semester} - Sec ${section || 'A'}).`
        });
      } catch (err) {
        console.error('[Worker Class Incharge Assign Error]', err);
        return jsonResponse({ message: `Database error: ${err.message}` }, 500);
      }
    }

    if ((path === '/api/class-incharge/remove' || path === '/api/class-incharges/remove' || path === '/api/admin/class-incharges/remove' || path === '/api/admin/class-incharge/remove') && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      const isHod = authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'hod');
      if (!isHod) {
        return jsonResponse({ message: 'Forbidden. HOD access required.' }, 403);
      }

      const body = await request.json().catch(() => ({}));
      let department = body.department;
      if (!department) {
        const hodFac = await db.prepare('SELECT department FROM faculty WHERE user_id = ?').bind(authUser.id).first();
        department = hodFac?.department || 'Computer Science & Engineering';
      }

      try {
        if (body.id) {
          await db.prepare('DELETE FROM class_incharges WHERE id = ?').bind(body.id).run();
        } else if (body.year && body.semester) {
          await db.prepare(`
            DELETE FROM class_incharges 
            WHERE department = ? AND year = ? AND semester = ? AND section = ?
          `).bind(department, body.year, body.semester, body.section || 'A').run();
        } else {
          return jsonResponse({ message: 'Assignment ID or class specifications (year, semester, section) required.' }, 400);
        }

        return jsonResponse({ success: true, message: 'Class Incharge assignment removed successfully.' });
      } catch (err) {
        console.error('[Worker Class Incharge Remove Error]', err);
        return jsonResponse({ message: `Database error: ${err.message}` }, 500);
      }
    }

    if ((path === '/api/class-incharge/my-assignments' || path === '/api/class-incharges/my-assignments' || path === '/api/admin/class-incharges/my-assignments') && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const faculty = await db.prepare('SELECT id FROM faculty WHERE user_id = ?').bind(authUser.id).first();
      if (!faculty) return jsonResponse({ success: true, count: 0, assignments: [], classes: [] });

      const assignments = await db.prepare('SELECT * FROM class_incharges WHERE faculty_id = ?').bind(faculty.id).all();
      return jsonResponse({
        success: true,
        count: (assignments.results || []).length,
        assignments: assignments.results || [],
        classes: assignments.results || []
      });
    }

    // =============================================================
    // 8. SUBJECTS MODULE
    // =============================================================
    if (path === '/api/subjects' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      let deptFilter = url.searchParams.get('department');

      if (authUser && (authUser.role === 'admin' || authUser.role === 'hod')) {
        const adminUser = await db.prepare('SELECT department FROM faculty WHERE user_id = ?').bind(authUser.id).first();
        if (adminUser?.department) {
          deptFilter = adminUser.department;
        }
      }

      let query = `
        SELECT s.*,
               f.name as faculty_name,
               f.name as full_name,
               f.employee_id,
               f.photo_path as faculty_photo_path
        FROM subjects s
        LEFT JOIN faculty f ON s.faculty_id = f.id
      `;
      const params = [];
      if (deptFilter) {
        query += ` WHERE s.department = ?`;
        params.push(deptFilter);
      }
      query += ` ORDER BY s.semester, s.code`;

      const results = params.length > 0
        ? await db.prepare(query).bind(...params).all()
        : await db.prepare(query).all();

      const formattedSubjects = (results.results || []).map(s => {
        const facName = s.faculty_name || s.full_name || null;
        return {
          id: s.id,
          code: s.code,
          subject_code: s.code,
          subjectCode: s.code,
          name: s.name,
          subject_name: s.name,
          subjectName: s.name,
          credits: s.credits || 3,
          semester: s.semester,
          year: s.year || 'III-Year',
          section: s.section || 'A',
          department: s.department,
          faculty_id: s.faculty_id || null,
          facultyId: s.faculty_id || null,
          faculty_name: facName || 'Unassigned',
          facultyName: facName || 'Unassigned',
          assigned_faculty_name: facName || 'Unassigned',
          assignedFaculty: facName || 'Unassigned',
          assigned_faculty: facName || 'Unassigned',
          employee_id: s.employee_id || null,
          photo_path: s.faculty_photo_path || null,
          photoPath: s.faculty_photo_path || null
        };
      });

      return jsonResponse({ success: true, subjects: formattedSubjects, data: formattedSubjects });
    }

    if (path === '/api/subjects' && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'hod')) {
        return jsonResponse({ message: 'Forbidden' }, 403);
      }

      const body = await request.json().catch(() => ({}));
      const code = body.code || body.subject_code || body.subjectCode;
      const name = body.name || body.subject_name || body.subjectName;
      const credits = parseInt(body.credits, 10) || 3;
      const semester = body.semester;
      const year = body.year || 'III-Year';
      const section = body.section || 'A';
      let department = body.department || 'Computer Science & Engineering';
      let facultyId = body.facultyId !== undefined ? body.facultyId : body.faculty_id;
      facultyId = facultyId ? parseInt(facultyId, 10) : null;

      const adminUser = await db.prepare('SELECT department FROM faculty WHERE user_id = ?').bind(authUser.id).first();
      if (adminUser?.department) {
        department = adminUser.department;
      }

      if (!code || !name || !semester) {
        return jsonResponse({ message: 'Subject code, name, and semester are required.' }, 400);
      }

      if (facultyId) {
        const fac = await db.prepare('SELECT id, department, name FROM faculty WHERE id = ?').bind(facultyId).first();
        if (!fac) {
          return jsonResponse({ message: 'Selected faculty not found.' }, 404);
        }
        if (fac.department !== department) {
          return jsonResponse({ message: 'Cannot assign faculty from another department.' }, 403);
        }
      }

      await db.prepare(`
        INSERT INTO subjects (code, name, credits, semester, year, section, department, faculty_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(code, name, credits, semester, year, section, department, facultyId).run();

      return jsonResponse({ success: true, message: 'Subject created successfully.' });
    }

    const subjectIdMatch = path.match(/^\/api\/(?:admin\/)?subjects\/(\d+)$/);
    if (subjectIdMatch && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const subjectId = subjectIdMatch[1];
      const s = await db.prepare(`
        SELECT s.*,
               f.name as faculty_name,
               f.name as full_name,
               f.employee_id,
               f.photo_path as faculty_photo_path
        FROM subjects s
        LEFT JOIN faculty f ON s.faculty_id = f.id
        WHERE s.id = ?
      `).bind(subjectId).first();

      if (!s) return jsonResponse({ message: 'Subject not found.' }, 404);

      const facName = s.faculty_name || s.full_name || null;
      const formattedSubject = {
        id: s.id,
        code: s.code,
        subject_code: s.code,
        subjectCode: s.code,
        name: s.name,
        subject_name: s.name,
        subjectName: s.name,
        credits: s.credits || 3,
        semester: s.semester,
        year: s.year || 'III-Year',
        section: s.section || 'A',
        department: s.department,
        faculty_id: s.faculty_id || null,
        facultyId: s.faculty_id || null,
        faculty_name: facName || 'Unassigned',
        facultyName: facName || 'Unassigned',
        assigned_faculty_name: facName || 'Unassigned',
        assignedFaculty: facName || 'Unassigned',
        assigned_faculty: facName || 'Unassigned',
        employee_id: s.employee_id || null,
        photo_path: s.faculty_photo_path || null,
        photoPath: s.faculty_photo_path || null
      };

      return jsonResponse({ success: true, subject: formattedSubject, data: formattedSubject, ...formattedSubject });
    }

    if (subjectIdMatch && (method === 'PUT' || method === 'POST')) {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'hod')) {
        return jsonResponse({ message: 'Forbidden' }, 403);
      }

      const subjectId = subjectIdMatch[1];
      const existing = await db.prepare('SELECT * FROM subjects WHERE id = ?').bind(subjectId).first();
      if (!existing) return jsonResponse({ message: 'Subject not found.' }, 404);

      const adminUser = await db.prepare('SELECT department FROM faculty WHERE user_id = ?').bind(authUser.id).first();
      const userDept = adminUser?.department || authUser.department;
      if (userDept && existing.department !== userDept) {
        return jsonResponse({ message: 'Forbidden: Cannot edit subjects outside your department.' }, 403);
      }

      const body = await request.json().catch(() => ({}));
      const code = (body.code || body.subject_code || body.subjectCode || existing.code);
      const name = (body.name || body.subject_name || body.subjectName || existing.name);
      const credits = body.credits !== undefined ? parseInt(body.credits, 10) : existing.credits;
      const semester = (body.semester || existing.semester);
      const year = (body.year || existing.year);
      const section = (body.section || existing.section);
      let facultyId = body.facultyId !== undefined ? body.facultyId : body.faculty_id;
      facultyId = facultyId ? parseInt(facultyId, 10) : null;

      if (facultyId) {
        const fac = await db.prepare('SELECT id, department, name FROM faculty WHERE id = ?').bind(facultyId).first();
        if (!fac) {
          return jsonResponse({ message: 'Selected faculty not found.' }, 404);
        }
        if (fac.department !== existing.department) {
          return jsonResponse({ message: 'Cannot assign faculty from another department.' }, 403);
        }
      }

      await db.prepare(`
        UPDATE subjects
        SET code = ?, name = ?, credits = ?, semester = ?, year = ?, section = ?, faculty_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(code, name, credits, semester, year, section, facultyId, subjectId).run();

      const updated = await db.prepare(`
        SELECT s.*, f.name as faculty_name, f.photo_path as faculty_photo_path, f.employee_id
        FROM subjects s
        LEFT JOIN faculty f ON s.faculty_id = f.id
        WHERE s.id = ?
      `).bind(subjectId).first();

      const facName = updated.faculty_name || 'Unassigned';

      return jsonResponse({
        success: true,
        message: 'Subject updated successfully.',
        subject: {
          id: updated.id,
          code: updated.code,
          subject_code: updated.code,
          subjectCode: updated.code,
          name: updated.name,
          subject_name: updated.name,
          subjectName: updated.name,
          credits: updated.credits,
          semester: updated.semester,
          year: updated.year,
          section: updated.section,
          department: updated.department,
          faculty_id: updated.faculty_id,
          facultyId: updated.faculty_id,
          faculty_name: facName,
          facultyName: facName,
          assigned_faculty_name: facName,
          assignedFaculty: facName,
          assigned_faculty: facName,
          employee_id: updated.employee_id || null,
          photoPath: updated.faculty_photo_path || null
        }
      });
    }

    if (subjectIdMatch && method === 'DELETE') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'hod')) {
        return jsonResponse({ message: 'Forbidden' }, 403);
      }

      const subjectId = subjectIdMatch[1];
      const existing = await db.prepare('SELECT * FROM subjects WHERE id = ?').bind(subjectId).first();
      if (!existing) return jsonResponse({ message: 'Subject not found.' }, 404);

      const adminUser = await db.prepare('SELECT department FROM faculty WHERE user_id = ?').bind(authUser.id).first();
      const userDept = adminUser?.department || authUser.department;
      if (userDept && existing.department !== userDept) {
        return jsonResponse({ message: 'Forbidden: Cannot delete subjects outside your department.' }, 403);
      }

      await db.prepare('DELETE FROM subjects WHERE id = ?').bind(subjectId).run();
      return jsonResponse({ success: true, message: 'Subject deleted successfully.' });
    }

    if (path === '/api/subjects/my-subjects' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const faculty = await db.prepare('SELECT id FROM faculty WHERE user_id = ?').bind(authUser.id).first();
      if (!faculty) return jsonResponse({ success: true, subjects: [] });

      const subjects = await db.prepare('SELECT * FROM subjects WHERE faculty_id = ?').bind(faculty.id).all();
      return jsonResponse({ success: true, subjects: subjects.results });
    }

    if (path === '/api/subjects/my-enrolled' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const student = await db.prepare('SELECT * FROM students WHERE user_id = ?').bind(authUser.id).first();
      if (!student) return jsonResponse({ success: true, subjects: [] });

      const subjects = await db.prepare(`
        SELECT s.*, f.name as faculty_name, f.photo_path as faculty_photo_path
        FROM subjects s
        LEFT JOIN faculty f ON s.faculty_id = f.id
        WHERE s.department = ? AND s.year = ? AND s.semester = ? AND (s.section = ? OR s.section = 'ALL')
        ORDER BY s.code
      `).bind(student.department, student.year, student.semester, student.section).all();

      const formatted = (subjects.results || []).map(s => ({
        id: s.id,
        code: s.code,
        subjectCode: s.code,
        subject_code: s.code,
        name: s.name,
        subjectName: s.name,
        subject_name: s.name,
        credits: s.credits,
        semester: s.semester,
        year: s.year,
        section: s.section,
        department: s.department,
        facultyId: s.faculty_id,
        faculty_id: s.faculty_id,
        facultyName: s.faculty_name || 'Not Assigned',
        faculty_name: s.faculty_name || 'Not Assigned',
        assigned_faculty_name: s.faculty_name || 'Not Assigned',
        photoPath: s.faculty_photo_path || null
      }));

      return jsonResponse({ success: true, subjects: formatted });
    }

    // =============================================================
    // 9. ATTENDANCE MODULE
    // =============================================================
    if (path === '/api/attendance/my-classes' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const faculty = await db.prepare('SELECT id FROM faculty WHERE user_id = ?').bind(authUser.id).first();
      if (!faculty) return jsonResponse({ success: true, classes: [] });

      const classes = await db.prepare('SELECT * FROM class_incharges WHERE faculty_id = ?').bind(faculty.id).all();
      return jsonResponse({ success: true, classes: classes.results });
    }

    if (path === '/api/attendance/daily-checklist' && method === 'GET') {
      const department = url.searchParams.get('department') || 'Computer Science & Engineering';
      const year = url.searchParams.get('year');
      const semester = url.searchParams.get('semester');
      const section = url.searchParams.get('section') || 'A';
      const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

      const students = await db.prepare(`
        SELECT s.id, s.name, s.register_number, s.photo_path,
               COALESCE(ar.status, 'PRESENT') as status
        FROM students s
        LEFT JOIN attendance_sessions sess ON sess.department = s.department AND sess.year = s.year AND sess.semester = s.semester AND sess.section = s.section AND sess.date = ?
        LEFT JOIN attendance_records ar ON ar.session_id = sess.id AND ar.student_id = s.id
        WHERE s.department = ? AND s.year = ? AND s.semester = ? AND s.section = ?
        ORDER BY s.register_number ASC
      `).bind(date, department, year, semester, section).all();

      return jsonResponse({ success: true, students: students.results, date });
    }

    if ((path === '/api/attendance/daily' || path === '/api/attendance/mark') && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const body = await request.json();
      const { department, year, semester, section, date, records } = body;

      const faculty = await db.prepare('SELECT id FROM faculty WHERE user_id = ?').bind(authUser.id).first();
      const facultyId = faculty ? faculty.id : 1;

      // Check existing session or create new
      let session = await db.prepare(`
        SELECT id FROM attendance_sessions
        WHERE department = ? AND year = ? AND semester = ? AND section = ? AND date = ?
      `).bind(department, year, semester, section, date).first();

      let sessionId = session ? session.id : null;
      if (!sessionId) {
        const ins = await db.prepare(`
          INSERT INTO attendance_sessions (faculty_id, department, year, semester, section, date)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(facultyId, department, year, semester, section, date).run();
        const sRow = await db.prepare('SELECT id FROM attendance_sessions WHERE department = ? AND year = ? AND semester = ? AND section = ? AND date = ?')
          .bind(department, year, semester, section, date).first();
        sessionId = sRow.id;
      }

      if (Array.isArray(records)) {
        for (const rec of records) {
          const sId = rec.studentId || rec.id;
          await db.prepare(`
            INSERT OR REPLACE INTO attendance_records (session_id, student_id, date, status, marked_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(sessionId, sId, date, rec.status).run();

          const sUser = await db.prepare('SELECT user_id FROM students WHERE id = ?').bind(sId).first();
          if (sUser?.user_id) {
            await sendPushNotificationToUser(db, env, sUser.user_id, {
              title: '📅 Attendance Update',
              body: `Your attendance for ${date} has been recorded as ${rec.status}.`,
              url: '/student_attendance.html',
              type: 'ATTENDANCE_UPDATE'
            });
          }
        }
      }

      return jsonResponse({ success: true, message: 'Attendance recorded successfully!' });
    }

    if (path === '/api/attendance/history' && method === 'GET') {
      const department = url.searchParams.get('department');
      const year = url.searchParams.get('year');
      const semester = url.searchParams.get('semester');
      const section = url.searchParams.get('section');

      let query = `
        SELECT s.id, s.name, s.register_number, s.department, s.year, s.semester, s.section,
               COUNT(ar.id) as total_days,
               SUM(CASE WHEN ar.status = 'PRESENT' THEN 1 ELSE 0 END) as present_days,
               ROUND((SUM(CASE WHEN ar.status = 'PRESENT' THEN 1.0 ELSE 0 END) / MAX(COUNT(ar.id), 1)) * 100, 1) as percentage
        FROM students s
        LEFT JOIN attendance_records ar ON ar.student_id = s.id
        WHERE 1=1
      `;
      const params = [];
      if (department) { query += ' AND s.department = ?'; params.push(department); }
      if (year && year !== 'ALL') { query += ' AND s.year = ?'; params.push(year); }
      if (semester && semester !== 'ALL') { query += ' AND s.semester = ?'; params.push(semester); }
      if (section && section !== 'ALL') { query += ' AND s.section = ?'; params.push(section); }

      query += ' GROUP BY s.id ORDER BY s.register_number ASC';
      const results = await db.prepare(query).bind(...params).all();
      return jsonResponse({ success: true, records: results.results });
    }

    if (path === '/api/attendance/student-summary' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const student = await db.prepare('SELECT id FROM students WHERE user_id = ?').bind(authUser.id).first();
      if (!student) return jsonResponse({ totalClasses: 0, attendedClasses: 0, percentage: 0 });

      const stats = await db.prepare(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present
        FROM attendance_records WHERE student_id = ?
      `).bind(student.id).first();

      const total = stats?.total || 0;
      const present = stats?.present || 0;
      const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : 100;

      return jsonResponse({ totalClasses: total, attendedClasses: present, percentage });
    }

    // =============================================================
    // 10. INTERNAL MARKS MODULE
    // =============================================================
    if (path === '/api/marks/roster' && method === 'GET') {
      const subjectId = url.searchParams.get('subjectId');
      const examType = url.searchParams.get('examType') || 'CIA-1';

      const subject = await db.prepare('SELECT * FROM subjects WHERE id = ?').bind(subjectId).first();
      if (!subject) return jsonResponse({ success: true, roster: [] });

      const roster = await db.prepare(`
        SELECT s.id as student_id, s.name, s.register_number, s.photo_path,
               COALESCE(m.marks_obtained, '') as marks_obtained,
               COALESCE(m.max_marks, 100) as max_marks
        FROM students s
        LEFT JOIN internal_marks m ON m.student_id = s.id AND m.subject_id = ? AND m.exam_type = ?
        WHERE s.department = ? AND s.year = ? AND s.semester = ? AND (s.section = ? OR ? = 'ALL')
        ORDER BY s.register_number ASC
      `).bind(subjectId, examType, subject.department, subject.year, subject.semester, subject.section, subject.section).all();

      return jsonResponse({ success: true, roster: roster.results, subject });
    }

    if ((path === '/api/marks/save' || path === '/api/marks/add') && method === 'POST') {
      const body = await request.json();
      const { subjectId, examType, maxMarks, marks } = body;

      const subRow = await db.prepare('SELECT name, code FROM subjects WHERE id = ?').bind(subjectId).first();
      const subLabel = subRow ? `${subRow.code}` : 'Subject';

      if (Array.isArray(marks)) {
        for (const item of marks) {
          if (item.marks !== '' && item.marks !== null && item.marks !== undefined) {
            await db.prepare(`
              INSERT OR REPLACE INTO internal_marks (student_id, subject_id, exam_type, marks_obtained, max_marks, updated_at)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).bind(item.studentId, subjectId, examType, Number(item.marks), maxMarks || 100).run();

            const sUser = await db.prepare('SELECT user_id FROM students WHERE id = ?').bind(item.studentId).first();
            if (sUser?.user_id) {
              await sendPushNotificationToUser(db, env, sUser.user_id, {
                title: '📝 Internal Marks Published',
                body: `${subLabel} (${examType}) marks published: ${item.marks}/${maxMarks || 100}.`,
                url: '/student_marks.html',
                type: 'MARKS_PUBLISHED'
              });
            }
          }
        }
      }

      return jsonResponse({ success: true, message: 'Marks recorded successfully!' });
    }

    if ((path === '/api/marks/grades' || path === '/api/marks/my-marks' || path === '/api/marks/student') && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const student = await db.prepare('SELECT id FROM students WHERE user_id = ?').bind(authUser.id).first();
      if (!student) return jsonResponse({ success: true, grades: [] });

      const grades = await db.prepare(`
        SELECT m.*, sub.name as subject_name, sub.code as subject_code, sub.credits
        FROM internal_marks m
        JOIN subjects sub ON m.subject_id = sub.id
        WHERE m.student_id = ?
        ORDER BY sub.code, m.exam_type
      `).bind(student.id).all();

      return jsonResponse({ success: true, grades: grades.results });
    }

    if (path === '/api/marks/logs' && method === 'GET') {
      const results = await db.prepare(`
        SELECT m.*, s.name as student_name, s.register_number, sub.name as subject_name, sub.code as subject_code
        FROM internal_marks m
        JOIN students s ON m.student_id = s.id
        JOIN subjects sub ON m.subject_id = sub.id
        ORDER BY m.updated_at DESC
        LIMIT 100
      `).all();

      return jsonResponse({ success: true, logs: results.results });
    }

    // =============================================================
    // 11. LEAVE MANAGEMENT MODULE
    // =============================================================
    if ((path === '/api/leaves/requests' || path === '/api/leaves' || path === '/api/admin/leaves') && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      let allLeaves = await db.prepare(`
        SELECT l.*, s.name as student_name, s.register_number, s.department, s.year, s.semester, s.section, s.phone, s.photo_path
        FROM leave_requests l
        JOIN students s ON l.student_id = s.id
        ORDER BY l.created_at DESC
      `).all();

      let filteredLeaves = allLeaves.results || [];

      if (authUser.role === 'student') {
        const student = await db.prepare('SELECT id FROM students WHERE user_id = ?').bind(authUser.id).first();
        if (student) {
          filteredLeaves = filteredLeaves.filter(l => l.student_id === student.id);
        } else {
          filteredLeaves = [];
        }
      } else if (authUser.role === 'faculty') {
        const fac = await db.prepare('SELECT id FROM faculty WHERE user_id = ?').bind(authUser.id).first();
        if (fac) {
          const myAssignments = await db.prepare('SELECT * FROM class_incharges WHERE faculty_id = ?').bind(fac.id).all();
          const assignments = myAssignments.results || [];

          filteredLeaves = filteredLeaves.filter(l => {
            return assignments.some(ci => {
              return isDepartmentMatch(ci.department, l.department) &&
                     isYearMatch(ci.year, l.year) &&
                     isSemesterMatch(ci.semester, l.semester) &&
                     isSectionMatch(ci.section, l.section);
            });
          });
        } else {
          filteredLeaves = [];
        }
      } else if (authUser.role === 'admin') {
        const hodFac = await db.prepare('SELECT department FROM faculty WHERE user_id = ?').bind(authUser.id).first();
        if (hodFac?.department) {
          filteredLeaves = filteredLeaves.filter(l => isDepartmentMatch(l.department, hodFac.department));
        }
      }

      const allRows = filteredLeaves.map(r => {
        const fromD = r.from_date || r.fromDate || r.startDate;
        const toD = r.to_date || r.toDate || r.endDate;
        const days = calculateLeaveDays(fromD, toD, r.number_of_days || r.numberOfDays);
        return {
          ...r,
          studentName: r.student_name,
          name: r.student_name,
          registerNumber: r.register_number,
          leaveType: r.leave_type || r.leaveType || r.type || 'Medical Leave',
          leave_type: r.leave_type || r.leaveType || r.type || 'Medical Leave',
          fromDate: fromD,
          from_date: fromD,
          toDate: toD,
          to_date: toD,
          startDate: fromD,
          endDate: toD,
          numberOfDays: days,
          number_of_days: days,
          days: days,
          photoPath: r.photo_path || r.photoPath,
          rejectionReason: r.rejection_reason || r.rejectionReason,
          hodRemarks: r.hod_remarks || r.hodRemarks || '',
          student: {
            id: r.student_id,
            name: r.student_name,
            registerNumber: r.register_number,
            department: r.department,
            year: r.year,
            semester: r.semester,
            section: r.section,
            phone: r.phone,
            photoPath: r.photo_path || ''
          }
        };
      });

      const pending = allRows.filter(r => String(r.status || '').toUpperCase().includes('PENDING'));
      const history = allRows.filter(r => !String(r.status || '').toUpperCase().includes('PENDING'));
      const approvedCount = allRows.filter(r => r.status === 'APPROVED').length;
      const rejectedCount = allRows.filter(r => r.status === 'REJECTED').length;

      return jsonResponse({
        success: true,
        requests: allRows,
        pending,
        history,
        leaves: allRows,
        stats: {
          total: allRows.length,
          pending: pending.length,
          approved: approvedCount,
          rejected: rejectedCount
        }
      });
    }

    if ((path === '/api/leaves/apply' || path === '/api/leaves') && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      let body = {};
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        body = await request.json().catch(() => ({}));
      } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
        try {
          const formData = await request.formData();
          for (const [key, value] of formData.entries()) {
            body[key] = value;
          }
        } catch (e) {
          body = {};
        }
      }

      const leaveType = body.leaveType || body.leave_type || 'General Leave';
      const fromDate = body.fromDate || body.from_date || body.startDate;
      const toDate = body.toDate || body.to_date || body.endDate;
      const reason = body.reason || '';
      const supportingDoc = body.supportingDocument || body.document || '';

      if (!fromDate || !toDate) {
        return jsonResponse({ message: 'From Date and To Date are required.' }, 400);
      }

      const start = new Date(fromDate);
      const end = new Date(toDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      if (end.getTime() < start.getTime()) {
        return jsonResponse({ message: 'To Date cannot be earlier than From Date.' }, 400);
      }

      const calculatedDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const numberOfDays = calculatedDays > 0 ? calculatedDays : 1;

      const student = await db.prepare('SELECT * FROM students WHERE user_id = ?').bind(authUser.id).first();
      if (!student) {
        return jsonResponse({ message: 'Student profile not found. Please contact administration.' }, 404);
      }

      // Find Assigned Class Incharge
      const allIncharges = await db.prepare(`
        SELECT ci.*, f.user_id as faculty_user_id, f.name as faculty_name, f.department as faculty_department
        FROM class_incharges ci
        JOIN faculty f ON ci.faculty_id = f.id
      `).all();

      const matchingIncharges = (allIncharges.results || []).filter(ci => {
        return isDepartmentMatch(ci.department, student.department) &&
               isYearMatch(ci.year, student.year) &&
               isSemesterMatch(ci.semester, student.semester) &&
               isSectionMatch(ci.section, student.section);
      });

      if (matchingIncharges.length === 0) {
        return jsonResponse({
          message: `No Class Incharge has been assigned for your class (${student.year || 'Year'} - Sem ${student.semester || 'Sem'} - Sec ${student.section || 'A'}). Please contact your Department HOD.`
        }, 400);
      }

      const assignedIncharge = matchingIncharges[0];

      await db.prepare(`
        INSERT INTO leave_requests (student_id, leave_type, from_date, to_date, number_of_days, reason, supporting_document, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_CLASS_INCHARGE')
      `).bind(student.id, leaveType, fromDate, toDate, numberOfDays, reason, typeof supportingDoc === 'string' ? supportingDoc : '').run();

      const notifMsg = `📝 New Leave Request: ${student.name || 'Student'} (${student.register_number || ''}) applied for ${leaveType} (${fromDate} to ${toDate} - ${numberOfDays} ${numberOfDays === 1 ? 'Day' : 'Days'}).`;
      await db.prepare('INSERT INTO notifications (user_id, message, is_read, type, related_id) VALUES (?, ?, 0, ?, ?)')
        .bind(assignedIncharge.faculty_user_id, notifMsg, 'leave_request', student.id).run();

      await sendPushNotificationToUser(db, env, assignedIncharge.faculty_user_id, {
        title: '📝 New Leave Application',
        body: notifMsg,
        url: '/faculty_requests.html',
        type: 'leave_request'
      });

      return jsonResponse({ success: true, message: 'Leave application submitted to Class Incharge.' });
    }

    if (path === '/api/leaves/my' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const student = await db.prepare('SELECT id FROM students WHERE user_id = ?').bind(authUser.id).first();
      if (!student) return jsonResponse({ success: true, leaves: [] });

      const leaves = await db.prepare('SELECT * FROM leave_requests WHERE student_id = ? ORDER BY created_at DESC').bind(student.id).all();
      const mapped = (leaves.results || []).map(l => {
        const fromD = l.from_date || l.fromDate;
        const toD = l.to_date || l.toDate;
        const days = calculateLeaveDays(fromD, toD, l.number_of_days);
        return {
          ...l,
          leaveType: l.leave_type || l.type || 'General Leave',
          fromDate: fromD,
          from_date: fromD,
          toDate: toD,
          to_date: toD,
          numberOfDays: days,
          number_of_days: days,
          days: days
        };
      });
      return jsonResponse({ success: true, leaves: mapped });
    }

    const singleLeaveMatch = path.match(/^\/api\/(?:admin\/)?leaves?\/(\d+)$/);
    if (singleLeaveMatch && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const leaveId = singleLeaveMatch[1];
      const leave = await db.prepare(`
        SELECT l.*, s.name as student_name, s.register_number, s.department, s.year, s.semester, s.section, s.phone, s.photo_path
        FROM leave_requests l
        JOIN students s ON l.student_id = s.id
        WHERE l.id = ?
      `).bind(leaveId).first();

      if (!leave) {
        return jsonResponse({ message: 'Leave request not found.' }, 404);
      }

      // Department & Role Authorization Checks
      if (authUser.role === 'student') {
        const student = await db.prepare('SELECT id FROM students WHERE user_id = ?').bind(authUser.id).first();
        if (!student || student.id !== leave.student_id) {
          return jsonResponse({ message: 'Forbidden. You cannot access this leave request.' }, 403);
        }
      } else if (authUser.role === 'admin' || authUser.role === 'hod') {
        const hodFac = await db.prepare('SELECT department FROM faculty WHERE user_id = ?').bind(authUser.id).first();
        if (hodFac?.department && !isDepartmentMatch(leave.department, hodFac.department)) {
          return jsonResponse({ message: 'Forbidden. This student belongs to another department.' }, 403);
        }
      }

      const fromD = leave.from_date || leave.fromDate || leave.startDate;
      const toD = leave.to_date || leave.toDate || leave.endDate;
      const days = calculateLeaveDays(fromD, toD, leave.number_of_days);

      const formattedLeave = {
        id: leave.id,
        studentId: leave.student_id,
        studentName: leave.student_name,
        name: leave.student_name,
        registerNumber: leave.register_number,
        department: leave.department,
        year: leave.year,
        semester: leave.semester,
        section: leave.section,
        leaveType: leave.leave_type || leave.type || 'Medical Leave',
        leave_type: leave.leave_type || leave.type || 'Medical Leave',
        reason: leave.reason || '',
        fromDate: fromD,
        from_date: fromD,
        toDate: toD,
        to_date: toD,
        startDate: fromD,
        endDate: toD,
        numberOfDays: days,
        number_of_days: days,
        days: days,
      const isApproved = String(leave.status || '').toUpperCase() === 'APPROVED';
      const isRejected = String(leave.status || '').toUpperCase().startsWith('REJECT');

      const formattedLeave = {
        id: leave.id,
        studentId: leave.student_id,
        studentName: leave.student_name,
        name: leave.student_name,
        registerNumber: leave.register_number,
        department: leave.department,
        year: leave.year,
        semester: leave.semester,
        section: leave.section,
        leaveType: leave.leave_type || leave.type || 'Medical Leave',
        leave_type: leave.leave_type || leave.type || 'Medical Leave',
        reason: leave.reason || '',
        fromDate: fromD,
        from_date: fromD,
        toDate: toD,
        to_date: toD,
        startDate: fromD,
        endDate: toD,
        numberOfDays: days,
        number_of_days: days,
        days: days,
        status: leave.status,
        supportingDocument: leave.supporting_document || null,
        hodRemarks: isApproved ? (leave.hod_remarks || 'Approved by Department HOD.') : (isRejected ? null : (leave.hod_remarks || '')),
        rejectionReason: isApproved ? null : (leave.rejection_reason || null),
        submittedAt: leave.created_at,
        createdAt: leave.created_at,
        updatedAt: leave.updated_at,
        photoPath: leave.photo_path || '',
        student: {
          id: leave.student_id,
          name: leave.student_name,
          registerNumber: leave.register_number,
          department: leave.department,
          year: leave.year,
          semester: leave.semester,
          section: leave.section,
          phone: leave.phone,
          photoPath: leave.photo_path || ''
        }
      };

      return jsonResponse({
        success: true,
        leave: formattedLeave,
        data: formattedLeave,
        ...formattedLeave
      });
    }

    if (singleLeaveMatch && method === 'DELETE') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const leaveId = singleLeaveMatch[1];
      const leave = await db.prepare('SELECT * FROM leave_requests WHERE id = ?').bind(leaveId).first();
      if (!leave) return jsonResponse({ message: 'Leave request not found.' }, 404);

      if (authUser.role === 'student') {
        const student = await db.prepare('SELECT id FROM students WHERE user_id = ?').bind(authUser.id).first();
        if (!student || student.id !== leave.student_id) {
          return jsonResponse({ message: 'Forbidden' }, 403);
        }
      }

      await db.prepare('DELETE FROM leave_requests WHERE id = ?').bind(leaveId).run();
      return jsonResponse({ success: true, message: 'Leave request cancelled successfully.' });
    }

    const leaveApproveMatch = path.match(/^\/api\/(?:admin\/)?leaves?(?:\/requests)?\/(\d+)\/approve$/);
    if (leaveApproveMatch && (method === 'POST' || method === 'PUT')) {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const body = await request.json().catch(() => ({}));
      const leaveId = leaveApproveMatch[1];
      const isHod = authUser.role === 'admin' || authUser.role === 'hod';

      const existingLeave = await db.prepare('SELECT * FROM leave_requests WHERE id = ?').bind(leaveId).first();
      if (!existingLeave) return jsonResponse({ message: 'Leave request not found.' }, 404);

      const curStatus = String(existingLeave.status || '').toUpperCase().trim();
      if (curStatus === 'APPROVED') {
        return jsonResponse({ message: 'Leave request is already approved.' }, 400);
      }
      if (curStatus.startsWith('REJECT')) {
        return jsonResponse({ message: 'Cannot approve a rejected leave request.' }, 400);
      }

      const nextStatus = isHod ? 'APPROVED' : 'PENDING_HOD';
      const remarks = body.hodRemarks || body.remarks || (isHod ? 'Approved by Department HOD.' : 'Recommended by Class Incharge.');

      await db.prepare(`
        UPDATE leave_requests
        SET status = ?,
            hod_remarks = ?,
            rejection_reason = NULL,
            processed_by = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(nextStatus, remarks, authUser.id, leaveId).run();

      const leaveRecord = await db.prepare(`
        SELECT l.*, s.name as student_name, s.department, s.user_id as student_user_id
        FROM leave_requests l JOIN students s ON l.student_id = s.id
        WHERE l.id = ?
      `).bind(leaveId).first();

      if (leaveRecord) {
        if (nextStatus === 'PENDING_HOD') {
          const hod = await db.prepare(`
            SELECT u.id FROM users u
            JOIN roles r ON u.role_id = r.id
            JOIN faculty f ON f.user_id = u.id
            WHERE (r.name = 'admin' OR r.name = 'hod') AND f.department = ? AND u.is_approved = 1
            LIMIT 1
          `).bind(leaveRecord.department).first();

          if (hod?.id) {
            const msg = `Class Incharge recommended leave for ${leaveRecord.student_name}. Awaiting your final approval.`;
            await db.prepare('INSERT INTO notifications (user_id, message, is_read, type, related_id) VALUES (?, ?, 0, ?, ?)')
              .bind(hod.id, msg, 'LEAVE_FORWARDED', leaveId).run();

            await sendPushNotificationToUser(db, env, hod.id, {
              title: '📑 Leave Pending HOD Approval',
              body: msg,
              url: '/leave.html',
              type: 'LEAVE_FORWARDED'
            });
          }
        } else if (nextStatus === 'APPROVED' && leaveRecord.student_user_id) {
          const msg = `Your leave application (${leaveRecord.from_date} to ${leaveRecord.to_date}) has been approved.`;
          await db.prepare('INSERT INTO notifications (user_id, message, is_read, type, related_id) VALUES (?, ?, 0, ?, ?)')
            .bind(leaveRecord.student_user_id, msg, 'LEAVE_APPROVED', leaveId).run();

          await sendPushNotificationToUser(db, env, leaveRecord.student_user_id, {
            title: '✅ Leave Approved',
            body: msg,
            url: '/student_leave.html',
            type: 'LEAVE_APPROVED'
          });
        }
      }

      return jsonResponse({ success: true, message: `Leave ${nextStatus === 'APPROVED' ? 'approved' : 'forwarded to HOD'}.` });
    }

    const leaveRejectMatch = path.match(/^\/api\/(?:admin\/)?leaves?(?:\/requests)?\/(\d+)\/reject$/);
    if (leaveRejectMatch && (method === 'POST' || method === 'PUT')) {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const body = await request.json().catch(() => ({}));
      const leaveId = leaveRejectMatch[1];
      const isHod = authUser.role === 'admin' || authUser.role === 'hod';

      const existingLeave = await db.prepare('SELECT * FROM leave_requests WHERE id = ?').bind(leaveId).first();
      if (!existingLeave) return jsonResponse({ message: 'Leave request not found.' }, 404);

      const curStatus = String(existingLeave.status || '').toUpperCase().trim();
      if (curStatus === 'APPROVED') {
        return jsonResponse({ message: 'Cannot reject an already approved leave request.' }, 400);
      }
      if (curStatus.startsWith('REJECT')) {
        return jsonResponse({ message: 'Leave request is already rejected.' }, 400);
      }

      const rejectStatus = isHod ? 'REJECTED_BY_HOD' : 'REJECTED_BY_CLASS_INCHARGE';
      const rejectReason = body.reason || body.rejectionReason || 'Application rejected.';

      await db.prepare(`
        UPDATE leave_requests
        SET status = ?,
            rejection_reason = ?,
            hod_remarks = NULL,
            processed_by = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(rejectStatus, rejectReason, authUser.id, leaveId).run();

      const leaveRecord = await db.prepare(`
        SELECT l.*, s.user_id as student_user_id FROM leave_requests l JOIN students s ON l.student_id = s.id WHERE l.id = ?
      `).bind(leaveId).first();

      if (leaveRecord?.student_user_id) {
        const msg = `Your leave application was rejected: ${rejectReason}.`;
        await db.prepare('INSERT INTO notifications (user_id, message, is_read, type, related_id) VALUES (?, ?, 0, ?, ?)')
          .bind(leaveRecord.student_user_id, msg, 'LEAVE_REJECTED', leaveId).run();

        await sendPushNotificationToUser(db, env, leaveRecord.student_user_id, {
          title: '❌ Leave Request Rejected',
          body: msg,
          url: '/student_leave.html',
          type: 'LEAVE_REJECTED'
        });
      }

      return jsonResponse({ success: true, message: 'Leave request rejected.' });
    }

    // =============================================================
    // 12. ANNOUNCEMENTS MODULE
    if (path === '/api/announcements' && method === 'GET') {
      const results = await db.prepare(`
        SELECT a.*, u.username as author
        FROM announcements a
        JOIN users u ON a.posted_by = u.id
        ORDER BY a.created_at DESC
      `).all();

      return jsonResponse({ success: true, announcements: results.results });
    }

    if ((path === '/api/announcements/create' || path === '/api/announcements') && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const body = await request.json();
      const targetDept = body.targetDepartment || 'all';
      const targetYear = body.targetYear || 'all';
      const targetSem = body.targetSemester || 'all';
      const targetSec = body.targetSection || 'all';

      await db.prepare(`
        INSERT INTO announcements (title, content, category, posted_by, target_department, target_year, target_semester, target_section)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(body.title, body.content, body.category || 'Academic', authUser.id, targetDept, targetYear, targetSem, targetSec).run();

      // Push notify targeted audience
      let targetQuery = `
        SELECT u.id 
        FROM users u
        LEFT JOIN students s ON s.user_id = u.id
        LEFT JOIN faculty f ON f.user_id = u.id
        WHERE u.is_active = 1
      `;
      const targetParams = [];
      if (targetDept !== 'all') {
        targetQuery += ' AND COALESCE(s.department, f.department) = ?';
        targetParams.push(targetDept);
      }
      if (targetYear !== 'all') {
        targetQuery += ' AND (s.year = ? OR s.year IS NULL)';
        targetParams.push(targetYear);
      }

      const targets = await db.prepare(targetQuery).bind(...targetParams).all();
      for (const t of (targets.results || [])) {
        await sendPushNotificationToUser(db, env, t.id, {
          title: `📢 ${body.title}`,
          body: body.content?.substring(0, 100) || 'New announcement published.',
          url: '/announcements.html',
          type: 'ANNOUNCEMENT'
        });
      }

      return jsonResponse({ success: true, message: 'Announcement published successfully.' });
    }

    const annDeleteMatch = path.match(/^\/api\/announcements\/(\d+)$/);
    if (annDeleteMatch && method === 'DELETE') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'faculty')) {
        return jsonResponse({ message: 'Forbidden' }, 403);
      }
      await db.prepare('DELETE FROM announcements WHERE id = ?').bind(annDeleteMatch[1]).run();
      return jsonResponse({ success: true, message: 'Announcement deleted.' });
    }

    // =============================================================
    // 13. NOTIFICATIONS MODULE
    // =============================================================
    if (path === '/api/notifications' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ notifications: [], unreadCount: 0 });

      const results = await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30')
        .bind(authUser.id).all();

      const notifs = (results.results || []).map(n => ({
        ...n,
        isRead: Boolean(n.is_read),
        createdAt: n.created_at
      }));

      const unreadCount = notifs.filter(n => !n.isRead).length;

      return jsonResponse({ success: true, notifications: notifs, unreadCount });
    }

    if (path === '/api/notifications/read-all' && (method === 'POST' || method === 'PUT')) {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      await db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').bind(authUser.id).run();
      return jsonResponse({ success: true, message: 'All notifications marked as read.' });
    }

    const notifReadMatch = path.match(/^\/api\/notifications\/(\d+)\/read$/);
    if (notifReadMatch && (method === 'POST' || method === 'PUT')) {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
        .bind(notifReadMatch[1], authUser.id).run();

      return jsonResponse({ success: true, message: 'Notification marked as read.' });
    }

    // =============================================================
    // 14. RESOURCES MODULE
    // =============================================================
    if (path === '/api/resources/faculty' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const faculty = await db.prepare('SELECT id FROM faculty WHERE user_id = ?').bind(authUser.id).first();
      if (!faculty) return jsonResponse({ success: true, resources: [] });

      const resources = await db.prepare(`
        SELECT r.*, sub.name as subject_name, sub.code as subject_code
        FROM resources r
        JOIN subjects sub ON r.subject_id = sub.id
        WHERE r.faculty_id = ?
        ORDER BY r.created_at DESC
      `).bind(faculty.id).all();

      return jsonResponse({ success: true, resources: resources.results });
    }

    if (path === '/api/resources/student' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const student = await db.prepare('SELECT * FROM students WHERE user_id = ?').bind(authUser.id).first();
      if (!student) return jsonResponse({ success: true, resources: [] });

      const resources = await db.prepare(`
        SELECT r.*, sub.name as subject_name, sub.code as subject_code, f.name as faculty_name
        FROM resources r
        JOIN subjects sub ON r.subject_id = sub.id
        JOIN faculty f ON r.faculty_id = f.id
        WHERE sub.department = ? AND sub.year = ? AND sub.semester = ? AND (sub.section = ? OR sub.section = 'ALL')
        ORDER BY r.created_at DESC
      `).bind(student.department, student.year, student.semester, student.section).all();

      return jsonResponse({ success: true, resources: resources.results });
    }

    if (path === '/api/resources/upload' && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const body = await request.json();
      const faculty = await db.prepare('SELECT id FROM faculty WHERE user_id = ?').bind(authUser.id).first();

      await db.prepare(`
        INSERT INTO resources (title, category, subject_id, faculty_id, file_name, file_path, file_size)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(body.title, body.category || 'Lecture Notes', body.subjectId, faculty ? faculty.id : 1, body.fileName || 'file.pdf', body.filePath || '', body.fileSize || 'N/A').run();

      return jsonResponse({ success: true, message: 'Resource uploaded successfully.' });
    }

    const resDeleteMatch = path.match(/^\/api\/resources\/(\d+)$/);
    if (resDeleteMatch && method === 'DELETE') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);
      await db.prepare('DELETE FROM resources WHERE id = ?').bind(resDeleteMatch[1]).run();
      return jsonResponse({ success: true, message: 'Resource deleted.' });
    }

    // =============================================================
    // 15. CLOUDFLARE NATIVE WEB PUSH NOTIFICATION API
    // =============================================================
    if (path === '/api/push/vapid-public-key' && method === 'GET') {
      const pubKey = env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
      return jsonResponse({ success: true, publicKey: pubKey });
    }

    if (path === '/api/push/subscribe' && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const body = await request.json();
      const { endpoint, keys, userAgent } = body;

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return jsonResponse({ message: 'Invalid subscription payload.' }, 400);
      }

      await db.prepare(`
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(endpoint) DO UPDATE SET
          user_id = excluded.user_id,
          p256dh = excluded.p256dh,
          auth = excluded.auth,
          user_agent = excluded.user_agent,
          updated_at = CURRENT_TIMESTAMP
      `).bind(authUser.id, endpoint, keys.p256dh, keys.auth, userAgent || '').run();

      return jsonResponse({ success: true, message: 'Push subscription registered successfully.' });
    }

    if (path === '/api/push/unsubscribe' && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const body = await request.json().catch(() => ({}));
      if (body.endpoint) {
        await db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
          .bind(authUser.id, body.endpoint).run();
      } else {
        await db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').bind(authUser.id).run();
      }

      return jsonResponse({ success: true, message: 'Unsubscribed from push notifications.' });
    }

    if (path === '/api/push/test' && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      await sendPushNotificationToUser(db, env, authUser.id, {
        title: '🔔 SMS Portal Push Notification',
        body: 'Web Push is working perfectly on this device via Cloudflare Native Edge!',
        url: '/dashboard.html'
      });

      return jsonResponse({ success: true, message: 'Test notification sent.' });
    }

    return jsonResponse({ message: `API route '${path}' not found.` }, 404);

  } catch (error) {
    return jsonResponse({ error: error.message, stack: error.stack }, 500);
  }
}

// -------------------------------------------------------------------
// EXPORT WORKER FETCH HANDLER
// -------------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route /api/* to D1 Serverless Edge Router
    if (url.pathname.startsWith('/api')) {
      return handleApiRequest(request, env);
    }

    // Serve static assets from ./dist
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
