// Cloudflare Worker Fullstack Entrypoint
// Handles /api/* with Cloudflare D1 Database and serves static assets for all other routes

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
    // -------------------------------------------------------------
    // AUTH ROUTE: Check if Admin exists
    // -------------------------------------------------------------
    if (path === '/api/auth/admin-exists' && method === 'GET') {
      const adminRole = await db.prepare('SELECT id FROM roles WHERE name = ?').bind('admin').first();
      if (!adminRole) {
        return jsonResponse({ exists: false, count: 0 });
      }
      const adminUser = await db.prepare('SELECT id FROM users WHERE role_id = ?').bind(adminRole.id).first();
      return jsonResponse({ exists: !!adminUser, count: adminUser ? 1 : 0 });
    }

    // -------------------------------------------------------------
    // AUTH ROUTE: Register (HOD, Faculty, Student)
    // -------------------------------------------------------------
    if (path === '/api/auth/register' && method === 'POST') {
      const body = await request.json();
      const { username, email, password, role, name, extraData, photo, department } = body;

      if (!username || !email || !password || !role || !name) {
        return jsonResponse({ message: 'All registration fields are required.' }, 400);
      }

      // Check existing username / email
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

      const successMsg = normalizedRole === 'admin' 
        ? 'HOD account created successfully! You can now log in.' 
        : 'Registration submitted successfully. Waiting for HOD approval.';

      return jsonResponse({ success: true, message: successMsg, userId });
    }

    // -------------------------------------------------------------
    // AUTH ROUTE: Login
    // -------------------------------------------------------------
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

      if (!user) {
        return jsonResponse({ message: 'Invalid credentials. User not found.' }, 401);
      }

      const isValid = await verifyPassword(password, user.password_hash);
      if (!isValid) {
        return jsonResponse({ message: 'Invalid credentials. Password incorrect.' }, 401);
      }

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
        name: profileData.name || user.username
      }, env.JWT_SECRET || 'sms_super_secret_jwt_key_2026');

      return jsonResponse({
        success: true,
        message: 'Login successful',
        token,
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

    // -------------------------------------------------------------
    // AUTH ROUTE: Get Profile
    // -------------------------------------------------------------
    if (path === '/api/auth/profile' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const user = await db.prepare(`
        SELECT u.id, u.username, u.email, r.name as role_name
        FROM users u JOIN roles r ON u.role_id = r.id
        WHERE u.id = ?
      `).bind(authUser.id).first();

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

    // -------------------------------------------------------------
    // DASHBOARD STATS ROUTE
    // -------------------------------------------------------------
    if (path === '/api/dashboard/stats' && method === 'GET') {
      const studentCount = await db.prepare('SELECT COUNT(*) as count FROM students').first();
      const facultyCount = await db.prepare('SELECT COUNT(*) as count FROM faculty').first();
      const subjectCount = await db.prepare('SELECT COUNT(*) as count FROM subjects').first();
      const pendingLeaves = await db.prepare("SELECT COUNT(*) as count FROM leave_requests WHERE status LIKE '%PENDING%'").first();

      return jsonResponse({
        totalStudents: studentCount?.count || 0,
        totalFaculty: facultyCount?.count || 0,
        totalSubjects: subjectCount?.count || 0,
        pendingLeaves: pendingLeaves?.count || 0,
        attendanceRate: 94.2
      });
    }

    // -------------------------------------------------------------
    // STUDENTS ROUTE
    // -------------------------------------------------------------
    if (path === '/api/students' && method === 'GET') {
      const department = url.searchParams.get('department');
      const year = url.searchParams.get('year');
      const semester = url.searchParams.get('semester');
      const section = url.searchParams.get('section');

      let query = 'SELECT s.*, u.email FROM students s JOIN users u ON s.user_id = u.id WHERE 1=1';
      const params = [];

      if (department) { query += ' AND s.department = ?'; params.push(department); }
      if (year) { query += ' AND s.year = ?'; params.push(year); }
      if (semester) { query += ' AND s.semester = ?'; params.push(semester); }
      if (section && section !== 'ALL') { query += ' AND s.section = ?'; params.push(section); }

      query += ' ORDER BY s.name ASC';
      const results = await db.prepare(query).bind(...params).all();
      return jsonResponse({ success: true, count: results.results.length, students: results.results });
    }

    // -------------------------------------------------------------
    // FACULTY ROUTE
    // -------------------------------------------------------------
    if (path === '/api/faculty' && method === 'GET') {
      const query = 'SELECT f.*, u.email FROM faculty f JOIN users u ON f.user_id = u.id ORDER BY f.name ASC';
      const results = await db.prepare(query).all();
      return jsonResponse({ success: true, faculty: results.results });
    }

    // -------------------------------------------------------------
    // SUBJECTS ROUTE
    // -------------------------------------------------------------
    if (path === '/api/subjects' && method === 'GET') {
      const results = await db.prepare('SELECT s.*, f.name as faculty_name FROM subjects s LEFT JOIN faculty f ON s.faculty_id = f.id').all();
      return jsonResponse({ success: true, subjects: results.results });
    }

    if (path === '/api/subjects' && method === 'POST') {
      const body = await request.json();
      const { code, name, credits, semester, year, section, department, facultyId } = body;
      await db.prepare(`
        INSERT INTO subjects (code, name, credits, semester, year, section, department, faculty_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(code, name, credits || 3, semester, year || 'III-Year', section || 'A', department || 'Computer Science & Engineering', facultyId || null).run();
      return jsonResponse({ success: true, message: 'Subject created successfully.' });
    }

    // -------------------------------------------------------------
    // ATTENDANCE ROUTE
    // -------------------------------------------------------------
    if (path === '/api/attendance/today' && method === 'GET') {
      const today = new Date().toISOString().split('T')[0];
      const records = await db.prepare('SELECT * FROM attendance_sessions WHERE date = ?').bind(today).all();
      return jsonResponse({ success: true, sessions: records.results });
    }

    if (path === '/api/attendance/mark' && method === 'POST') {
      const body = await request.json();
      const { facultyId, department, year, semester, section, date, records } = body;

      const sessionInsert = await db.prepare(`
        INSERT INTO attendance_sessions (faculty_id, department, year, semester, section, date)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(facultyId || 1, department, year, semester, section, date).run();

      const sessionId = sessionInsert.meta.last_row_id;
      if (Array.isArray(records)) {
        for (const rec of records) {
          await db.prepare(`
            INSERT INTO attendance_records (session_id, student_id, date, status)
            VALUES (?, ?, ?, ?)
          `).bind(sessionId, rec.studentId, date, rec.status).run();
        }
      }

      return jsonResponse({ success: true, message: 'Attendance saved successfully!' });
    }

    // -------------------------------------------------------------
    // ANNOUNCEMENTS ROUTE
    // -------------------------------------------------------------
    if (path === '/api/announcements' && method === 'GET') {
      const results = await db.prepare('SELECT a.*, u.username as author FROM announcements a JOIN users u ON a.posted_by = u.id ORDER BY a.created_at DESC').all();
      return jsonResponse({ success: true, announcements: results.results });
    }

    if (path === '/api/announcements/create' && method === 'POST') {
      const body = await request.json();
      const authUser = await getUserFromRequest(request, env);
      await db.prepare(`
        INSERT INTO announcements (title, content, category, posted_by, target_department, target_year, target_semester, target_section)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(body.title, body.content, body.category || 'Academic', authUser?.id || 1, body.targetDepartment || 'all', body.targetYear || 'all', body.targetSemester || 'all', body.targetSection || 'all').run();
      return jsonResponse({ success: true, message: 'Announcement published successfully.' });
    }

    // -------------------------------------------------------------
    // NOTIFICATIONS ROUTE
    // -------------------------------------------------------------
    if (path === '/api/notifications' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ notifications: [] });
      const results = await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 15').bind(authUser.id).all();
      return jsonResponse({ success: true, notifications: results.results });
    }

    return jsonResponse({ message: `API route '${path}' not found.` }, 404);

  } catch (error) {
    return jsonResponse({ error: error.message, stack: error.stack }, 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // If URL starts with /api/, handle via D1 serverless API
    if (url.pathname.startsWith('/api')) {
      return handleApiRequest(request, env);
    }

    // Otherwise serve static files from ./dist
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
