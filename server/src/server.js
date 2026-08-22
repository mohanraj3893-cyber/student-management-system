const mysql = require('mysql2/promise');
const app = require('./app');
const { sequelize, Role } = require('./models');
const logger = require('./middleware/logger');
const http = require('http');
const { Server } = require('socket.io');

const socketManager = require('./realtime/socketManager');

const PORT = process.env.PORT || 5000;

// Ensure MySQL database exists before initializing ORM
const ensureDatabaseExists = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      port: parseInt(process.env.DB_PORT) || 3306
    });

    const dbName = process.env.DB_NAME || 'sms_db';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    logger.info(`Database verification check: '${dbName}' is ready.`);
    await connection.end();
  } catch (error) {
    logger.warn('Initial MySQL server connection attempt failed. Ensure local database service is active: ' + error.message);
    throw error;
  }
};

// Seed default roles if roles table is empty
const seedRoles = async () => {
  try {
    const count = await Role.count();
    if (count === 0) {
      await Role.bulkCreate([
        { name: 'student', description: 'Student Portal Access Permissions' },
        { name: 'faculty', description: 'Faculty Portal Access Permissions' },
        { name: 'admin', description: 'Department Head / Admin Portal Access Permissions' }
      ]);
      logger.info('Database Seed: Default roles (student, faculty, admin) successfully loaded.');
    }
  } catch (error) {
    logger.error('Failed to seed default roles:', error);
  }
};

// Bootstrap Server
const startServer = async () => {
  try {
    // 1. Ensure target DB schema exists
    await ensureDatabaseExists();

    // 2. Authenticate Sequelize Pool Connection
    await sequelize.authenticate();
    const dialectName = sequelize.getDialect().toUpperCase();
    const dbConfig = sequelize.config;
    logger.info(`DATABASE SINGLE SOURCE OF TRUTH: Connected to ${dialectName} Database '${dbConfig.database}' on ${dbConfig.host}:${dbConfig.port} as User '${dbConfig.username}'`);

    // 3. Synchronize Database Models
    await sequelize.sync();
    logger.info('ORM: All MySQL database tables synchronized successfully.');

    // 4. Seed Essential Data
    await seedRoles();

    // 5. Wrap Express with HTTP Server & Initialize Real-Time Socket Manager
    const server = http.createServer(app);
    socketManager.init(server);
    app.set('socketManager', socketManager);

    // 6. Start Server
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`SERVER: Booted successfully with Real-Time Socket.IO on http://0.0.0.0:${PORT}`);
    });

  } catch (error) {
    logger.error('SERVER FATAL ERROR: Boot sequence aborted.', error);
    process.exit(1);
  }
};

startServer();
