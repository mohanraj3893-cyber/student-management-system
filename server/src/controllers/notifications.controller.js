const { Notification } = require('../models');

// Retrieve unread notifications for the logged-in user
exports.getMyNotifications = async (req, res) => {
  try {
    const list = await Notification.findAll({
      where: { userId: req.user.id, isRead: false },
      order: [['createdAt', 'DESC']],
      limit: 30
    });

    const unreadCount = list.length;

    return res.status(200).json({
      unreadCount,
      notifications: list
    });
  } catch (error) {
    console.error('[Notifications Controller getMyNotifications Error]:', error);
    return res.status(500).json({ message: 'Internal server error fetching notifications.' });
  }
};

// Mark a specific notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByPk(id);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    // Verify ownership
    if (notification.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: cannot modify another user\'s notification.' });
    }

    notification.isRead = true;
    await notification.save();

    const unreadCount = await Notification.count({
      where: { userId: req.user.id, isRead: false }
    });

    return res.status(200).json({
      message: 'Notification marked as read successfully.',
      unreadCount,
      notification
    });
  } catch (error) {
    console.error('[Notifications Controller markAsRead Error]:', error);
    return res.status(500).json({ message: 'Internal server error updating notification.' });
  }
};

// Mark all notifications for user as read
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.update(
      { isRead: true },
      { where: { userId: req.user.id, isRead: false } }
    );

    return res.status(200).json({
      message: 'All notifications marked as read.',
      unreadCount: 0
    });
  } catch (error) {
    console.error('[Notifications Controller markAllAsRead Error]:', error);
    return res.status(500).json({ message: 'Internal server error marking all notifications as read.' });
  }
};
