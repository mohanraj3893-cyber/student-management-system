const { User, Role, Faculty, Subject, ClassIncharge } = require('../models');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Get all approved faculty
exports.getAllFaculty = async (req, res) => {
  try {
    const facultyRole = await Role.findOne({ where: { name: 'faculty' } });
    if (!facultyRole) {
      return res.status(404).json({ message: 'Faculty role not found.' });
    }

    const faculty = await User.findAll({
      where: { roleId: facultyRole.id, isApproved: true },
      include: [{ model: Faculty, as: 'faculty' }]
    });

    const formatted = faculty.map(u => {
      const p = u.faculty || {};
      const fId = p.id ? p.id : u.id;
      return {
        id: fId,
        facultyId: fId,
        userId: u.id,
        username: u.username,
        email: u.email,
        name: p.name || '',
        employeeId: p.employeeId || u.username,
        phone: p.phone || '',
        designation: p.designation || '',
        department: p.department || 'Computer Science & Engineering',
        photoPath: p.photoPath || null,
        isActive: u.isActive
      };
    });

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('[Faculty Controller getAllFaculty Error]:', error);
    return res.status(500).json({ message: 'Internal server error retrieving faculty.' });
  }
};

// Get single faculty by ID
exports.getFacultyById = async (req, res) => {
  try {
    const { id } = req.params;
    let user = await User.findByPk(id, {
      include: [{ model: Faculty, as: 'faculty', include: [{ model: Subject, as: 'subjects' }] }]
    });

    if (!user) {
      const profile = await Faculty.findOne({ where: { employeeId: id }, include: [{ model: Subject, as: 'subjects' }] });
      if (profile) {
        user = await User.findByPk(profile.userId, {
          include: [{ model: Faculty, as: 'faculty', include: [{ model: Subject, as: 'subjects' }] }]
        });
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'Faculty not found.' });
    }

    const p = user.faculty || {};
    const subjects = (p.subjects || []).map(s => ({
      id: s.id,
      code: s.code,
      name: s.name,
      credits: s.credits,
      semester: s.semester,
      section: s.section
    }));
    return res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      name: p.name || '',
      employeeId: p.employeeId || user.username,
      phone: p.phone || '',
      designation: p.designation || '',
      department: p.department || 'Computer Science & Engineering',
      qualification: p.qualification || '',
      researchArea: p.researchArea || '',
      publications: p.publications || '',
      photoPath: p.photoPath || null,
      isActive: user.isActive,
      subjects
    });
  } catch (error) {
    console.error('[Faculty Controller getFacultyById Error]:', error);
    return res.status(500).json({ message: 'Internal server error retrieving faculty.' });
  }
};

// Create Faculty
exports.createFaculty = async (req, res) => {
  const { employeeId, name, email, phone, designation, password } = req.body;

  if (!employeeId || !name || !email || !password) {
    return res.status(400).json({ message: 'Employee ID, name, email, and password are required.' });
  }

  const facultyRole = await Role.findOne({ where: { name: 'faculty' } });
  if (!facultyRole) {
    return res.status(500).json({ message: 'Faculty role not found in system.' });
  }

  // Check unique constraints
  const existingUser = await User.findOne({ where: { username: employeeId } });
  if (existingUser) {
    return res.status(400).json({ message: 'Faculty with this employee ID already exists.' });
  }

  const existingEmail = await User.findOne({ where: { email } });
  if (existingEmail) {
    return res.status(400).json({ message: 'Official email is already registered.' });
  }

  const t = await User.sequelize.transaction();
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username: employeeId,
      email,
      passwordHash,
      roleId: facultyRole.id,
      isApproved: true // HOD creations are approved by default
    }, { transaction: t });

    await Faculty.create({
      userId: newUser.id,
      name,
      employeeId,
      department: 'Computer Science & Engineering', // Backend enforced
      designation: designation || 'Assistant Professor',
      phone: phone || ''
    }, { transaction: t });

    await t.commit();

    return res.status(201).json({ message: 'Faculty created successfully.', id: newUser.id });
  } catch (error) {
    await t.rollback();
    console.error('[Faculty Controller createFaculty Error]:', error);
    return res.status(500).json({ message: 'Internal server error creating faculty.' });
  }
};

