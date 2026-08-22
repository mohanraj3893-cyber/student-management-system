const { Announcement, User, Student, Faculty, Role, Notification, sequelize } = require('../models');

// Post a new announcement notice
exports.createAnnouncement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { title, content, category, status, priority, targetDepartment, targetYear, targetSemester, targetSection } = req.body;

    if (!title || !content) {
      await t.rollback();
      return res.status(400).json({ message: 'Title and Content are required.' });
    }

    const finalStatus = status || 'published';

    // 1. Resolve logged-in author profile from authenticated user
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: Role, as: 'role' },
        { model: Student, as: 'student' },
        { model: Faculty, as: 'faculty' }
      ],
      transaction: t
    });

    let posterName = user?.faculty?.name || user?.student?.name || user?.username || 'Department HOD';

    // 2. Create Announcement DB record
    const announcement = await Announcement.create({
      title: title.trim(),
      content: content.trim(),
      category: category || 'Academic',
      postedBy: req.user.id,
      status: finalStatus,
      targetDepartment: targetDepartment || 'all',
      targetYear: targetYear || 'all',
      targetSemester: targetSemester || 'all',
      targetSection: targetSection || 'all'
    }, { transaction: t });

    // 3. Broadcast notification to active users if published
    if (finalStatus === 'published') {
      const targetUsers = await User.findAll({
        where: {
          isActive: true,
          isApproved: true,
          id: { [sequelize.Sequelize.Op.ne]: req.user.id }
        },
        transaction: t
      });

      for (const recipient of targetUsers) {
        await Notification.create({
          userId: recipient.id,
          message: `📢 Announcement: ${title}`,
          type: 'announcement',
          relatedId: announcement.id,
          isRead: false
        }, { transaction: t });
      }
    }

    // 4. Commit transaction
    await t.commit();

    // 5. Trigger Socket.IO real-time alert for connected clients
    const socketManager = req.app.get('socketManager');
    if (socketManager && finalStatus === 'published') {
      socketManager.broadcastToAll('ANNOUNCEMENT_PUBLISHED', {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        category: announcement.category,
        targetDepartment: announcement.targetDepartment,
        targetYear: announcement.targetYear,
        targetSemester: announcement.targetSemester,
        targetSection: announcement.targetSection,
        posterName,
        createdAt: announcement.createdAt
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Announcement published successfully.',
      announcement: {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        category: announcement.category,
        status: announcement.status,
        targetDepartment: announcement.targetDepartment,
        targetYear: announcement.targetYear,
        targetSemester: announcement.targetSemester,
        targetSection: announcement.targetSection,
        posterName,
        createdAt: announcement.createdAt
      }
    });

  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    console.error('[Announcements Controller createAnnouncement Error]:', error);
    return res.status(500).json({ message: 'Internal server error posting announcement: ' + error.message });
  }
};

// Retrieve announcement noticeboard list
exports.getAnnouncements = async (req, res) => {
  try {
    const isStudent = (req.user.role === 'student');

    // Query condition for status
    const whereClause = {};
    if (isStudent) {
      whereClause.status = 'published';
    }

    const list = await Announcement.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          include: [
            { model: Student, as: 'student' },
            { model: Faculty, as: 'faculty' }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // If student, resolve student profile for targeting filter
    let studentProfile = null;
    if (isStudent) {
      studentProfile = await Student.findOne({ where: { userId: req.user.id } });
    }

    const feed = [];

    for (const a of list) {
      // Check targeting for student
      if (isStudent && studentProfile) {
        const matchesDept = (a.targetDepartment === 'all' || a.targetDepartment.toLowerCase() === (studentProfile.department || '').toLowerCase());
        const matchesYear = (a.targetYear === 'all' || a.targetYear.toLowerCase() === (studentProfile.year || '').toLowerCase());
        const matchesSem = (a.targetSemester === 'all' || a.targetSemester.toLowerCase() === (studentProfile.semester || '').toLowerCase());
        const matchesSec = (a.targetSection === 'all' || a.targetSection.toLowerCase() === (studentProfile.section || '').toLowerCase());

        if (!matchesDept || !matchesYear || !matchesSem || !matchesSec) {
          continue; // Skip if does not match targeting
        }
      }

      let posterName = 'Department HOD';
      if (a.user) {
        if (a.user.faculty && a.user.faculty.name) posterName = a.user.faculty.name;
        else if (a.user.student && a.user.student.name) posterName = a.user.student.name;
        else if (a.user.username) posterName = a.user.username;
      }

      feed.push({
        id: a.id,
        title: a.title,
        content: a.content,
        category: a.category,
        status: a.status,
        targetDepartment: a.targetDepartment,
        targetYear: a.targetYear,
        targetSemester: a.targetSemester,
        targetSection: a.targetSection,
        posterName,
        createdAt: a.createdAt
      });
    }

    return res.status(200).json(feed);

  } catch (error) {
    console.error('[Announcements Controller getAnnouncements Error]:', error);
    return res.status(500).json({ message: 'Internal server error fetching announcements feed.' });
  }
};

// Remove/Delete an announcement
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByPk(id);

    if (!announcement) {
      return res.status(404).json({ message: 'Announcement notice not found.' });
    }

    // Only creator or admin can delete notices
    if (announcement.postedBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You cannot remove this notice.' });
    }

    await announcement.destroy();
    return res.status(200).json({ message: 'Announcement notice removed successfully.' });

  } catch (error) {
    console.error('[Announcements Controller deleteAnnouncement Error]:', error);
    return res.status(500).json({ message: 'Internal server error deleting notice.' });
  }
};

