const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { User, Role, Session, Student, Faculty, Notification, sequelize } = require('../models');

// Helper to sign JWT tokens
const generateAccessToken = (user, roleName) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: roleName },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id, nonce: Math.random().toString(36).substring(2) + Date.now() },
    process.env.JWT_REFRESH_SECRET || 'refresh_secret',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

exports.register = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { username, email, password, role, name, extraData, photo, department } = req.body;

    if (!username || !email || !password || !role || !name) {
      await t.rollback();
      return res.status(400).json({ message: 'All registration fields are required.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [User.sequelize.Sequelize.Op.or]: [{ username }, { email }]
      }
    });

    if (existingUser) {
      await t.rollback();
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        const fieldName = role.toLowerCase() === 'student' ? 'Register number' : 'Employee ID';
        return res.status(409).json({ message: `${fieldName} already exists.` });
      }
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        return res.status(409).json({ message: 'Email already registered.' });
      }
      return res.status(409).json({ message: 'Register number or Email is already registered.' });
    }

    // Supported Departments list
    const SUPPORTED_DEPARTMENTS = [
      'Computer Science & Engineering',
      'Information Technology',
      'Electronics & Communication Engineering',
      'Electrical & Electronics Engineering',
      'Artificial Intelligence & Data Science'
    ];

    const normalizedRole = (role.toLowerCase() === 'hod' || role.toLowerCase() === 'admin') ? 'admin' : role.toLowerCase();

    // Fetch matching role
    const dbRole = await Role.findOne({ where: { name: normalizedRole } });
    if (!dbRole) {
      await t.rollback();
      return res.status(400).json({ message: `Role '${role}' is not supported.` });
    }

    // Resolve target department
    let rawDepartment = department || extraData?.department || req.body.branch || extraData?.branch;

    // Strict Backend Validation for Faculty Registration Department
    if (role.toLowerCase() === 'faculty') {
      if (!rawDepartment || typeof rawDepartment !== 'string' || !rawDepartment.trim()) {
        await t.rollback();
        return res.status(400).json({ message: 'Department is required for faculty registration.' });
      }
      const trimmedDept = rawDepartment.trim();
      if (!SUPPORTED_DEPARTMENTS.includes(trimmedDept)) {
        await t.rollback();
        return res.status(400).json({ message: 'Please select a valid department for faculty registration.' });
      }
      rawDepartment = trimmedDept;
    }

    let targetDepartment = rawDepartment || 'Computer Science & Engineering';

    if (!SUPPORTED_DEPARTMENTS.includes(targetDepartment)) {
      if (targetDepartment.includes('CSE') || targetDepartment.includes('Computer')) targetDepartment = 'Computer Science & Engineering';
      else if (targetDepartment.includes('IT') || targetDepartment.includes('Information')) targetDepartment = 'Information Technology';
      else if (targetDepartment.includes('ECE') || targetDepartment.includes('Electronics')) targetDepartment = 'Electronics & Communication Engineering';
      else if (targetDepartment.includes('EEE') || targetDepartment.includes('Electrical')) targetDepartment = 'Electrical & Electronics Engineering';
      else if (targetDepartment.includes('AI') || targetDepartment.includes('Data')) targetDepartment = 'Artificial Intelligence & Data Science';
      else targetDepartment = 'Computer Science & Engineering';
    }

    // One HOD Per Department Check (Approved or Pending)
    if (normalizedRole === 'admin') {
      if (!targetDepartment || !SUPPORTED_DEPARTMENTS.includes(targetDepartment)) {
        await t.rollback();
        return res.status(400).json({ message: 'Please select a valid department for HOD registration.' });
      }

      const existingHOD = await Faculty.findOne({
        where: {
          department: targetDepartment,
          designation: 'HOD'
        },
        include: [{
          model: User,
          as: 'user',
          where: { roleId: dbRole.id }
        }],
        transaction: t
      });

      if (existingHOD) {
        await t.rollback();
        return res.status(409).json({ message: 'A HOD is already registered for this department.' });
      }
    }

    // Hash Password
    const passwordHash = await bcrypt.hash(password, 10);

    // Save image if present
    let relativePath = null;
    if (photo) {
      const matches = photo.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        await t.rollback();
        return res.status(400).json({ message: 'Invalid base64 image data.' });
      }
      const allowedExts = ['jpeg', 'jpg', 'png', 'webp'];
      const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      if (!allowedExts.includes(extension)) {
        await t.rollback();
        return res.status(400).json({ message: 'Only JPG, JPEG, PNG, and WEBP image files are allowed.' });
      }
      const buffer = Buffer.from(matches[2], 'base64');
      if (buffer.length > 20 * 1024 * 1024) {
        await t.rollback();
        return res.status(400).json({ message: 'Profile photo size exceeds the 20MB limit.' });
      }
      const uploadsDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const filename = `profile-reg-${username}-${Date.now()}.${extension}`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, buffer);
      relativePath = `/uploads/${filename}`;
    }

    // Admin is auto-approved; Faculty and Student registrations require HOD approval
    const isApprovedByDefault = normalizedRole === 'admin';

    const newUser = await User.create({
      username,
      email,
      passwordHash,
      roleId: dbRole.id,
      isApproved: isApprovedByDefault
    }, { transaction: t });

    // Create corresponding profile record with targetDepartment
    if (normalizedRole === 'admin') {
      await Faculty.create({
        userId: newUser.id,
        name,
        employeeId: username,
        designation: 'HOD',
        department: targetDepartment,
        phone: extraData?.phone || '',
        photoPath: relativePath
      }, { transaction: t });
    } else if (role.toLowerCase() === 'faculty') {
      await Faculty.create({
        userId: newUser.id,
        name,
        employeeId: username,
        designation: extraData?.designation || 'Assistant Professor',
        department: targetDepartment,
        phone: extraData?.phone || '',
        photoPath: relativePath
      }, { transaction: t });
    } else if (role.toLowerCase() === 'student') {
      const course = extraData?.course || req.body.course;
      const branch = extraData?.branch || req.body.branch;
      const batch = extraData?.batch || req.body.batch;
      const bloodGroup = extraData?.bloodGroup || req.body.bloodGroup;
      const dob = extraData?.dob || req.body.dob;
      const address = extraData?.address || req.body.address;
      const aadhaarNo = extraData?.aadhaarNo || req.body.aadhaarNo;

      if (!course || !branch || !batch || !bloodGroup || !dob || !address || !aadhaarNo) {
        await t.rollback();
        return res.status(400).json({ success: false, message: 'All student details (Course, Branch, Batch, Blood Group, D.O.B, Address, and Aadhaar No) are required.' });
      }

      const aadhaarClean = String(aadhaarNo).trim();
      if (!/^\d{12}$/.test(aadhaarClean)) {
        await t.rollback();
        return res.status(400).json({ success: false, message: 'Aadhaar number must contain exactly 12 digits.' });
      }

      const dobDate = new Date(dob);
      if (isNaN(dobDate.getTime()) || dobDate > new Date()) {
        await t.rollback();
        return res.status(400).json({ success: false, message: 'D.O.B cannot be in the future.' });
      }

      await Student.create({
        userId: newUser.id,
        name,
        registerNumber: username,
        department: targetDepartment,
        year: extraData?.year || '',
        semester: extraData?.semester || '',
        phone: extraData?.phone || '',
        photoPath: relativePath,
        course: String(course).trim(),
        branch: targetDepartment,
        batch: String(batch).trim(),
        bloodGroup: String(bloodGroup).trim(),
        dob: String(dob).trim(),
        address: String(address).trim(),
        aadhaarNo: aadhaarClean
      }, { transaction: t });
    }

    // Create notification ONLY for HOD users belonging to targetDepartment
    let targetHODUserIds = [];
    if (!isApprovedByDefault) {
      const hodFaculties = await Faculty.findAll({
        where: {
          department: targetDepartment,
          designation: 'HOD'
        },
        include: [{
          model: User,
          as: 'user',
          where: { isApproved: true }
        }],
        transaction: t
      });

      targetHODUserIds = hodFaculties.map(f => f.userId);

      if (targetHODUserIds.length === 0) {
        const adminRole = await Role.findOne({ where: { name: 'admin' }, transaction: t });
        if (adminRole) {
          const allAdmins = await User.findAll({
            where: { roleId: adminRole.id, isApproved: true },
            include: [{ model: Faculty, as: 'faculty', where: { department: targetDepartment } }],
            transaction: t
          });
          targetHODUserIds = allAdmins.map(a => a.id);
        }
      }

      for (const hodId of targetHODUserIds) {
        const isStudent = role.toLowerCase() === 'student';
        const notifType = isStudent ? 'new_student_registration' : 'new_faculty_registration';
        const notifMessage = isStudent
          ? `🆕 New Student Registration (${targetDepartment}): ${name} (${username}) submitted a registration request.`
          : `🆕 New Faculty Registration (${targetDepartment}): ${name} (${username}) submitted a registration request.`;

        await Notification.create({
          userId: hodId,
          message: notifMessage,
          type: notifType,
          relatedId: newUser.id,
          isRead: false
        }, { transaction: t });
      }
    }

    await t.commit();

    // Trigger Socket.IO real-time notification ONLY to target HOD user(s)
    const socketManager = req.app.get('socketManager');
    if (socketManager && !isApprovedByDefault && targetHODUserIds.length > 0) {
      const isStudent = role.toLowerCase() === 'student';
      const eventType = isStudent ? 'NEW_STUDENT_REGISTRATION' : 'NEW_FACULTY_REGISTRATION';
      const message = isStudent
        ? `🆕 New Student Registration (${targetDepartment}): ${name} (${username}) submitted a registration request.`
        : `🆕 New Faculty Registration (${targetDepartment}): ${name} (${username}) submitted a registration request.`;

      for (const hodId of targetHODUserIds) {
        socketManager.emitToUser(hodId, eventType, {
          message,
          userId: newUser.id,
          username,
          name,
          role,
          department: targetDepartment
        });
        socketManager.emitToUser(hodId, 'REGISTRATION_LIST_CHANGED', {
          userId: newUser.id,
          action: 'created',
          department: targetDepartment
        });
      }
    }

    const successMsg = isApprovedByDefault
      ? 'Registration successful!'
      : 'Registration submitted successfully. Your account is waiting for HOD approval.';

    return res.status(201).json({
      message: successMsg,
      userId: newUser.id,
      isApproved: newUser.isApproved
    });

  } catch (error) {
    await t.rollback();
    console.error('[Auth Controller Register Error]:', error);
    return res.status(500).json({ message: 'Internal server error during registration.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const user = await User.findOne({
      where: {
        [User.sequelize.Sequelize.Op.or]: [{ username }, { email: username }]
      },
      include: [{ model: Role, as: 'role' }]
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Your account has been deactivated.' });
    }

    if (!user.isApproved) {
      return res.status(403).json({ message: 'Your registration is pending approval by HOD.' });
    }

    const roleName = user.role.name;
    const accessToken = generateAccessToken(user, roleName);
    const refreshToken = generateRefreshToken(user);

    await Session.create({
      userId: user.id,
      refreshToken: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    let profileData = null;
    if (roleName === 'student') {
      profileData = await Student.findOne({ where: { userId: user.id } });
    } else if (roleName === 'faculty' || roleName === 'admin') {
      profileData = await Faculty.findOne({ where: { userId: user.id } });
    }

    return res.status(200).json({
      message: 'Login successful.',
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: roleName,
        name: profileData ? profileData.name : user.username,
        department: profileData ? profileData.department : 'Computer Science & Engineering',
        photoPath: profileData ? profileData.photoPath : null
      }
    });

  } catch (error) {
    console.error('[Auth Controller Login Error]:', error);
    return res.status(500).json({ message: 'Internal server error during login.' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token missing.' });
    }

    const session = await Session.findOne({
      where: { refreshToken },
      include: [{ model: User, as: 'user', include: [{ model: Role, as: 'role' }] }]
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(403).json({ message: 'Invalid or expired refresh token.' });
    }

    const newAccessToken = generateAccessToken(session.user, session.user.role.name);

    return res.status(200).json({
      accessToken: newAccessToken
    });

  } catch (error) {
    console.error('[Auth Controller Refresh Token Error]:', error);
    return res.status(500).json({ message: 'Internal server error refreshing token.' });
  }
};

exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (refreshToken) {
      await Session.destroy({ where: { refreshToken } });
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    return res.status(200).json({ message: 'Logged out successfully.' });

  } catch (error) {
    console.error('[Auth Controller Logout Error]:', error);
    return res.status(500).json({ message: 'Internal server error during logout.' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Both old and new passwords are required.' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User profile not found.' });
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Incorrect old password.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({ message: 'Password updated successfully.' });

  } catch (error) {
    console.error('[Auth Controller Change Password Error]:', error);
    return res.status(500).json({ message: 'Internal server error during password change.' });
  }
};

exports.checkAdminExists = async (req, res) => {
  try {
    const adminRole = await Role.findOne({ where: { name: 'admin' } });
    if (!adminRole) {
      return res.status(200).json({ exists: false });
    }
    const adminUser = await User.findOne({ where: { roleId: adminRole.id } });
    return res.status(200).json({ exists: !!adminUser });
  } catch (error) {
    console.error('[Auth Controller checkAdminExists Error]:', error);
    return res.status(500).json({ message: 'Internal server error checking admin status.' });
  }
};

// GET /api/admin/pending-registrations - Scoped to req.user.department at database level
exports.getPendingRegistrations = async (req, res) => {
  try {
    const hodDept = req.user.department || 'Computer Science & Engineering';

    const pendingUsers = await User.findAll({
      where: { isApproved: false },
      include: [
        { model: Role, as: 'role' },
        { model: Student, as: 'student', where: { department: hodDept }, required: false },
        { model: Faculty, as: 'faculty', where: { department: hodDept }, required: false }
      ]
    });

    const students = [];
    const faculty = [];

    pendingUsers.forEach(user => {
      if (user.role?.name === 'student' && user.student && user.student.department === hodDept) {
        students.push({
          userId: user.id,
          username: user.username,
          email: user.email,
          name: user.student.name,
          registerNumber: user.student.registerNumber,
          department: user.student.department,
          year: user.student.year,
          semester: user.student.semester,
          phone: user.student.phone,
          photoPath: user.student.photoPath,
          course: user.student.course || 'B.E',
          branch: user.student.branch || user.student.department,
          batch: user.student.batch || '2024-2028',
          bloodGroup: user.student.bloodGroup || 'Unknown',
          dob: user.student.dob || '',
          address: user.student.address || '',
          aadhaarNo: user.student.aadhaarNo ? `XXXX XXXX ${user.student.aadhaarNo.slice(-4)}` : '',
          createdAt: user.createdAt
        });
      } else if (user.role?.name === 'faculty' && user.faculty && user.faculty.department === hodDept) {
        faculty.push({
          userId: user.id,
          username: user.username,
          email: user.email,
          name: user.faculty.name,
          employeeId: user.faculty.employeeId,
          designation: user.faculty.designation,
          department: user.faculty.department,
          phone: user.faculty.phone,
          photoPath: user.faculty.photoPath,
          createdAt: user.createdAt
        });
      }
    });

    return res.status(200).json({ students, faculty });

  } catch (error) {
    console.error('[Auth Controller getPendingRegistrations Error]:', error);
    return res.status(500).json({ message: 'Internal server error retrieving pending list.' });
  }
};

// Approve Registration with strict HOD Department Security Guard
exports.approveRegistration = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByPk(userId, {
      include: [
        { model: Role, as: 'role' },
        { model: Student, as: 'student' },
        { model: Faculty, as: 'faculty' }
      ]
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const targetDept = user.student?.department || user.faculty?.department;
    const hodDept = req.user.department;

    if (hodDept && targetDept && targetDept !== hodDept) {
      return res.status(403).json({ message: 'Access denied: Cannot approve registration for a student/faculty from another department.' });
    }

    if ((user.role?.name === 'admin' || user.role?.name === 'hod') && user.faculty) {
      const existingApprovedHOD = await Faculty.findOne({
        where: {
          department: user.faculty.department,
          designation: 'HOD'
        },
        include: [{
          model: User,
          as: 'user',
          where: { isApproved: true, id: { [sequelize.Sequelize.Op.ne]: user.id } }
        }]
      });
      if (existingApprovedHOD) {
        return res.status(409).json({ message: 'A HOD is already registered for this department.' });
      }
    }

    user.isApproved = true;
    await user.save();

    const socketManager = req.app.get('socketManager');
    if (socketManager) {
      socketManager.emitToUser(user.id, 'REGISTRATION_APPROVED', {
        userId: user.id,
        message: 'Your registration has been approved by HOD!'
      });
      socketManager.emitToUser(req.user.id, 'REGISTRATION_LIST_CHANGED', { userId: user.id, action: 'approved' });
    }

    return res.status(200).json({ message: 'User registration approved successfully.' });
  } catch (error) {
    console.error('[Auth Controller approveRegistration Error]:', error);
    return res.status(500).json({ message: 'Internal server error approving registration.' });
  }
};

// Reject Registration with strict HOD Department Security Guard
exports.rejectRegistration = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { userId } = req.params;
    const user = await User.findByPk(userId, {
      include: [
        { model: Role, as: 'role' },
        { model: Student, as: 'student' },
        { model: Faculty, as: 'faculty' }
      ],
      transaction: t
    });

    if (!user) {
      await t.rollback();
      return res.status(404).json({ message: 'User not found.' });
    }

    const targetDept = user.student?.department || user.faculty?.department;
    const hodDept = req.user.department;

    if (hodDept && targetDept && targetDept !== hodDept) {
      await t.rollback();
      return res.status(403).json({ message: 'Access denied: Cannot reject registration for a student/faculty from another department.' });
    }

    await Student.destroy({ where: { userId }, transaction: t });
    await Faculty.destroy({ where: { userId }, transaction: t });
    await user.destroy({ transaction: t });

    await t.commit();

    const socketManager = req.app.get('socketManager');
    if (socketManager) {
      socketManager.emitToUser(req.user.id, 'REGISTRATION_LIST_CHANGED', { userId: Number(userId), action: 'rejected' });
    }

    return res.status(200).json({ message: 'User registration rejected and profile removed.' });
  } catch (error) {
    await t.rollback();
    console.error('[Auth Controller rejectRegistration Error]:', error);
    return res.status(500).json({ message: 'Internal server error rejecting registration.' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: Role, as: 'role' },
        { model: Student, as: 'student' },
        { model: Faculty, as: 'faculty' }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    let profileData = {
      username: user.username,
      email: user.email,
      role: user.role.name
    };

    if (user.role.name === 'student' && user.student) {
      profileData = { ...profileData, ...user.student.toJSON() };
    } else if ((user.role.name === 'faculty' || user.role.name === 'admin') && user.faculty) {
      profileData = { ...profileData, ...user.faculty.toJSON() };
    }

    return res.status(200).json(profileData);
  } catch (error) {
    console.error('[Auth Controller getProfile Error]:', error);
    return res.status(500).json({ message: 'Internal server error fetching profile.' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: Role, as: 'role' },
        { model: Student, as: 'student' },
        { model: Faculty, as: 'faculty' }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const { name, phone, address, qualification, researchArea, publications } = req.body;

    if (user.role.name === 'student' && user.student) {
      if (name) user.student.name = name;
      if (phone) user.student.phone = phone;
      if (address) user.student.address = address;
      await user.student.save();
    } else if ((user.role.name === 'faculty' || user.role.name === 'admin') && user.faculty) {
      if (name) user.faculty.name = name;
      if (phone) user.faculty.phone = phone;
      if (qualification) user.faculty.qualification = qualification;
      if (researchArea) user.faculty.researchArea = researchArea;
      if (publications) user.faculty.publications = publications;
      await user.faculty.save();
    }

    return res.status(200).json({ message: 'Profile updated successfully.' });
  } catch (error) {
    console.error('[Auth Controller updateProfile Error]:', error);
    return res.status(500).json({ message: 'Internal server error updating profile.' });
  }
};

exports.uploadProfilePhoto = async (req, res) => {
  try {
    const { photo } = req.body;
    if (!photo) {
      return res.status(400).json({ message: 'Photo data is required.' });
    }

    const matches = photo.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ message: 'Invalid base64 image format.' });
    }

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const filename = `profile-${req.user.id}-${Date.now()}.${extension}`;
    const filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, buffer);
    const photoPath = `/uploads/${filename}`;

    const user = await User.findByPk(req.user.id, {
      include: [
        { model: Role, as: 'role' },
        { model: Student, as: 'student' },
        { model: Faculty, as: 'faculty' }
      ]
    });

    if (user.role.name === 'student' && user.student) {
      user.student.photoPath = photoPath;
      await user.student.save();
    } else if ((user.role.name === 'faculty' || user.role.name === 'admin') && user.faculty) {
      user.faculty.photoPath = photoPath;
      await user.faculty.save();
    }

    return res.status(200).json({ message: 'Profile photo updated successfully.', photoPath });
  } catch (error) {
    console.error('[Auth Controller uploadProfilePhoto Error]:', error);
    return res.status(500).json({ message: 'Internal server error uploading photo.' });
  }
};
