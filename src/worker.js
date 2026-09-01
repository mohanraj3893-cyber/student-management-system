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

      const pendingUsers = await db.prepare(`
        SELECT u.id as user_id, u.username, u.email, u.created_at, r.name as role_name,
               COALESCE(s.name, f.name) as name,
               COALESCE(s.department, f.department) as department,
               s.register_number, s.year, s.semester, s.section, s.phone,
               f.employee_id, f.designation
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN students s ON s.user_id = u.id
        LEFT JOIN faculty f ON f.user_id = u.id
        WHERE u.is_approved = 0 AND r.name != 'admin'
        ORDER BY u.created_at DESC
      `).all();

      return jsonResponse({ success: true, registrations: pendingUsers.results, count: pendingUsers.results.length });
    }

    // Approve Registration
    const approveMatch = path.match(/^\/api\/auth\/(?:registrations|faculty-registrations|approve-user)\/(\d+)(?:\/approve)?$/);
    if (approveMatch && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser || authUser.role !== 'admin') return jsonResponse({ message: 'Forbidden' }, 403);

      const targetUserId = approveMatch[1];
      await db.prepare('UPDATE users SET is_approved = 1 WHERE id = ?').bind(targetUserId).run();
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
      const department = url.searchParams.get('department');
      const year = url.searchParams.get('year');
      const semester = url.searchParams.get('semester');
      const section = url.searchParams.get('section');

      let query = 'SELECT s.*, u.email FROM students s JOIN users u ON s.user_id = u.id WHERE u.is_approved = 1';
      const params = [];

      if (department) { query += ' AND s.department = ?'; params.push(department); }
      if (year && year !== 'ALL') { query += ' AND s.year = ?'; params.push(year); }
      if (semester && semester !== 'ALL') { query += ' AND s.semester = ?'; params.push(semester); }
      if (section && section !== 'ALL') { query += ' AND s.section = ?'; params.push(section); }

      query += ' ORDER BY s.name ASC';
      const results = await db.prepare(query).bind(...params).all();
      return jsonResponse({ success: true, count: results.results.length, students: results.results });
    }

    const studentIdMatch = path.match(/^\/api\/students\/(\d+)$/);
    if (studentIdMatch && method === 'GET') {
      const student = await db.prepare('SELECT s.*, u.email FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ?').bind(studentIdMatch[1]).first();
      if (!student) return jsonResponse({ message: 'Student not found' }, 404);
      return jsonResponse({ success: true, student });
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
      if (!authUser || authUser.role !== 'admin') return jsonResponse({ message: 'Forbidden' }, 403);
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
      const department = url.searchParams.get('department');
      let query = 'SELECT f.*, u.email FROM faculty f JOIN users u ON f.user_id = u.id WHERE u.is_approved = 1';
      const params = [];
      if (department) { query += ' AND f.department = ?'; params.push(department); }
      query += ' ORDER BY f.name ASC';
      const results = await db.prepare(query).bind(...params).all();
      return jsonResponse({ success: true, faculty: results.results });
    }

    if (path === '/api/faculty/my-students' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const faculty = await db.prepare('SELECT id, department FROM faculty WHERE user_id = ?').bind(authUser.id).first();
      if (!faculty) return jsonResponse({ success: true, students: [] });

      // Students from classes assigned to this faculty as Incharge OR enrolled in their subjects
      const students = await db.prepare(`
        SELECT DISTINCT s.*, u.email
        FROM students s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN class_incharges ci ON ci.department = s.department AND ci.year = s.year AND ci.semester = s.semester AND ci.section = s.section
        LEFT JOIN subjects sub ON sub.department = s.department AND sub.year = s.year AND sub.semester = s.semester AND sub.section = s.section
        WHERE (ci.faculty_id = ? OR sub.faculty_id = ?) AND u.is_approved = 1
        ORDER BY s.name ASC
      `).bind(faculty.id, faculty.id).all();

      return jsonResponse({ success: true, students: students.results });
    }

    const facultyIdMatch = path.match(/^\/api\/faculty\/(\d+)$/);
    if (facultyIdMatch && method === 'GET') {
      const fac = await db.prepare('SELECT f.*, u.email FROM faculty f JOIN users u ON f.user_id = u.id WHERE f.id = ?').bind(facultyIdMatch[1]).first();
      if (!fac) return jsonResponse({ message: 'Faculty not found' }, 404);
      return jsonResponse({ success: true, faculty: fac });
    }

    // =============================================================
    // 7. CLASS INCHARGE MODULE
    // =============================================================
    if (path === '/api/class-incharge' && method === 'GET') {
      const results = await db.prepare(`
        SELECT ci.*, f.name as faculty_name, f.employee_id
        FROM class_incharges ci
        JOIN faculty f ON ci.faculty_id = f.id
        ORDER BY ci.year, ci.semester, ci.section
      `).all();
      return jsonResponse({ success: true, classIncharges: results.results });
    }

    if (path === '/api/class-incharge/assign' && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser || authUser.role !== 'admin') return jsonResponse({ message: 'Forbidden' }, 403);

      const body = await request.json();
      const { department, year, semester, section, facultyId } = body;

      await db.prepare(`
        INSERT OR REPLACE INTO class_incharges (department, year, semester, section, faculty_id, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(department || 'Computer Science & Engineering', year, semester, section || 'A', facultyId).run();

      return jsonResponse({ success: true, message: 'Class Incharge assigned successfully.' });
    }

    if (path === '/api/class-incharge/remove' && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser || authUser.role !== 'admin') return jsonResponse({ message: 'Forbidden' }, 403);

      const body = await request.json();
      await db.prepare('DELETE FROM class_incharges WHERE id = ?').bind(body.id).run();
      return jsonResponse({ success: true, message: 'Class Incharge assignment removed.' });
    }

    if (path === '/api/class-incharge/my-assignments' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const faculty = await db.prepare('SELECT id FROM faculty WHERE user_id = ?').bind(authUser.id).first();
      if (!faculty) return jsonResponse({ success: true, assignments: [] });

      const assignments = await db.prepare('SELECT * FROM class_incharges WHERE faculty_id = ?').bind(faculty.id).all();
      return jsonResponse({ success: true, assignments: assignments.results });
    }

    // =============================================================
    // 8. SUBJECTS MODULE
    // =============================================================
    if (path === '/api/subjects' && method === 'GET') {
      const results = await db.prepare(`
        SELECT s.*, f.name as faculty_name
        FROM subjects s
        LEFT JOIN faculty f ON s.faculty_id = f.id
        ORDER BY s.semester, s.code
      `).all();
      return jsonResponse({ success: true, subjects: results.results });
    }

    if (path === '/api/subjects' && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser || authUser.role !== 'admin') return jsonResponse({ message: 'Forbidden' }, 403);

      const body = await request.json();
      const { code, name, credits, semester, year, section, department, facultyId } = body;

      await db.prepare(`
        INSERT INTO subjects (code, name, credits, semester, year, section, department, faculty_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(code, name, credits || 3, semester, year || 'III-Year', section || 'A', department || 'Computer Science & Engineering', facultyId || null).run();

      return jsonResponse({ success: true, message: 'Subject created successfully.' });
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
        SELECT s.*, f.name as faculty_name
        FROM subjects s
        LEFT JOIN faculty f ON s.faculty_id = f.id
        WHERE s.department = ? AND s.year = ? AND s.semester = ? AND (s.section = ? OR s.section = 'ALL')
        ORDER BY s.code
      `).bind(student.department, student.year, student.semester, student.section).all();

      return jsonResponse({ success: true, subjects: subjects.results });
    }

    const subjectIdMatch = path.match(/^\/api\/subjects\/(\d+)$/);
    if (subjectIdMatch && method === 'DELETE') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser || authUser.role !== 'admin') return jsonResponse({ message: 'Forbidden' }, 403);
      await db.prepare('DELETE FROM subjects WHERE id = ?').bind(subjectIdMatch[1]).run();
      return jsonResponse({ success: true, message: 'Subject deleted.' });
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
          await db.prepare(`
            INSERT OR REPLACE INTO attendance_records (session_id, student_id, date, status, marked_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(sessionId, rec.studentId || rec.id, date, rec.status).run();
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

      if (Array.isArray(marks)) {
        for (const item of marks) {
          if (item.marks !== '' && item.marks !== null && item.marks !== undefined) {
            await db.prepare(`
              INSERT OR REPLACE INTO internal_marks (student_id, subject_id, exam_type, marks_obtained, max_marks, updated_at)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).bind(item.studentId, subjectId, examType, Number(item.marks), maxMarks || 100).run();
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
    if ((path === '/api/leaves/requests' || path === '/api/leaves') && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      let query = `
        SELECT l.*, s.name as student_name, s.register_number, s.department, s.year, s.semester, s.section, s.phone, s.photo_path
        FROM leave_requests l
        JOIN students s ON l.student_id = s.id
        WHERE 1=1
      `;
      const params = [];

      if (authUser.role === 'student') {
        const student = await db.prepare('SELECT id FROM students WHERE user_id = ?').bind(authUser.id).first();
        if (student) {
          query += ' AND l.student_id = ?';
          params.push(student.id);
        }
      } else if (authUser.role === 'faculty') {
        const fac = await db.prepare('SELECT id FROM faculty WHERE user_id = ?').bind(authUser.id).first();
        if (fac) {
          query += ` AND EXISTS (
            SELECT 1 FROM class_incharges ci 
            WHERE ci.faculty_id = ? AND ci.department = s.department AND ci.year = s.year AND ci.semester = s.semester AND ci.section = s.section
          )`;
          params.push(fac.id);
        }
      }

      query += ' ORDER BY l.created_at DESC';
      const results = await db.prepare(query).bind(...params).all();
      const allRows = results.results.map(r => ({
        ...r,
        studentName: r.student_name,
        registerNumber: r.register_number,
        startDate: r.from_date,
        endDate: r.to_date,
        numberOfDays: r.number_of_days,
        days: r.number_of_days,
        photoPath: r.photo_path,
        rejectionReason: r.rejection_reason
      }));

      const pending = allRows.filter(r => String(r.status || '').toUpperCase().includes('PENDING'));
      const history = allRows.filter(r => !String(r.status || '').toUpperCase().includes('PENDING'));

      return jsonResponse({
        success: true,
        requests: allRows,
        pending,
        history,
        leaves: allRows
      });
    }

    if ((path === '/api/leaves/apply' || path === '/api/leaves') && method === 'POST') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const body = await request.json();
      const student = await db.prepare('SELECT id FROM students WHERE user_id = ?').bind(authUser.id).first();
      if (!student) return jsonResponse({ message: 'Student record not found.' }, 400);

      const leaveType = body.leaveType || body.type || 'Casual Leave';
      const fromDate = body.fromDate || body.startDate || '';
      const toDate = body.toDate || body.endDate || fromDate;
      const numberOfDays = Number(body.numberOfDays || body.days || 1);
      const reason = body.reason || 'Personal Leave';
      const supportingDoc = body.supportingDocument || body.supportingDoc || '';

      await db.prepare(`
        INSERT INTO leave_requests (student_id, leave_type, from_date, to_date, number_of_days, reason, supporting_document, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_CLASS_INCHARGE')
      `).bind(student.id, leaveType, fromDate, toDate, numberOfDays, reason, supportingDoc).run();

      return jsonResponse({ success: true, message: 'Leave application submitted to Class Incharge.' });
    }

    if (path === '/api/leaves/my' && method === 'GET') {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const student = await db.prepare('SELECT id FROM students WHERE user_id = ?').bind(authUser.id).first();
      if (!student) return jsonResponse({ success: true, leaves: [] });

      const leaves = await db.prepare('SELECT * FROM leave_requests WHERE student_id = ? ORDER BY created_at DESC').bind(student.id).all();
      return jsonResponse({ success: true, leaves: leaves.results });
    }

    const leaveApproveMatch = path.match(/^\/api\/leaves(?:\/requests)?\/(\d+)\/approve$/);
    if (leaveApproveMatch && (method === 'POST' || method === 'PUT')) {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const leaveId = leaveApproveMatch[1];
      const nextStatus = authUser.role === 'admin' ? 'APPROVED' : 'PENDING_HOD';

      await db.prepare('UPDATE leave_requests SET status = ?, processed_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(nextStatus, authUser.id, leaveId).run();

      return jsonResponse({ success: true, message: `Leave ${nextStatus === 'APPROVED' ? 'approved' : 'forwarded to HOD'}.` });
    }

    const leaveRejectMatch = path.match(/^\/api\/leaves(?:\/requests)?\/(\d+)\/reject$/);
    if (leaveRejectMatch && (method === 'POST' || method === 'PUT')) {
      const authUser = await getUserFromRequest(request, env);
      if (!authUser) return jsonResponse({ message: 'Unauthorized' }, 401);

      const body = await request.json().catch(() => ({}));
      const leaveId = leaveRejectMatch[1];

      await db.prepare('UPDATE leave_requests SET status = ?, rejection_reason = ?, processed_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind('REJECTED', body.reason || 'Not approved', authUser.id, leaveId).run();

      return jsonResponse({ success: true, message: 'Leave request rejected.' });
    }

    // =============================================================
    // 12. ANNOUNCEMENTS MODULE
    // =============================================================
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
      await db.prepare(`
        INSERT INTO announcements (title, content, category, posted_by, target_department, target_year, target_semester, target_section)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(body.title, body.content, body.category || 'Academic', authUser.id, body.targetDepartment || 'all', body.targetYear || 'all', body.targetSemester || 'all', body.targetSection || 'all').run();

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
      if (!authUser) return jsonResponse({ notifications: [] });

      const results = await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
        .bind(authUser.id).all();

      return jsonResponse({ success: true, notifications: results.results });
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
