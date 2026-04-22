const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSLMODE === 'disable' ? false : { rejectUnauthorized: false },
})

async function ensureNodeUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS node_users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(150) UNIQUE NOT NULL,
      email VARCHAR(254),
      password_hash TEXT NOT NULL,
      first_name VARCHAR(150) DEFAULT '',
      last_name VARCHAR(150) DEFAULT '',
      role VARCHAR(20) NOT NULL DEFAULT 'USER',
      date_joined TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
}

module.exports = { pool, ensureNodeUsersTable }
