const dotenv = require('dotenv')
dotenv.config()

const { pool, ensureNodeUsersTable } = require('./db')

// ─── CREATE from scratch ─────────────────────────────────────────
const CREATE_ALL = `
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Owners
CREATE TABLE IF NOT EXISTS spatial_data_owner (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  national_id VARCHAR(50) UNIQUE NOT NULL,
  phone VARCHAR(30) DEFAULT '',
  email VARCHAR(254) DEFAULT '',
  address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mine Claims
CREATE TABLE IF NOT EXISTS spatial_data_mineclaim (
  id BIGSERIAL PRIMARY KEY,
  claim_code VARCHAR(100) UNIQUE NOT NULL,
  claim_name VARCHAR(255) DEFAULT '',
  claim_reg_no VARCHAR(100) DEFAULT '',
  mine_type VARCHAR(100) DEFAULT '',
  owner_id BIGINT NOT NULL REFERENCES spatial_data_owner(id) ON DELETE CASCADE,
  area DOUBLE PRECISION,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  district VARCHAR(150) DEFAULT '',
  surveyed_date DATE,
  surveyor VARCHAR(255) DEFAULT '',
  coordinate_system VARCHAR(50) DEFAULT 'WGS84',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geom geometry(Geometry, 4326)
);

-- Farm Parcels
CREATE TABLE IF NOT EXISTS spatial_data_farmparcel (
  id BIGSERIAL PRIMARY KEY,
  parcel_code VARCHAR(100) UNIQUE NOT NULL,
  farm_name VARCHAR(255) DEFAULT '',
  deed_no VARCHAR(100) DEFAULT '',
  lease_type VARCHAR(50) DEFAULT '',
  owner_id BIGINT NOT NULL REFERENCES spatial_data_owner(id) ON DELETE CASCADE,
  land_use VARCHAR(100) DEFAULT '',
  area DOUBLE PRECISION,
  survey_date DATE,
  surveyor VARCHAR(255) DEFAULT '',
  coordinate_system VARCHAR(50) DEFAULT 'WGS84',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geom geometry(Geometry, 4326)
);

-- Boundaries
CREATE TABLE IF NOT EXISTS spatial_data_boundary (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  boundary_type VARCHAR(100) NOT NULL,
  geom geometry(MultiPolygon, 4326)
);

-- Disputes
CREATE TABLE IF NOT EXISTS disputes_dispute (
  id BIGSERIAL PRIMARY KEY,
  mine_claim_id BIGINT NOT NULL REFERENCES spatial_data_mineclaim(id) ON DELETE CASCADE,
  farm_parcel_id BIGINT NOT NULL REFERENCES spatial_data_farmparcel(id) ON DELETE CASCADE,
  conflict_area DOUBLE PRECISION,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  geom geometry(Polygon, 4326)
);

-- Mine-to-Mine Disputes
CREATE TABLE IF NOT EXISTS disputes_mine_mine (
  id BIGSERIAL PRIMARY KEY,
  mine_claim_a_id BIGINT NOT NULL REFERENCES spatial_data_mineclaim(id) ON DELETE CASCADE,
  mine_claim_b_id BIGINT NOT NULL REFERENCES spatial_data_mineclaim(id) ON DELETE CASCADE,
  conflict_area DOUBLE PRECISION,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  geom geometry(Polygon, 4326)
);

-- Hotspots
CREATE TABLE IF NOT EXISTS disputes_hotspot (
  id BIGSERIAL PRIMARY KEY,
  intensity DOUBLE PRECISION,
  dispute_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geom geometry(Polygon, 4326)
);

-- Trig Stations
CREATE TABLE IF NOT EXISTS spatial_data_trigstation (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  geom geometry(Point, 4326)
);

-- Spatial indexes
CREATE INDEX IF NOT EXISTS idx_mineclaim_geom ON spatial_data_mineclaim USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_farmparcel_geom ON spatial_data_farmparcel USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_boundary_geom ON spatial_data_boundary USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_dispute_geom ON disputes_dispute USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_mine_mine_dispute_geom ON disputes_mine_mine USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_hotspot_geom ON disputes_hotspot USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_trigstation_geom ON spatial_data_trigstation USING GIST (geom);
`

async function seedAdmin() {
  const bcrypt = require('bcryptjs')
  const existing = await pool.query("SELECT id FROM node_users WHERE username = 'admin' LIMIT 1")
  if (existing.rowCount > 0) {
    console.log('ℹ️  Admin user already exists, skipping seed.')
    return
  }
  const hash = await bcrypt.hash('admin1234', 12)
  await pool.query(
    `INSERT INTO node_users (username, email, password_hash, first_name, last_name, role)
     VALUES ('admin', 'admin@gismineclaim.co.zw', $1, 'System', 'Admin', 'ADMIN')`,
    [hash]
  )
  console.log('✅ Admin user created — username: admin / password: admin1234')

  // Seed a regular user account
  const userHash = await bcrypt.hash('user1234', 12)
  await pool.query(
    `INSERT INTO node_users (username, email, password_hash, first_name, last_name, role)
     VALUES ('user', 'user@gismineclaim.co.zw', $1, 'Test', 'User', 'USER')
     ON CONFLICT (username) DO NOTHING`,
    [userHash]
  )
  console.log('✅ Test user created — username: user / password: user1234')
}



async function migrate() {
  console.log('Running migrations...')
  await ensureNodeUsersTable()
  await pool.query(CREATE_ALL)
  await seedAdmin()
  console.log('✅ All tables and indexes ready.')
  await pool.end()
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
