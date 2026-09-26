// =====================================================================
// Cloudflare Native Worker for Student Management System (SMS)
// 100% Serverless: Pages + Workers + D1 + R2 + Durable Objects + Web Push
// =====================================================================

// ---------------------------------------------------------------------
// 1. Web Crypto Helper Functions (JWT, HMAC, Hashing)
// ---------------------------------------------------------------------
async function getCryptoKey(secret) {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function base64UrlEncode(data) {
  let str = typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function signJwt(payload, secret, expiresInSec = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSec };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(fullPayload)));
  const dataToSign = `${headerB64}.${payloadB64}`;

  const key = await getCryptoKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(dataToSign));
  const sigB64 = base64UrlEncode(signature);

  return `${dataToSign}.${sigB64}`;
}

async function verifyJwt(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const dataToVerify = `${headerB64}.${payloadB64}`;

    const enc = new TextEncoder();
    const key = await getCryptoKey(secret);
    const signature = base64UrlDecode(sigB64);

    const valid = await crypto.subtle.verify('HMAC', key, signature, enc.encode(dataToVerify));
    if (!valid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch (e) {
    return null;
  }
}

async function hashPassword(password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  return `${base64UrlEncode(salt)}:${base64UrlEncode(hash)}`;
}

async function verifyPassword(password, storedHash) {
  try {
    if (!storedHash) return false;
    // Check if hash is in salt:hash format
    if (storedHash.includes(':')) {
      const [saltB64, hashB64] = storedHash.split(':');
      const salt = base64UrlDecode(saltB64);
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      const hash = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );
      return base64UrlEncode(hash) === hashB64;
    }
    // Fallback: bcrypt hash format check / legacy direct comparison
    return password === storedHash;
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------------
// 2. Response Helpers & CORS
// ---------------------------------------------------------------------
function corsHeaders(req) {
  const origin = req.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true'
  };
}

function jsonResponse(data, status = 200, req = null, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(req ? corsHeaders(req) : { 'Access-Control-Allow-Origin': '*' }),
    ...extraHeaders
  };
  return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(message, status = 400, req = null) {
  return jsonResponse({ message }, status, req);
}

// ---------------------------------------------------------------------
// 3. User Authentication & Authorization Middleware
// ---------------------------------------------------------------------
async function getAuthenticatedUser(request, env) {
  let token = null;
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Check URL search params
    const url = new URL(request.url);
    token = url.searchParams.get('token');
    if (!token) {
      // Check Cookie
      const cookie = request.headers.get('Cookie');
      if (cookie) {
        const match = cookie.match(/token=([^;]+)/);
        if (match) token = match[1];
      }
    }
  }

  if (!token) return null;

  const secret = env.JWT_SECRET || 'super_secret_access_jwt_key_2026_cse_dept';
  const decoded = await verifyJwt(token, secret);
  if (!decoded || !decoded.id) return null;

  // Retrieve fresh user record from Cloudflare D1
  const user = await env.DB.prepare(`
    SELECT u.id, u.username, u.email, u.role_id, r.name as role, u.is_approved, u.is_active,
           s.id as student_id, s.name as student_name, s.department as student_dept, s.year, s.semester, s.section, s.register_number,
           f.id as faculty_id, f.name as faculty_name, f.department as faculty_dept, f.employee_id
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN students s ON s.user_id = u.id
    LEFT JOIN faculty f ON f.user_id = u.id
    WHERE u.id = ?
  `).bind(decoded.id).first();

  if (!user || !user.is_active || !user.is_approved) return null;

  // Department identification with strict isolation
  user.department = user.student_dept || user.faculty_dept || 'Computer Science & Engineering';
  user.name = user.student_name || user.faculty_name || user.username;
  return user;
}

// ---------------------------------------------------------------------
// 4. Cloudflare Durable Object: RealtimeHub (WebSockets & Live Events)
// ---------------------------------------------------------------------
export class RealtimeHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // ws -> { userId, role, department }
  }

  async fetch(request) {
    const url = new URL(request.url);

    // WebSocket upgrade endpoint
    if (url.pathname === '/ws') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      server.accept();

      const token = url.searchParams.get('token');
      let userData = { userId: null, role: 'guest', department: null };

      if (token) {
        const secret = this.env.JWT_SECRET || 'super_secret_access_jwt_key_2026_cse_dept';
        const decoded = await verifyJwt(token, secret);
        if (decoded) {
          userData = {
            userId: decoded.id,
            role: decoded.role || 'student',
            department: decoded.department || null
          };
        }
      }

      this.sessions.set(server, userData);

      server.addEventListener('message', async (event) => {
        // Handle client ping
        if (event.data === 'ping') {
          server.send('pong');
        }
      });

      server.addEventListener('close', () => {
        this.sessions.delete(server);
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    // Broadcast internal endpoint
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const body = await request.json();
      const { event, payload, targetRole, targetUserId, targetDepartment } = body;
      const message = JSON.stringify({ event, data: payload });

      for (const [ws, meta] of this.sessions.entries()) {
        try {
          if (targetUserId && meta.userId !== targetUserId) continue;
          if (targetRole && meta.role !== targetRole) continue;
          if (targetDepartment && meta.department && meta.department !== targetDepartment) continue;
          ws.send(message);
        } catch (err) {
          this.sessions.delete(ws);
        }
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  }
}

// Broadcast helper for Worker routes
async function emitRealtimeEvent(env, event, payload, filters = {}) {
  try {
    if (!env.REALTIME_HUB) return;
    const id = env.REALTIME_HUB.idFromName('global_hub');
    const hub = env.REALTIME_HUB.get(id);
    await hub.fetch('http://hub/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        payload,
        targetRole: filters.targetRole,
        targetUserId: filters.targetUserId,
        targetDepartment: filters.targetDepartment
      })
    });
  } catch (e) {
    console.warn('[Realtime Hub Broadcast Warn]:', e);
  }
}

// ---------------------------------------------------------------------
// 5. Cloudflare Native Web Push Notification Helper
// ---------------------------------------------------------------------
async function sendWebPushNotification(env, userId, title, message, url = '/dashboard.html') {
  try {
    const subs = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').bind(userId).all();
    if (!subs.results || subs.results.length === 0) return;

    for (const sub of subs.results) {
      // In production, sign and post with VAPID webpush payload to sub.endpoint
      console.log(`[Web Push] Dispatched to endpoint ${sub.endpoint} for user ${userId}: "${title}"`);
    }
  } catch (e) {
    console.warn('[Web Push Dispatch Warn]:', e);
  }
}

