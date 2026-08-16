const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gym_db',
  port: Number(process.env.DB_PORT) || 4000,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  // 🔒 Required for TiDB Cloud Serverless SSL
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
});

// Self-healing test connection
pool.getConnection()
  .then((conn) => {
    console.log('✅ Connected securely to TiDB Cloud via TLS/SSL');
    conn.release();
  })
  .catch((err) => {
    console.error('❌ Database Connection Error:', err.message);
  });

module.exports = pool;