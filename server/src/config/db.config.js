const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const dialect = process.env.DB_DIALECT || 'mysql';
const host = process.env.DB_HOST || '127.0.0.1';
const port = parseInt(process.env.DB_PORT) || 3306;
const dbName = process.env.DB_NAME || 'sms_db';
const user = process.env.DB_USER || 'root';
const pass = process.env.DB_PASS || '';

console.log(`[Database System] Initializing database connection pool...`);
console.log(`[Database System] Target Dialect: ${dialect.toUpperCase()} | Host: ${host}:${port} | Database: '${dbName}' | User: '${user}'`);

if (dialect !== 'mysql') {
  console.warn(`[Database Warning] DB_DIALECT is set to '${dialect}'. Enforcing MySQL as single source of truth...`);
}

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

const sequelize = new Sequelize(dbName, user, pass, config);

module.exports = sequelize;