// ---------------------------------------------------------------------
// 6. Main Cloudflare Worker Fetch Router
// ---------------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    // Handle OPTIONS Preflight CORS
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // -----------------------------------------------------------------
    // WebSocket Upgrade Handler (/ws)
    // -----------------------------------------------------------------
    if (path === '/ws') {
      if (!env.REALTIME_HUB) {
        return new Response('Durable Object REALTIME_HUB not bound', { status: 500 });
      }
      const id = env.REALTIME_HUB.idFromName('global_hub');
      const hub = env.REALTIME_HUB.get(id);
      return hub.fetch(request);
    }

    // -----------------------------------------------------------------
    // Socket.IO Client Shim (/socket.io/socket.io.js)
    // Seamless drop-in compatibility for existing frontend scripts
    // -----------------------------------------------------------------
    if (path === '/socket.io/socket.io.js') {
      const shim = `
        (function() {
          window.io = function(opts) {
            const token = opts && opts.auth ? opts.auth.token : '';
            const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = proto + '//' + location.host + '/ws?token=' + encodeURIComponent(token || '');
            let ws = new WebSocket(wsUrl);
            const listeners = {};

            function dispatch(event, data) {
              if (listeners[event]) {
                listeners[event].forEach(fn => fn(data));
              }
            }

            ws.onopen = () => { dispatch('connect', {}); };
            ws.onclose = () => { dispatch('disconnect', {}); };
            ws.onmessage = (e) => {
              try {
                const parsed = JSON.parse(e.data);
                if (parsed.event) {
                  dispatch(parsed.event, parsed.data);
                }
              } catch(err) {}
            };

            return {
              on: function(event, cb) {
                if (!listeners[event]) listeners[event] = [];
                listeners[event].push(cb);
              },
              emit: function(event, data) {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ event, data }));
                }
              },
              disconnect: function() { ws.close(); }
            };
          };
        })();
      `;
      return new Response(shim, {
        headers: { 'Content-Type': 'application/javascript; charset=utf-8', ...corsHeaders(request) }
      });
    }

    // -----------------------------------------------------------------
    // Cloudflare R2 Uploads File Streaming (/uploads/:filename)
    // -----------------------------------------------------------------
    if (path.startsWith('/uploads/')) {
      const filename = path.replace(/^\/uploads\//, '');
      if (!env.UPLOADS_BUCKET) {
        return errorResponse('Cloudflare R2 Bucket is not configured', 500, request);
      }
      const object = await env.UPLOADS_BUCKET.get(filename);
      if (!object) {
        return errorResponse('Uploaded file not found', 404, request);
      }
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=86400');
      const originHeaders = corsHeaders(request);
      for (const [k, v] of Object.entries(originHeaders)) {
        headers.set(k, v);
      }
      return new Response(object.body, { headers });
    }

    // -----------------------------------------------------------------
    // API ROUTES ROUTER
    // -----------------------------------------------------------------

    // --- Health Check ---
    if (path === '/api/health') {
      return jsonResponse({ status: 'ok', service: 'sms-cloudflare-native-worker' }, 200, request);
    }

    // --- Web Push VAPID Public Key ---
    if (path === '/api/push/vapid-public-key') {
      const publicKey = env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzk5T_Wc0r96WCETrEN3egAfKzv0cg_aapkVBQNIv58=';
      return jsonResponse({ publicKey }, 200, request);
    }

    // =================================================================
    // AUTHENTICATION API
    // =================================================================

    // Check Admin Exists (GET /api/auth/admin-exists or /api/auth/check-admin-exists)
    if ((path === '/api/auth/admin-exists' || path === '/api/auth/check-admin-exists') && method === 'GET') {
      const count = await env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE role_id = 3').first();
      return jsonResponse({ exists: (count?.count || 0) > 0 }, 200, request);
    }

    // Register (POST /api/auth/register)
    if (path === '/api/auth/register' && method === 'POST') {
      const body = await request.json();
      const { username, email, password, role, department, name, phone, registerNumber, employeeId } = body;

      if (!username || !email || !password || !role) {
        return errorResponse('All required fields must be provided.', 400, request);
      }

      // Check existing email/username
      const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ? OR email = ?').bind(username, email).first();
      if (existing) {
        return errorResponse('Username or email already registered.', 409, request);
      }

      // Role mapping: student=1, faculty=2, admin=3
      const roleRow = await env.DB.prepare('SELECT id FROM roles WHERE name = ?').bind(role.toLowerCase()).first();
      if (!roleRow) {
        return errorResponse('Invalid role requested.', 400, request);
      }
      const roleId = roleRow.id;

      // HOD initial registration behavior:
      // If role is admin and no admin exists, auto-approve immediately
      let isApproved = 0;
      if (role.toLowerCase() === 'admin') {
        const adminCheck = await env.DB.prepare('SELECT COUNT(*) as c FROM users WHERE role_id = 3').first();
        if ((adminCheck?.c || 0) === 0) {
          isApproved = 1;
        } else {
          // Check if HOD already exists for this department
          const deptHOD = await env.DB.prepare(`
            SELECT u.id FROM users u
            JOIN faculty f ON f.user_id = u.id
            WHERE u.role_id = 3 AND f.department = ?
          `).bind(department || 'Computer Science & Engineering').first();
          if (deptHOD) {
            return errorResponse(`An HOD already exists for ${department}.`, 409, request);
          }
        }
      }

      const passHash = await hashPassword(password);

      // Insert User
      const userInsert = await env.DB.prepare(`
        INSERT INTO users (username, email, password_hash, role_id, is_approved, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).bind(username, email, passHash, roleId, isApproved).run();

      const newUserId = userInsert.meta.last_row_id;

      // Insert Profile based on role
      if (role.toLowerCase() === 'student') {
        await env.DB.prepare(`
          INSERT INTO students (user_id, name, register_number, department, year, semester, section, phone)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          newUserId,
          name || username,
          registerNumber || username,
          department || 'Computer Science & Engineering',
          body.year || '1st Year',
          body.semester || 'I',
          body.section || 'A',
          phone || ''
        ).run();

        // Broadcast new registration
        await emitRealtimeEvent(env, 'NEW_STUDENT_REGISTRATION', {
          userId: newUserId,
          name: name || username,
          department: department || 'Computer Science & Engineering'
        }, { targetRole: 'admin', targetDepartment: department });

      } else if (role.toLowerCase() === 'faculty' || role.toLowerCase() === 'admin') {
        await env.DB.prepare(`
          INSERT INTO faculty (user_id, name, employee_id, designation, department, phone)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          newUserId,
          name || username,
          employeeId || username,
          body.designation || (role.toLowerCase() === 'admin' ? 'Head of Department' : 'Assistant Professor'),
          department || 'Computer Science & Engineering',
          phone || ''
        ).run();

        if (role.toLowerCase() === 'faculty') {
          await emitRealtimeEvent(env, 'NEW_FACULTY_REGISTRATION', {
            userId: newUserId,
            name: name || username,
            department: department || 'Computer Science & Engineering'
          }, { targetRole: 'admin', targetDepartment: department });
        }
      }

      return jsonResponse({
        message: isApproved ? 'Registration successful. You can now login.' : 'Registration submitted for HOD approval.',
        userId: newUserId,
        isApproved: Boolean(isApproved)
      }, 201, request);
    }

    // Login (POST /api/auth/login)
    if (path === '/api/auth/login' && method === 'POST') {
      const { username, password } = await request.json();
      if (!username || !password) {
        return errorResponse('Username and password are required.', 400, request);
      }

      const user = await env.DB.prepare(`
        SELECT u.id, u.username, u.email, u.password_hash, u.is_approved, u.is_active, r.name as role,
               s.department as student_dept, f.department as faculty_dept,
               s.name as student_name, f.name as faculty_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN students s ON s.user_id = u.id
        LEFT JOIN faculty f ON f.user_id = u.id
        WHERE u.username = ? OR u.email = ?
      `).bind(username, username).first();

      if (!user) {
        return errorResponse('Invalid username or password.', 401, request);
      }

      const passValid = await verifyPassword(password, user.password_hash);
      if (!passValid) {
        return errorResponse('Invalid username or password.', 401, request);
      }

      if (!user.is_active) {
        return errorResponse('Account is deactivated. Contact department administrator.', 403, request);
      }

      if (!user.is_approved) {
        return errorResponse('Your registration is pending approval by HOD.', 403, request);
      }

      const department = user.student_dept || user.faculty_dept || 'Computer Science & Engineering';
      const displayName = user.student_name || user.faculty_name || user.username;
      let designation = user.role === 'admin' ? 'Head of Department' : (user.role === 'faculty' ? 'Assistant Professor' : 'Student');
      let photoPath = null;
      if (user.role === 'student') {
        const s = await env.DB.prepare('SELECT photo_path FROM students WHERE user_id = ?').bind(user.id).first();
        photoPath = s?.photo_path || null;
      } else {
        const f = await env.DB.prepare('SELECT designation, photo_path FROM faculty WHERE user_id = ?').bind(user.id).first();
        if (f?.designation) designation = f.designation;
        photoPath = f?.photo_path || null;
      }

      const secret = env.JWT_SECRET || 'super_secret_access_jwt_key_2026_cse_dept';
      const token = await signJwt({
        id: user.id,
        username: user.username,
        role: user.role,
        department: department
      }, secret, 86400);

      const userObj = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        name: displayName,
        department: department,
        designation: designation,
        photoPath: photoPath
      };

      return jsonResponse({
        token,
        accessToken: token,
        user: userObj
      }, 200, request);
    }

    // Profile (GET & PUT /api/auth/profile)
    if (path === '/api/auth/profile') {
      const user = await getAuthenticatedUser(request, env);
      if (!user) return errorResponse('Unauthorized', 401, request);

      if (method === 'GET') {
        let details = null;
        if (user.role === 'student') {
          details = await env.DB.prepare('SELECT * FROM students WHERE user_id = ?').bind(user.id).first();
        } else {
          details = await env.DB.prepare('SELECT * FROM faculty WHERE user_id = ?').bind(user.id).first();
        }

        const merged = {
          user: user,
          profile: details,
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          name: details?.name || user.name || user.username,
          department: details?.department || user.department,
          phone: details?.phone || '',
          photoPath: details?.photo_path || null,
          designation: details?.designation || (user.role === 'admin' ? 'Head of Department' : (user.role === 'faculty' ? 'Assistant Professor' : 'Student')),
          employeeId: details?.employee_id || user.username,
          registerNumber: details?.register_number || user.username,
          qualification: details?.qualification || '',
          researchArea: details?.research_area || '',
          publications: details?.publications || '',
          address: details?.address || '',
          course: details?.course || 'B.E',
          branch: details?.branch || 'Computer Science & Engineering',
          year: details?.year || '',
          semester: details?.semester || '',
          section: details?.section || 'A'
        };
        return jsonResponse(merged, 200, request);
      }

      if (method === 'PUT') {
        const body = await request.json();
        if (user.role === 'student') {
          await env.DB.prepare(`
            UPDATE students SET
              phone = COALESCE(?, phone),
              address = COALESCE(?, address),
              guardian_name = COALESCE(?, guardian_name),
              guardian_phone = COALESCE(?, guardian_phone),
              blood_group = COALESCE(?, blood_group)
            WHERE user_id = ?
          `).bind(body.phone ?? null, body.address ?? null, body.guardianName ?? null, body.guardianPhone ?? null, body.bloodGroup ?? null, user.id).run();
        } else {
          await env.DB.prepare(`
            UPDATE faculty SET
              phone = COALESCE(?, phone),
              qualification = COALESCE(?, qualification),
              research_area = COALESCE(?, research_area),
              publications = COALESCE(?, publications)
            WHERE user_id = ?
          `).bind(body.phone ?? null, body.qualification ?? null, body.researchArea ?? null, body.publications ?? null, user.id).run();
        }
        return jsonResponse({ message: 'Profile updated successfully.' }, 200, request);
      }
    }

    // Profile Photo Upload (POST /api/auth/profile/photo)
    if (path === '/api/auth/profile/photo' && method === 'POST') {
      const user = await getAuthenticatedUser(request, env);
      if (!user) return errorResponse('Unauthorized', 401, request);

      const formData = await request.formData();
      const file = formData.get('photo');
      if (!file || typeof file === 'string') {
        return errorResponse('No image file uploaded.', 400, request);
      }

      const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')) : '.jpg';
      const key = `profile-${user.id}-${Date.now()}${ext}`;

      if (env.UPLOADS_BUCKET) {
        await env.UPLOADS_BUCKET.put(key, file.stream(), {
          httpMetadata: { contentType: file.type || 'image/jpeg' }
        });
      }

      const photoUrl = `/uploads/${key}`;

      if (user.role === 'student') {
        await env.DB.prepare('UPDATE students SET photo_path = ? WHERE user_id = ?').bind(photoUrl, user.id).run();
      } else {
        await env.DB.prepare('UPDATE faculty SET photo_path = ? WHERE user_id = ?').bind(photoUrl, user.id).run();
      }

      return jsonResponse({ message: 'Profile photo updated.', photoUrl }, 200, request);
    }

    // Change Password (POST /api/auth/change-password)
    if (path === '/api/auth/change-password' && method === 'POST') {
      const user = await getAuthenticatedUser(request, env);
      if (!user) return errorResponse('Unauthorized', 401, request);

      const { currentPassword, newPassword } = await request.json();
      const userRow = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first();
      const valid = await verifyPassword(currentPassword, userRow.password_hash);
      if (!valid) {
        return errorResponse('Current password is incorrect.', 400, request);
      }

      const newHash = await hashPassword(newPassword);
      await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, user.id).run();
      return jsonResponse({ message: 'Password changed successfully.' }, 200, request);
    }

    // Pending Registrations & Approvals (HOD Only)
    if (
      (path === '/api/auth/registrations/pending' || path === '/api/admin/pending-registrations' || path === '/api/admin/pending-faculty-registrations') &&
      method === 'GET'
    ) {
      const user = await getAuthenticatedUser(request, env);
      if (!user || user.role !== 'admin') return errorResponse('Forbidden: Admin only', 403, request);

      const pendingUsers = await env.DB.prepare(`
        SELECT u.id, u.username, u.email, u.created_at, r.name as role,
               s.name as student_name, s.register_number, s.department as student_dept, s.year, s.semester, s.section,
               f.name as faculty_name, f.employee_id, f.department as faculty_dept, f.designation
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN students s ON s.user_id = u.id
        LEFT JOIN faculty f ON f.user_id = u.id
        WHERE u.is_approved = 0
          AND (s.department = ? OR f.department = ? OR s.department IS NULL)
        ORDER BY u.created_at DESC
      `).bind(user.department, user.department).all();

      const students = [];
      const faculty = [];

      for (const row of pendingUsers.results || []) {
        if (row.role === 'student') {
          students.push({
            id: row.id,
            username: row.username,
            email: row.email,
            name: row.student_name,
            registerNumber: row.register_number,
            department: row.student_dept,
            year: row.year,
            semester: row.semester,
            section: row.section,
            createdAt: row.created_at
          });
        } else if (row.role === 'faculty') {
          faculty.push({
            id: row.id,
            username: row.username,
            email: row.email,
            name: row.faculty_name,
            employeeId: row.employee_id,
            department: row.faculty_dept,
            designation: row.designation,
            createdAt: row.created_at
          });
        }
      }

      return jsonResponse({ students, faculty, totalPending: students.length + faculty.length }, 200, request);
    }

    // Approve Registration
    const approveMatch = path.match(/^\/api\/(auth\/registrations|admin|admin\/faculty-registrations)\/(\d+)\/approve$/) ||
                         path.match(/^\/api\/admin\/approve-user\/(\d+)$/);
    if (approveMatch && method === 'POST') {
      const user = await getAuthenticatedUser(request, env);
      if (!user || user.role !== 'admin') return errorResponse('Forbidden: Admin only', 403, request);

      const targetId = approveMatch[approveMatch.length - 1];
      await env.DB.prepare('UPDATE users SET is_approved = 1 WHERE id = ?').bind(targetId).run();

      await emitRealtimeEvent(env, 'REGISTRATION_APPROVED', { userId: targetId });
      await emitRealtimeEvent(env, 'REGISTRATION_LIST_CHANGED', {});

      return jsonResponse({ message: 'User registration approved successfully.' }, 200, request);
    }

    // Reject Registration
    const rejectMatch = path.match(/^\/api\/(auth\/registrations|admin|admin\/faculty-registrations)\/(\d+)\/reject$/) ||
                        path.match(/^\/api\/admin\/reject-user\/(\d+)$/);
    if (rejectMatch && method === 'POST') {
      const user = await getAuthenticatedUser(request, env);
      if (!user || user.role !== 'admin') return errorResponse('Forbidden: Admin only', 403, request);

      const targetId = rejectMatch[rejectMatch.length - 1];
      await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run();

      await emitRealtimeEvent(env, 'REGISTRATION_REJECTED', { userId: targetId });
      await emitRealtimeEvent(env, 'REGISTRATION_LIST_CHANGED', {});

      return jsonResponse({ message: 'User registration rejected and deleted.' }, 200, request);
    }

    // =================================================================
    // STUDENTS API (/api/students)
    // =================================================================
    if (path.startsWith('/api/students')) {
      const user = await getAuthenticatedUser(request, env);
      if (!user) return errorResponse('Unauthorized', 401, request);

      // GET /api/students
      if (path === '/api/students' && method === 'GET') {
        const queryDept = user.department;
        const students = await env.DB.prepare(`
          SELECT s.*, u.email, u.username
          FROM students s
          JOIN users u ON s.user_id = u.id
          WHERE s.department = ?
          ORDER BY s.register_number ASC
        `).bind(queryDept).all();
        return jsonResponse(students.results || [], 200, request);
      }

      // Single Student GET / PUT / DELETE
      const idMatch = path.match(/^\/api\/students\/(\d+)$/);
      if (idMatch) {
        const studentId = idMatch[1];

        if (method === 'GET') {
          const student = await env.DB.prepare(`
            SELECT s.*, u.email, u.username
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = ? OR s.user_id = ?
          `).bind(studentId, studentId).first();
          if (!student) return errorResponse('Student not found', 404, request);
          return jsonResponse(student, 200, request);
        }

        if (method === 'PUT') {
          const body = await request.json();
          await env.DB.prepare(`
            UPDATE students SET
              name = COALESCE(?, name),
              phone = COALESCE(?, phone),
              year = COALESCE(?, year),
              semester = COALESCE(?, semester),
              section = COALESCE(?, section)
            WHERE id = ?
          `).bind(body.name ?? null, body.phone ?? null, body.year ?? null, body.semester ?? null, body.section ?? null, studentId).run();
          return jsonResponse({ message: 'Student updated successfully.' }, 200, request);
        }

        if (method === 'DELETE' && user.role === 'admin') {
          await env.DB.prepare(`
            DELETE FROM users WHERE id IN (SELECT user_id FROM students WHERE id = ?)
          `).bind(studentId).run();
          return jsonResponse({ message: 'Student removed successfully.' }, 200, request);
        }
      }
    }

    // =================================================================
    // FACULTY API (/api/faculty)
    // =================================================================
    if (path.startsWith('/api/faculty')) {
      const user = await getAuthenticatedUser(request, env);
      if (!user) return errorResponse('Unauthorized', 401, request);

      // GET /api/faculty
      if (path === '/api/faculty' && method === 'GET') {
        const facultyList = await env.DB.prepare(`
          SELECT f.*, u.email, u.username
          FROM faculty f
          JOIN users u ON f.user_id = u.id
          WHERE f.department = ?
          ORDER BY f.name ASC
        `).bind(user.department).all();
        return jsonResponse(facultyList.results || [], 200, request);
      }

      const idMatch = path.match(/^\/api\/faculty\/(\d+)$/);
      if (idMatch) {
        const facultyId = idMatch[1];
        if (method === 'GET') {
          const item = await env.DB.prepare(`
            SELECT f.*, u.email, u.username
            FROM faculty f
            JOIN users u ON f.user_id = u.id
            WHERE f.id = ? OR f.user_id = ?
          `).bind(facultyId, facultyId).first();
          if (!item) return errorResponse('Faculty not found', 404, request);
          return jsonResponse(item, 200, request);
        }

        if (method === 'DELETE' && user.role === 'admin') {
          await env.DB.prepare(`
            DELETE FROM users WHERE id IN (SELECT user_id FROM faculty WHERE id = ?)
          `).bind(facultyId).run();
          return jsonResponse({ message: 'Faculty deleted successfully.' }, 200, request);
        }
      }
    }

    // =================================================================
    // SUBJECTS API (/api/subjects)
    // =================================================================
    if (path.startsWith('/api/subjects')) {
      const user = await getAuthenticatedUser(request, env);
      if (!user) return errorResponse('Unauthorized', 401, request);

      // GET /api/subjects/my-subjects (Faculty)
      if (path === '/api/subjects/my-subjects' && method === 'GET') {
        const list = await env.DB.prepare(`
          SELECT s.*, f.name as faculty_name
          FROM subjects s
          JOIN faculty f ON s.faculty_id = f.id
          WHERE f.user_id = ?
        `).bind(user.id).all();
        return jsonResponse(list.results || [], 200, request);
      }

      // GET /api/subjects
      if (path === '/api/subjects' && method === 'GET') {
        const list = await env.DB.prepare(`
          SELECT s.*, f.name as faculty_name, f.employee_id
          FROM subjects s
          LEFT JOIN faculty f ON s.faculty_id = f.id
          WHERE s.department = ?
          ORDER BY s.semester ASC, s.code ASC
        `).bind(user.department).all();
        return jsonResponse(list.results || [], 200, request);
      }

      // POST /api/subjects (HOD Only)
      if (path === '/api/subjects' && method === 'POST') {
        if (user.role !== 'admin') return errorResponse('Forbidden', 403, request);
        const { code, name, credits, semester, section, facultyId } = await request.json();

        await env.DB.prepare(`
          INSERT INTO subjects (code, name, credits, semester, section, department, faculty_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(code, name, credits || 3, semester, section || 'A', user.department, facultyId || null).run();

        return jsonResponse({ message: 'Subject added successfully.' }, 201, request);
      }

      // PUT & DELETE /api/subjects/:id
      const idMatch = path.match(/^\/api\/subjects\/(\d+)$/);
      if (idMatch && user.role === 'admin') {
        const subId = idMatch[1];
        if (method === 'PUT') {
          const body = await request.json();
          await env.DB.prepare(`
            UPDATE subjects SET
              code = COALESCE(?, code),
              name = COALESCE(?, name),
              credits = COALESCE(?, credits),
              semester = COALESCE(?, semester),
              section = COALESCE(?, section),
              faculty_id = ?
            WHERE id = ?
          `).bind(body.code, body.name, body.credits, body.semester, body.section, body.facultyId || null, subId).run();
          return jsonResponse({ message: 'Subject updated successfully.' }, 200, request);
        }

        if (method === 'DELETE') {
          await env.DB.prepare('DELETE FROM subjects WHERE id = ?').bind(subId).run();
          return jsonResponse({ message: 'Subject deleted successfully.' }, 200, request);
        }
      }
    }

    // =================================================================
    // CLASS INCHARGE API (/api/class-incharges & /api/admin/class-incharges)
    // =================================================================
    if (path.includes('class-incharge') || path.includes('class-incharges')) {
      const user = await getAuthenticatedUser(request, env);
      if (!user) return errorResponse('Unauthorized', 401, request);

      // GET all assignments
      if ((path === '/api/class-incharges' || path === '/api/admin/class-incharges') && method === 'GET') {
        const list = await env.DB.prepare(`
          SELECT ci.*, f.name as faculty_name, f.employee_id
          FROM class_incharges ci
          JOIN faculty f ON ci.faculty_id = f.id
          WHERE ci.department = ?
          ORDER BY ci.year ASC, ci.section ASC
        `).bind(user.department).all();
        return jsonResponse(list.results || [], 200, request);
      }

      // Assign Class Incharge (POST /api/class-incharges/assign)
      if (path.endsWith('/assign') && method === 'POST') {
        if (user.role !== 'admin') return errorResponse('Forbidden: Admin only', 403, request);
        const { facultyId, year, semester, section } = await request.json();

        // Replace or insert assignment
        await env.DB.prepare(`
          INSERT INTO class_incharges (faculty_id, department, year, semester, section)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(department, year, semester, section) DO UPDATE SET faculty_id = excluded.faculty_id
        `).bind(facultyId, user.department, year, semester, section).run();

        await emitRealtimeEvent(env, 'CLASS_INCHARGE_ASSIGNED', { facultyId, year, semester, section });
        return jsonResponse({ message: 'Class Incharge assigned successfully.' }, 200, request);
      }

      // Remove Class Incharge (POST /api/class-incharges/remove)
      if (path.endsWith('/remove') && method === 'POST') {
        if (user.role !== 'admin') return errorResponse('Forbidden: Admin only', 403, request);
        const { id, year, semester, section } = await request.json();
        if (id) {
          await env.DB.prepare('DELETE FROM class_incharges WHERE id = ?').bind(id).run();
        } else {
          await env.DB.prepare('DELETE FROM class_incharges WHERE department = ? AND year = ? AND semester = ? AND section = ?')
            .bind(user.department, year, semester, section).run();
        }
        return jsonResponse({ message: 'Class Incharge assignment removed.' }, 200, request);
      }

      // Faculty's my assignments
      if (path.endsWith('/my-assignments') && method === 'GET') {
        const list = await env.DB.prepare(`
          SELECT ci.*
          FROM class_incharges ci
          JOIN faculty f ON ci.faculty_id = f.id
          WHERE f.user_id = ?
        `).bind(user.id).all();
        return jsonResponse(list.results || [], 200, request);
      }
    }

    // =================================================================
    // ATTENDANCE API (/api/attendance)
    // =================================================================
    if (path.startsWith('/api/attendance')) {
      const user = await getAuthenticatedUser(request, env);
      if (!user) return errorResponse('Unauthorized', 401, request);

      // GET /api/attendance/my-classes (Assigned sections for Class Incharge)
      if (path === '/api/attendance/my-classes' && method === 'GET') {
        const classes = await env.DB.prepare(`
          SELECT ci.year, ci.semester, ci.section, ci.department
          FROM class_incharges ci
          JOIN faculty f ON ci.faculty_id = f.id
          WHERE f.user_id = ?
        `).bind(user.id).all();
        return jsonResponse(classes.results || [], 200, request);
      }

      // GET /api/attendance/daily-checklist
      if (path === '/api/attendance/daily-checklist' && method === 'GET') {
        const year = url.searchParams.get('year') || '3rd Year';
        const semester = url.searchParams.get('semester') || 'V';
        const section = url.searchParams.get('section') || 'A';
        const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

        // Load all students in the assigned class
        const students = await env.DB.prepare(`
          SELECT s.id, s.name, s.register_number, s.photo_path,
                 COALESCE(ar.status, 'Present') as attendance_status,
                 ar.remarks
          FROM students s
          LEFT JOIN attendance_sessions ses ON ses.department = s.department
                                           AND ses.year = s.year
                                           AND ses.semester = s.semester
                                           AND ses.section = s.section
                                           AND ses.date = ?
          LEFT JOIN attendance_records ar ON ar.session_id = ses.id AND ar.student_id = s.id
          WHERE s.department = ? AND s.year = ? AND s.semester = ? AND s.section = ?
          ORDER BY s.register_number ASC
        `).bind(date, user.department, year, semester, section).all();

        return jsonResponse({ date, students: students.results || [] }, 200, request);
      }

      // POST /api/attendance/daily (Strictly assigned Class Incharge ONLY)
      if (path === '/api/attendance/daily' && method === 'POST') {
        if (user.role !== 'faculty') return errorResponse('Forbidden: Faculty only', 403, request);
        const { year, semester, section, date, records } = await request.json();

        // Verify that this faculty is indeed the assigned Class Incharge
        const incharge = await env.DB.prepare(`
          SELECT ci.id, f.id as faculty_id
          FROM class_incharges ci
          JOIN faculty f ON ci.faculty_id = f.id
          WHERE f.user_id = ? AND ci.department = ? AND ci.year = ? AND ci.semester = ? AND ci.section = ?
        `).bind(user.id, user.department, year, semester, section).first();

        if (!incharge) {
          return errorResponse('Permission Denied: Only the designated Class Incharge can mark daily attendance.', 403, request);
        }

        // Create or get session
        let session = await env.DB.prepare(`
          SELECT id FROM attendance_sessions
          WHERE department = ? AND year = ? AND semester = ? AND section = ? AND date = ?
        `).bind(user.department, year, semester, section, date).first();

        let sessionId;
        if (!session) {
          const insertSession = await env.DB.prepare(`
            INSERT INTO attendance_sessions (faculty_id, department, year, semester, section, date)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(incharge.faculty_id, user.department, year, semester, section, date).run();
          sessionId = insertSession.meta.last_row_id;
        } else {
          sessionId = session.id;
        }

        // Batch upsert attendance records
        if (Array.isArray(records)) {
          for (const rec of records) {
            await env.DB.prepare(`
              INSERT INTO attendance_records (session_id, student_id, status, remarks)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(session_id, student_id) DO UPDATE SET status = excluded.status, remarks = excluded.remarks
            `).bind(sessionId, rec.studentId, rec.status, rec.remarks || '').run();
          }
        }

        await emitRealtimeEvent(env, 'ATTENDANCE_RECORDED', { year, semester, section, date });
        return jsonResponse({ message: 'Attendance recorded successfully.', sessionId }, 200, request);
      }

      // GET /api/attendance/history
      if (path === '/api/attendance/history' && method === 'GET') {
        if (user.role === 'student') {
          const records = await env.DB.prepare(`
            SELECT ses.date, ar.status, ar.remarks
            FROM attendance_records ar
            JOIN attendance_sessions ses ON ar.session_id = ses.id
            JOIN students s ON ar.student_id = s.id
            WHERE s.user_id = ?
            ORDER BY ses.date DESC
          `).bind(user.id).all();
          return jsonResponse(records.results || [], 200, request);
        }

        const history = await env.DB.prepare(`
          SELECT ses.*, f.name as marked_by,
                 COUNT(ar.id) as total_students,
                 SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END) as present_count,
                 SUM(CASE WHEN ar.status = 'Absent' THEN 1 ELSE 0 END) as absent_count
          FROM attendance_sessions ses
          JOIN faculty f ON ses.faculty_id = f.id
          LEFT JOIN attendance_records ar ON ar.session_id = ses.id
          WHERE ses.department = ?
          GROUP BY ses.id
          ORDER BY ses.date DESC
        `).bind(user.department).all();

        return jsonResponse(history.results || [], 200, request);
      }
    }

    // =================================================================
    // INTERNAL MARKS API (/api/marks)
    // =================================================================
    if (path.startsWith('/api/marks')) {
      const user = await getAuthenticatedUser(request, env);
      if (!user) return errorResponse('Unauthorized', 401, request);

      // GET /api/marks/roster (Faculty)
      if (path === '/api/marks/roster' && method === 'GET') {
        const subjectId = url.searchParams.get('subjectId');
        const markType = url.searchParams.get('markType') || 'CIA-1';

        const subject = await env.DB.prepare('SELECT * FROM subjects WHERE id = ?').bind(subjectId).first();
        if (!subject) return errorResponse('Subject not found', 404, request);

        const students = await env.DB.prepare(`
          SELECT s.id as student_id, s.name, s.register_number,
                 COALESCE(im.score, '') as score,
                 COALESCE(im.max_marks, 100) as max_marks,
                 COALESCE(im.is_published, 0) as is_published
          FROM students s
          LEFT JOIN internal_marks im ON im.student_id = s.id AND im.subject_id = ? AND im.mark_type = ?
          WHERE s.department = ? AND s.semester = ? AND s.section = ?
          ORDER BY s.register_number ASC
        `).bind(subjectId, markType, subject.department, subject.semester, subject.section).all();

        return jsonResponse({ subject, students: students.results || [] }, 200, request);
      }

      // POST /api/marks/save (Faculty)
      if (path === '/api/marks/save' && method === 'POST') {
        const { subjectId, markType, maxMarks, isPublished, marks } = await request.json();

        if (Array.isArray(marks)) {
          for (const m of marks) {
            await env.DB.prepare(`
              INSERT INTO internal_marks (student_id, subject_id, mark_type, score, max_marks, is_published)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(student_id, subject_id, mark_type) DO UPDATE SET
                score = excluded.score,
                max_marks = excluded.max_marks,
                is_published = excluded.is_published
            `).bind(m.studentId, subjectId, markType || 'CIA-1', parseFloat(m.score) || 0, maxMarks || 100, isPublished ? 1 : 0).run();
          }
        }

        if (isPublished) {
          await emitRealtimeEvent(env, 'MARKS_PUBLISHED', { subjectId, markType });
        }

        return jsonResponse({ message: 'Internal marks saved successfully.' }, 200, request);
      }

      // GET /api/marks/grades (Student)
      if (path === '/api/marks/grades' && method === 'GET') {
        const student = await env.DB.prepare('SELECT * FROM students WHERE user_id = ?').bind(user.id).first();
        if (!student) return errorResponse('Student not found', 404, request);

        const grades = await env.DB.prepare(`
          SELECT s.id as subject_id, s.code, s.name as subject_name,
                 im.mark_type, im.score, im.max_marks, im.is_published
          FROM subjects s
          LEFT JOIN internal_marks im ON im.subject_id = s.id AND im.student_id = ?
          WHERE s.department = ? AND s.semester = ? AND s.section = ?
        `).bind(student.id, student.department, student.semester, student.section).all();

        // Transform results: if not published, show score as null / "Not Yet Updated"
        const formatted = (grades.results || []).map(g => ({
          subjectId: g.subject_id,
          code: g.code,
          subjectName: g.subject_name,
          markType: g.mark_type || 'CIA-1',
          score: g.is_published ? g.score : null,
          maxMarks: g.max_marks || 100,
          statusText: g.is_published ? `${g.score}/${g.max_marks}` : 'Not Yet Updated'
        }));

        return jsonResponse(formatted, 200, request);
      }

      // GET /api/marks/logs (Admin Audit)
      if (path === '/api/marks/logs' && method === 'GET') {
        const logs = await env.DB.prepare(`
          SELECT im.*, s.name as student_name, s.register_number, sub.name as subject_name, sub.code as subject_code
          FROM internal_marks im
          JOIN students s ON im.student_id = s.id
          JOIN subjects sub ON im.subject_id = sub.id
          WHERE s.department = ?
          ORDER BY im.updated_at DESC LIMIT 100
        `).bind(user.department).all();
        return jsonResponse(logs.results || [], 200, request);
      }
    }

    // =================================================================
    // LEAVES API (/api/leaves & /api/admin/leaves)
    // Two-stage workflow: Student -> Class Incharge -> HOD -> Approved
    // =================================================================
    if (path.startsWith('/api/leaves') || path.startsWith('/api/admin/leaves')) {
      const user = await getAuthenticatedUser(request, env);
      if (!user) return errorResponse('Unauthorized', 401, request);

      // Student Apply Leave (POST /api/leaves or /api/leaves/apply)
      if ((path === '/api/leaves' || path === '/api/leaves/apply') && method === 'POST') {
        if (user.role !== 'student') return errorResponse('Only students can apply for leave', 403, request);

        let leaveType, fromDate, toDate, totalDays, reason, supportingDocUrl = null;

        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('multipart/form-data')) {
          const form = await request.formData();
          leaveType = form.get('leaveType');
          fromDate = form.get('fromDate');
          toDate = form.get('toDate');
          totalDays = parseInt(form.get('totalDays') || '1');
          reason = form.get('reason');

          const doc = form.get('supportingDocument');
          if (doc && typeof doc !== 'string') {
            const ext = doc.name ? doc.name.substring(doc.name.lastIndexOf('.')) : '.pdf';
            const key = `doc-${user.id}-${Date.now()}${ext}`;
            if (env.UPLOADS_BUCKET) {
              await env.UPLOADS_BUCKET.put(key, doc.stream(), {
                httpMetadata: { contentType: doc.type || 'application/pdf' }
              });
              supportingDocUrl = `/uploads/${key}`;
            }
          }
        } else {
          const body = await request.json();
          leaveType = body.leaveType;
          fromDate = body.fromDate;
          toDate = body.toDate;
          totalDays = parseInt(body.totalDays || '1');
          reason = body.reason;
        }

        const student = await env.DB.prepare('SELECT id FROM students WHERE user_id = ?').bind(user.id).first();
        if (!student) return errorResponse('Student record not found', 404, request);

        const ins = await env.DB.prepare(`
          INSERT INTO leave_requests (student_id, leave_type, from_date, to_date, total_days, reason, status, supporting_document)
          VALUES (?, ?, ?, ?, ?, ?, 'PENDING_CLASS_INCHARGE', ?)
        `).bind(student.id, leaveType, fromDate, toDate, totalDays, reason, supportingDocUrl).run();

        const leaveId = ins.meta.last_row_id;

        await emitRealtimeEvent(env, 'LEAVE_REQUEST_CREATED', { leaveId, studentId: student.id, department: user.department });
        return jsonResponse({ message: 'Leave request submitted successfully.', leaveId }, 201, request);
      }

      // GET Leave Requests (/api/leaves/requests or /api/admin/leaves or /api/leaves/my)
      if (
        (path === '/api/leaves/requests' || path === '/api/admin/leaves' || path === '/api/leaves') &&
        method === 'GET'
      ) {
        if (user.role === 'student' || path === '/api/leaves/my') {
          const list = await env.DB.prepare(`
            SELECT lr.*, s.name as student_name, s.register_number
            FROM leave_requests lr
            JOIN students s ON lr.student_id = s.id
            WHERE s.user_id = ?
            ORDER BY lr.created_at DESC
          `).bind(user.id).all();
          return jsonResponse(list.results || [], 200, request);
        }

        // Faculty sees Stage 1 (PENDING_CLASS_INCHARGE) for their assigned classes
        if (user.role === 'faculty') {
          const requests = await env.DB.prepare(`
            SELECT lr.*, s.name as student_name, s.register_number, s.year, s.semester, s.section
            FROM leave_requests lr
            JOIN students s ON lr.student_id = s.id
            JOIN class_incharges ci ON ci.department = s.department AND ci.year = s.year AND ci.semester = s.semester AND ci.section = s.section
            JOIN faculty f ON ci.faculty_id = f.id
            WHERE f.user_id = ?
            ORDER BY lr.created_at DESC
          `).bind(user.id).all();
          return jsonResponse(requests.results || [], 200, request);
        }

        // HOD sees department requests (Stage 2: PENDING_HOD or full history)
        if (user.role === 'admin') {
          const requests = await env.DB.prepare(`
            SELECT lr.*, s.name as student_name, s.register_number, s.year, s.semester, s.section
            FROM leave_requests lr
            JOIN students s ON lr.student_id = s.id
            WHERE s.department = ?
            ORDER BY lr.created_at DESC
          `).bind(user.department).all();
          return jsonResponse(requests.results || [], 200, request);
        }
      }

      // Stage 1 & Stage 2 Approval Handler (PUT / POST /api/leaves/:id/approve)
      const approveMatch = path.match(/^\/api\/(leaves|admin\/leaves)\/(\d+)\/approve$/);
      if (approveMatch && (method === 'PUT' || method === 'POST')) {
        const leaveId = approveMatch[2];
        const leave = await env.DB.prepare('SELECT * FROM leave_requests WHERE id = ?').bind(leaveId).first();
        if (!leave) return errorResponse('Leave request not found', 404, request);

        let nextStatus = 'APPROVED';
        if (user.role === 'faculty') {
          if (leave.status !== 'PENDING_CLASS_INCHARGE') {
            return errorResponse('Leave request is not in Class Incharge review stage', 400, request);
          }
          nextStatus = 'PENDING_HOD';
        } else if (user.role === 'admin') {
          nextStatus = 'APPROVED';
        }

        await env.DB.prepare(`
          UPDATE leave_requests SET status = ?, processed_by = ? WHERE id = ?
        `).bind(nextStatus, user.id, leaveId).run();

        await emitRealtimeEvent(env, 'LEAVE_REQUEST_APPROVED', { leaveId, nextStatus });
        return jsonResponse({ message: `Leave request updated to ${nextStatus}.`, status: nextStatus }, 200, request);
      }

      // Rejection Handler (PUT / POST /api/leaves/:id/reject)
      const rejectMatch = path.match(/^\/api\/(leaves|admin\/leaves)\/(\d+)\/reject$/);
      if (rejectMatch && (method === 'PUT' || method === 'POST')) {
        const leaveId = rejectMatch[2];
        const { remarks } = await request.json().catch(() => ({}));
        const rejectStatus = user.role === 'admin' ? 'REJECTED_BY_HOD' : 'REJECTED_BY_CLASS_INCHARGE';

        await env.DB.prepare(`
          UPDATE leave_requests SET status = ?, processed_by = ?, remarks = ? WHERE id = ?
        `).bind(rejectStatus, user.id, remarks || 'Rejected', leaveId).run();

        await emitRealtimeEvent(env, 'LEAVE_REQUEST_REJECTED', { leaveId, status: rejectStatus });
        return jsonResponse({ message: 'Leave request rejected.', status: rejectStatus }, 200, request);
      }
    }

    // =================================================================
    // ANNOUNCEMENTS API (/api/announcements)
    // =================================================================
    if (path.startsWith('/api/announcements')) {
      const user = await getAuthenticatedUser(request, env);
      if (!user) return errorResponse('Unauthorized', 401, request);

      // GET /api/announcements
      if (path === '/api/announcements' && method === 'GET') {
        const list = await env.DB.prepare(`
          SELECT a.*, u.username as posted_by_name
          FROM announcements a
          LEFT JOIN users u ON a.posted_by = u.id
          WHERE a.target_department = 'all' OR a.target_department = ?
          ORDER BY a.created_at DESC
        `).bind(user.department).all();
        return jsonResponse(list.results || [], 200, request);
      }

      // POST /api/announcements/create (Admin/Faculty)
      if (path === '/api/announcements/create' && method === 'POST') {
        if (user.role !== 'admin' && user.role !== 'faculty') return errorResponse('Forbidden', 403, request);
        const { title, content, category, targetDepartment, targetYear, targetSemester, targetSection } = await request.json();

        const ins = await env.DB.prepare(`
          INSERT INTO announcements (title, content, category, posted_by, target_department, target_year, target_semester, target_section)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          title,
          content,
          category || 'Academic',
          user.id,
          targetDepartment || user.department,
          targetYear || 'all',
          targetSemester || 'all',
          targetSection || 'all'
        ).run();

        await emitRealtimeEvent(env, 'ANNOUNCEMENT_PUBLISHED', { id: ins.meta.last_row_id, title });
        return jsonResponse({ message: 'Announcement published successfully.' }, 201, request);
      }

      // DELETE /api/announcements/:id
      const idMatch = path.match(/^\/api\/announcements\/(\d+)$/);
      if (idMatch && method === 'DELETE') {
        if (user.role !== 'admin') return errorResponse('Forbidden: Admin only', 403, request);
        await env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(idMatch[1]).run();
        return jsonResponse({ message: 'Announcement deleted.' }, 200, request);
      }
    }

    // =================================================================
    // NOTIFICATIONS API (/api/notifications)
    // =================================================================
    if (path.startsWith('/api/notifications')) {
      const user = await getAuthenticatedUser(request, env);
      if (!user) return errorResponse('Unauthorized', 401, request);

      // GET /api/notifications
      if (path === '/api/notifications' && method === 'GET') {
        const notifs = await env.DB.prepare(`
          SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
        `).bind(user.id).all();
        return jsonResponse(notifs.results || [], 200, request);
      }

      // PUT /api/notifications/read-all
      if (path === '/api/notifications/read-all' && method === 'PUT') {
        await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').bind(user.id).run();
        return jsonResponse({ message: 'All notifications marked as read.' }, 200, request);
      }

      // PUT /api/notifications/:id/read
      const idMatch = path.match(/^\/api\/notifications\/(\d+)\/read$/);
      if (idMatch && method === 'PUT') {
        await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').bind(idMatch[1], user.id).run();
        return jsonResponse({ message: 'Notification marked as read.' }, 200, request);
      }
    }

    // =================================================================
    // DASHBOARD STATS API (/api/dashboard/stats & /api/dashboard/timetable)
    // =================================================================
    if (path === '/api/dashboard/stats' && method === 'GET') {
      const user = await getAuthenticatedUser(request, env);
      if (!user) return errorResponse('Unauthorized', 401, request);

      const dept = user.department || 'Computer Science & Engineering';

      // 1. Department-isolated total student count (approved)
      const studentCount = await env.DB.prepare(`
        SELECT COUNT(*) as c FROM students s
        JOIN users u ON s.user_id = u.id
        WHERE u.is_approved = 1 AND s.department = ?
      `).bind(dept).first();

      // 2. Department-isolated total faculty count (approved)
      const facultyCount = await env.DB.prepare(`
        SELECT COUNT(*) as c FROM faculty f
        JOIN users u ON f.user_id = u.id
        WHERE u.is_approved = 1 AND f.department = ?
      `).bind(dept).first();

      // 3. Department-isolated subject count
      const subjectCount = await env.DB.prepare('SELECT COUNT(*) as c FROM subjects WHERE department = ?').bind(dept).first();

      // 4. Department-isolated pending leaves count
      const pendingLeavesCount = await env.DB.prepare(`
        SELECT COUNT(*) as c FROM leave_requests lr
        JOIN students s ON lr.student_id = s.id
        WHERE (lr.status = 'Pending' OR lr.status = 'PENDING_HOD' OR lr.status = 'PENDING_CLASS_INCHARGE')
          AND s.department = ?
      `).bind(dept).first();

      // 5. Department-isolated pending registrations count
      const pendingRegCount = await env.DB.prepare(`
        SELECT COUNT(*) as c FROM users u
        LEFT JOIN students s ON s.user_id = u.id
        LEFT JOIN faculty f ON f.user_id = u.id
        WHERE u.is_approved = 0 AND (s.department = ? OR f.department = ? OR (s.department IS NULL AND f.department IS NULL))
      `).bind(dept, dept).first();

      // 6. Department-isolated attendance percentage
      const attStats = await env.DB.prepare(`
        SELECT COUNT(*) as total, SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END) as present
        FROM attendance_records ar
        JOIN students s ON ar.student_id = s.id
        WHERE s.department = ?
      `).bind(dept).first();

      const attTotal = attStats?.total || 0;
      const attPresent = attStats?.present || 0;
      const attendancePercentage = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0;

      // Role-specific stats & metadata
      let isClassIncharge = false;
      let inchargeAssignments = [];
      let userRoleStats = {};
      let photoPath = null;
      let designation = user.role === 'admin' ? 'Head of Department' : (user.role === 'faculty' ? 'Assistant Professor' : 'Student');

      if (user.role === 'admin') {
        const f = await env.DB.prepare('SELECT designation, photo_path FROM faculty WHERE user_id = ?').bind(user.id).first();
        if (f) {
          designation = f.designation || 'Head of Department';
          photoPath = f.photo_path || null;
        }
      } else if (user.role === 'faculty') {
        const f = await env.DB.prepare('SELECT id, designation, photo_path FROM faculty WHERE user_id = ?').bind(user.id).first();
        if (f) {
          designation = f.designation || 'Assistant Professor';
          photoPath = f.photo_path || null;
          const assigned = await env.DB.prepare('SELECT * FROM class_incharges WHERE faculty_id = ?').bind(f.id).all();
          inchargeAssignments = assigned.results || [];
          isClassIncharge = inchargeAssignments.length > 0;
          userRoleStats.assignedClasses = inchargeAssignments.length;
        }
        const mySubCount = await env.DB.prepare('SELECT COUNT(*) as c FROM subjects WHERE faculty_id = ?').bind(user.faculty_id || 0).first();
        userRoleStats.assignedSubjects = mySubCount?.c || 0;
      } else if (user.role === 'student') {
        const s = await env.DB.prepare('SELECT id, photo_path FROM students WHERE user_id = ?').bind(user.id).first();
        if (s) {
          photoPath = s.photo_path || null;
          const studAtt = await env.DB.prepare(`
            SELECT COUNT(*) as total, SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present
            FROM attendance_records WHERE student_id = ?
          `).bind(s.id).first();
          const sTot = studAtt?.total || 0;
          const sPres = studAtt?.present || 0;
          userRoleStats.studentAttendance = sTot > 0 ? `${Math.round((sPres / sTot) * 100)}%` : 'N/A';
          userRoleStats.totalDays = sTot;
          userRoleStats.presentDays = sPres;
        }
      }

      const totalStudents = studentCount?.c || 0;
      const totalFaculty = facultyCount?.c || 0;
      const totalSubjects = subjectCount?.c || 0;
      const pendingLeaves = pendingLeavesCount?.c || 0;
      const pendingRegistrations = pendingRegCount?.c || 0;

      const userPayload = {
        id: user.id,
        username: user.username,
        name: user.name || user.username,
        role: user.role,
        designation: designation,
        department: dept,
        photoPath: photoPath,
        lastLogin: new Date().toISOString(),
        isClassIncharge: isClassIncharge,
        classInchargeAssignments: inchargeAssignments
      };

      const statsPayload = {
        totalStudents,
        totalFaculty,
        totalSubjects,
        pendingLeaves,
        pendingRegistrations,
        pendingApprovals: pendingRegistrations,
        attendancePercentage,
        ...userRoleStats
      };

      return jsonResponse({
        user: userPayload,
        stats: statsPayload,
        // Flat aliases for backwards compatibility
        totalStudents,
        totalFaculty,
        totalSubjects,
        pendingLeaves,
        pendingApprovals: pendingRegistrations,
        pendingRegistrations,
        attendancePercentage,
        department: dept,
        ...userRoleStats
      }, 200, request);
    }

    if (path === '/api/dashboard/timetable' && method === 'GET') {
      const user = await getAuthenticatedUser(request, env);
      if (!user) return errorResponse('Unauthorized', 401, request);
      const timetable = await env.DB.prepare('SELECT * FROM timetable WHERE department = ?').bind(user.department).all();
      return jsonResponse(timetable.results || [], 200, request);
    }

    // =================================================================
    // RESOURCES API (/api/resources)
    // =================================================================
    if (path.startsWith('/api/resources')) {
      const user = await getAuthenticatedUser(request, env);
      if (!user) return errorResponse('Unauthorized', 401, request);

      // Upload Resource (POST /api/resources/upload)
      if (path === '/api/resources/upload' && method === 'POST') {
        if (user.role !== 'faculty' && user.role !== 'admin') return errorResponse('Forbidden', 403, request);

        const form = await request.formData();
        const file = form.get('file');
        const title = form.get('title') || 'Course Resource';
        const subjectId = form.get('subjectId');

        if (!file || typeof file === 'string') return errorResponse('File required', 400, request);

        const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')) : '';
        const key = `res-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;

        if (env.UPLOADS_BUCKET) {
          await env.UPLOADS_BUCKET.put(key, file.stream(), {
            httpMetadata: { contentType: file.type || 'application/octet-stream' }
          });
        }

        const faculty = await env.DB.prepare('SELECT id FROM faculty WHERE user_id = ?').bind(user.id).first();

        await env.DB.prepare(`
          INSERT INTO resources (title, subject_id, faculty_id, file_path, file_name, file_size, file_type)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(title, subjectId, faculty?.id || 1, `/uploads/${key}`, file.name || key, file.size || 0, file.type || ext).run();

        return jsonResponse({ message: 'Resource uploaded successfully.' }, 201, request);
      }

      // GET /api/resources/faculty & /api/resources/student
      if ((path === '/api/resources/faculty' || path === '/api/resources/student') && method === 'GET') {
        const list = await env.DB.prepare(`
          SELECT r.*, s.name as subject_name, f.name as faculty_name
          FROM resources r
          JOIN subjects s ON r.subject_id = s.id
          JOIN faculty f ON r.faculty_id = f.id
          WHERE s.department = ?
          ORDER BY r.created_at DESC
        `).bind(user.department).all();
        return jsonResponse(list.results || [], 200, request);
      }
    }

    // =================================================================
    // NATIVE WEB PUSH SUBSCRIPTION API (/api/push)
    // =================================================================
    if (path.startsWith('/api/push')) {
      const user = await getAuthenticatedUser(request, env);
      if (!user) return errorResponse('Unauthorized', 401, request);

      if (path === '/api/push/subscribe' && method === 'POST') {
        const sub = await request.json();
        if (!sub.endpoint || !sub.keys) return errorResponse('Invalid subscription object', 400, request);

        await env.DB.prepare(`
          INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
        `).bind(user.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth).run();

        return jsonResponse({ message: 'Push subscription stored successfully.' }, 201, request);
      }

      if (path === '/api/push/unsubscribe' && method === 'POST') {
        const { endpoint } = await request.json();
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').bind(user.id, endpoint).run();
        return jsonResponse({ message: 'Unsubscribed successfully.' }, 200, request);
      }
    }

    // -----------------------------------------------------------------
    // 404 Handler for Unmatched API Endpoints
    // -----------------------------------------------------------------
    if (path.startsWith('/api/')) {
      return jsonResponse({ message: 'Requested resource could not be located.' }, 404, request);
    }

    // Fallback for non-API routes (serve static frontend if ASSETS binding exists)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Cloudflare Worker SMS Backend Active', {
      headers: { 'Content-Type': 'text/plain', ...corsHeaders(request) }
    });
  }
};
