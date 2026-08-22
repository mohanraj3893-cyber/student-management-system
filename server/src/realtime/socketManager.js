const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');

class SocketManager {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // userId -> Set of socketIds
  }

  init(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      }
    });

    // JWT Authentication middleware for Socket connections
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        if (!token) {
          return next(new Error('Authentication error: Missing token'));
        }

        const JWT_SECRET = process.env.JWT_SECRET || 'sms_secret_jwt_key_2026';
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const user = await User.findByPk(decoded.id, {
          include: [{ model: Role, as: 'role' }]
        });

        if (!user || !user.isActive || !user.isApproved) {
          return next(new Error('Authentication error: Account inactive or unapproved'));
        }

        socket.user = {
          id: user.id,
          username: user.username,
          role: user.role ? user.role.name : 'student'
        };

        next();
      } catch (err) {
        next(new Error('Authentication error: Invalid token'));
      }
    });

    this.io.on('connection', (socket) => {
      const userId = socket.user.id;
      const role = socket.user.role;

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId).add(socket.id);

      // Join role channel rooms (e.g. 'role_admin', 'role_faculty', 'role_student')
      socket.join(`role_${role}`);
      socket.join(`user_${userId}`);

      console.log(`[Realtime] User ${socket.user.username} (ID: ${userId}, Role: ${role}) connected on socket ${socket.id}`);

      socket.on('disconnect', () => {
        if (this.userSockets.has(userId)) {
          const userSet = this.userSockets.get(userId);
          userSet.delete(socket.id);
          if (userSet.size === 0) {
            this.userSockets.delete(userId);
          }
        }
        console.log(`[Realtime] Socket ${socket.id} disconnected for user ${socket.user.username}`);
      });
    });

    console.log("⚡ Real-Time Socket.IO Server initialized successfully.");
  }

  // Emit event to a specific user by ID
  emitToUser(userId, event, payload) {
    if (!this.io) return;
    this.io.to(`user_${userId}`).emit(event, payload);
    this.io.emit(event, payload);
  }

  // Emit event to all users of a specific role ('admin', 'faculty', 'student')
  broadcastToRole(roleName, event, payload) {
    if (!this.io) return;
    this.io.to(`role_${roleName}`).emit(event, payload);
    this.io.emit(event, payload);
  }

  // Broadcast event to all connected users
  broadcastToAll(event, payload) {
    if (!this.io) return;
    this.io.emit(event, payload);
  }
}

module.exports = new SocketManager();