// Update Faculty
exports.updateFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, designation, qualification, researchArea, publications, photo } = req.body;

    let user = await User.findByPk(id, {
      include: [{ model: Faculty, as: 'faculty' }]
    });

    if (!user) {
      const profile = await Faculty.findOne({ where: { employeeId: id } });
      if (profile) {
        user = await User.findByPk(profile.userId, {
          include: [{ model: Faculty, as: 'faculty' }]
        });
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'Faculty not found.' });
    }

    if (email && email !== user.email) {
      const emailExists = await User.findOne({ where: { email } });
      if (emailExists) {
        return res.status(400).json({ message: 'Email address already in use.' });
      }
      user.email = email;
    }

    await user.save();

    let photoPath = undefined;
    if (photo) {
      const matches = photo.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const allowedExts = ['jpeg', 'jpg', 'png', 'webp'];
        const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        if (allowedExts.includes(extension)) {
          const buffer = Buffer.from(matches[2], 'base64');
          const uploadsDir = path.join(__dirname, '../../uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          const filename = `profile-fac-${user.id}-${Date.now()}.${extension}`;
          const filepath = path.join(uploadsDir, filename);
          fs.writeFileSync(filepath, buffer);
          photoPath = `/uploads/${filename}`;
        }
      }
    }

    if (user.faculty) {
      user.faculty.name = name !== undefined ? name : user.faculty.name;
      user.faculty.phone = phone !== undefined ? phone : user.faculty.phone;
      user.faculty.designation = designation !== undefined ? designation : user.faculty.designation;
      user.faculty.qualification = qualification !== undefined ? qualification : user.faculty.qualification;
      user.faculty.researchArea = researchArea !== undefined ? researchArea : user.faculty.researchArea;
      user.faculty.publications = publications !== undefined ? publications : user.faculty.publications;
      if (photoPath !== undefined) user.faculty.photoPath = photoPath;
      await user.faculty.save();
    } else {
      await Faculty.create({
        userId: user.id,
        name: name || user.username,
        employeeId: user.username,
        department: 'Computer Science & Engineering',
        designation: designation || 'Assistant Professor',
        phone: phone || '',
        qualification: qualification || '',
        researchArea: researchArea || '',
        publications: publications || '',
        photoPath: photoPath || null
      });
    }

    return res.status(200).json({ message: 'Faculty profile updated successfully.', photoPath: photoPath || (user.faculty ? user.faculty.photoPath : null) });
  } catch (error) {
    console.error('[Faculty Controller updateFaculty Error]:', error);
    return res.status(500).json({ message: 'Internal server error updating faculty.' });
  }
};

// Delete Faculty
exports.deleteFaculty = async (req, res) => {
  const t = await User.sequelize.transaction();
  try {
    const { id } = req.params;
    let faculty = null;
    let user = null;

    const isNumeric = /^\d+$/.test(String(id));

    if (isNumeric) {
      faculty = await Faculty.findByPk(id, { transaction: t });
      if (faculty) {
        user = await User.findByPk(faculty.userId, { transaction: t });
      } else {
        user = await User.findByPk(id, { transaction: t });
        if (user) {
          faculty = await Faculty.findOne({ where: { userId: user.id }, transaction: t });
        }
      }
    }

    if (!user && !faculty) {
      faculty = await Faculty.findOne({ where: { employeeId: id }, transaction: t });
      if (faculty) {
        user = await User.findByPk(faculty.userId, { transaction: t });
      } else {
        user = await User.findOne({ where: { username: id }, transaction: t });
        if (user) {
          faculty = await Faculty.findOne({ where: { userId: user.id }, transaction: t });
        }
      }
    }

    if (!user && !faculty) {
      await t.rollback();
      return res.status(404).json({ message: 'Faculty record not found.' });
    }

    const userId = user ? user.id : (faculty ? faculty.userId : null);
    const facultyId = faculty ? faculty.id : null;

    // 1. Clean up ClassIncharge records
    if (facultyId) {
      await ClassIncharge.destroy({ where: { facultyId: facultyId }, transaction: t });
    }
    if (userId) {
      await ClassIncharge.destroy({ where: { facultyId: userId }, transaction: t });
    }

    // 2. Unassign assigned Subjects
    if (facultyId) {
      await Subject.update({ facultyId: null }, { where: { facultyId: facultyId }, transaction: t });
    }
    if (userId) {
      await Subject.update({ facultyId: null }, { where: { facultyId: userId }, transaction: t });
    }

    // 3. Destroy Faculty profile
    if (faculty) {
      await faculty.destroy({ transaction: t });
    } else if (userId) {
      await Faculty.destroy({ where: { userId: userId }, transaction: t });
    }

    // 4. Destroy User account
    if (user) {
      await user.destroy({ transaction: t });
    } else if (userId) {
      await User.destroy({ where: { id: userId }, transaction: t });
    }

    await t.commit();
    return res.status(200).json({ message: 'Faculty deleted successfully.' });
  } catch (error) {
    await t.rollback();
    console.error('[Faculty Controller deleteFaculty Error]:', error);
    return res.status(500).json({ message: error.message || 'Internal server error deleting faculty.' });
  }
};
