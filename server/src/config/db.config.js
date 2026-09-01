const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const dbUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
const dialect = process.env.DB_DIALECT || 'mysql';
const host = process.env.DB_HOST || '127.0.0.1';
const port = parseInt(process.env.DB_PORT) || 3306;
const dbName = process.env.DB_NAME || 'sms_db';
const user = process.env.DB_USER || 'root';
const pass = process.env.DB_PASS || '';

console.log(`[Database System] Initializing database connection pool...`);

let sequelize;
if (dbUrl) {
  console.log(`[Database System] Using DATABASE_URL connection string.`);
  sequelize = new Sequelize(dbUrl, {
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? (msg) => console.log(`[Sequelize]: ${msg}`) : false,
    define: {
      timestamps: true,
      underscored: true
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  console.log(`[Database System] Target Dialect: ${dialect.toUpperCase()} | Host: ${host}:${port} | Database: '${dbName}' | User: '${user}'`);
  const config = {
    host: host,
    port: port,
    username: user,
    password: pass,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? (msg) => console.log(`[Sequelize]: ${msg}`) : false,
    define: {
      timestamps: true,
      underscored: true
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  };
  sequelize = new Sequelize(dbName, user, pass, config);
}

module.exports = sequelize;
