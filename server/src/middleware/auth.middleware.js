const jwt = require('jsonwebtoken');
const { Faculty, Student } = require('../models');

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token missing.' });
  }

  const secretKey = process.env.JWT_SECRET || 'super_secret_access_jwt_key_2026_cse_dept';
  jwt.verify(token, secretKey, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Access token invalid or expired.' });
    }

    req.user = decoded;

    try {
      const roleLower = String(decoded.role || '').toLowerCase();
      if (roleLower === 'admin' || roleLower === 'hod' || roleLower === 'faculty') {
        let fac = await Faculty.findOne({ where: { userId: decoded.id } });
        if (!fac && decoded.username) {
          fac = await Faculty.findOne({ where: { employeeId: decoded.username } });
        }
        if (fac) {
          req.user.department = fac.department;
        } else if (decoded.department) {
          req.user.department = decoded.department;
        }
      } else if (roleLower === 'student') {
        let stud = await Student.findOne({ where: { userId: decoded.id } });
        if (!stud && decoded.username) {
          stud = await Student.findOne({ where: { registerNumber: decoded.username } });
        }
        if (stud) {
          req.user.department = stud.department;
        } else if (decoded.department) {
          req.user.department = decoded.department;
        }
      }

      if (!req.user.department && decoded.department) {
        req.user.department = decoded.department;
      }
    } catch (e) {
      console.error('[Auth Middleware Department Lookup Error]:', e);
    }

    next();
  });
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.map(r => String(r).toLowerCase()).includes(String(req.user.role).toLowerCase())) {
      return res.status(403).json({ message: 'Access denied: insufficient permissions.' });
    }
    next();
  };
};

exports.allowSelfOrRole = (roleToCheck) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    const userRole = String(req.user.role).toLowerCase();
    if (userRole === 'admin' || userRole === 'hod') {
      return next();
    }
    if (userRole === String(roleToCheck).toLowerCase()) {
      const requestedId = req.params.id;
      if (String(req.user.id) === String(requestedId) || String(req.user.username) === String(requestedId)) {
        return next();
      }
    }
    return res.status(403).json({ message: 'Access denied: insufficient permissions.' });
  };
};
