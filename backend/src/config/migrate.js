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

-- Hotspots
CREATE TABLE IF NOT EXISTS disputes_hotspot (
  id BIGSERIAL PRIMARY KEY,
  intensity DOUBLE PRECISION,
  dispute_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geom geometry(Polygon, 4326)
);

-- Spatial indexes
CREATE INDEX IF NOT EXISTS idx_mineclaim_geom ON spatial_data_mineclaim USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_farmparcel_geom ON spatial_data_farmparcel USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_boundary_geom ON spatial_data_boundary USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_dispute_geom ON disputes_dispute USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_hotspot_geom ON disputes_hotspot USING GIST (geom);
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

async function seedKwekweData() {
  const existing = await pool.query('SELECT COUNT(*)::int AS c FROM spatial_data_owner')
  if (existing.rows[0].c > 0) {
    console.log('ℹ️  Sample data already exists, skipping seed.')
    return
  }

  console.log('Seeding Kwekwe sample data...')

  // ─── Owners ────────────────────────────────────────────────────
  const owners = await pool.query(`
    INSERT INTO spatial_data_owner (name, national_id, phone, email, address) VALUES
      ('Tendai Moyo',       '29-123456A78', '+263 771 234 567', 'tendai.moyo@gmail.com',     '12 Robert Mugabe Way, Kwekwe'),
      ('Grace Sibanda',     '29-234567B89', '+263 772 345 678', 'grace.sibanda@yahoo.com',   '45 Harare Rd, Kwekwe'),
      ('Tapiwa Ncube',      '29-345678C90', '+263 773 456 789', 'tapiwa.ncube@outlook.com',  'Stand 78, Mbizo Township, Kwekwe'),
      ('Rumbidzai Chikore', '29-456789D01', '+263 774 567 890', 'rchikore@minecorp.co.zw',   'Farm Lot 3, Kwekwe Rural'),
      ('Blessing Maphosa',  '29-567890E12', '+263 775 678 901', 'blessing.m@agrimail.co.zw', 'Plot 22, Sebakwe, Kwekwe'),
      ('Farai Dzimba',      '29-678901F23', '+263 776 789 012', 'farai.dzimba@gmail.com',    '9 Fifth Street, Kwekwe'),
      ('Nyasha Mutendi',    '29-789012G34', '+263 777 890 123', 'nyasha.m@farmmail.co.zw',   'Patchway Farm, Kwekwe'),
      ('Chenai Gumbo',      '29-890123H45', '+263 778 901 234', 'chenai.g@goldmine.co.zw',   '3 Globe & Phoenix Rd, Kwekwe')
    RETURNING id
  `)
  const oid = owners.rows.map(r => Number(r.id))

  // ─── Mine Claims (Kwekwe is a major gold & chrome belt) ────────
  // Coordinates centred around Kwekwe: lat ~-18.93, lng ~29.82
  // Owner IDs are interpolated directly because the node-pg driver cannot
  // resolve parameterised types in multi-row VALUES with PostGIS functions.
  await pool.query(`
    INSERT INTO spatial_data_mineclaim
      (claim_code, claim_name, claim_reg_no, mine_type, owner_id, area, status, district, surveyed_date, surveyor, coordinate_system, geom)
    VALUES
      ('MC-KWE-001', 'Globe & Phoenix Gold',   'REG/2023/0451', 'Gold',     ${oid[0]}, 125.50, 'ACTIVE',   'Kwekwe', '2023-06-15', 'J. Mapuranga (SG)',  'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.810,-18.920],[29.820,-18.920],[29.820,-18.930],[29.810,-18.930],[29.810,-18.920]]]}'), 4326)),

      ('MC-KWE-002', 'Doris Gold Claim',       'REG/2023/0452', 'Gold',     ${oid[1]}, 87.30,  'ACTIVE',   'Kwekwe', '2023-08-22', 'T. Chigumba (SG)',  'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.825,-18.935],[29.838,-18.935],[29.838,-18.945],[29.825,-18.945],[29.825,-18.935]]]}'), 4326)),

      ('MC-KWE-003', 'Indarama Chrome',        'REG/2024/0078', 'Chrome',   ${oid[2]}, 210.00, 'ACTIVE',   'Kwekwe', '2024-01-10', 'R. Nkomo (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.790,-18.905],[29.808,-18.905],[29.808,-18.918],[29.790,-18.918],[29.790,-18.905]]]}'), 4326)),

      ('MC-KWE-004', 'Sebakwe Gold',           'REG/2022/0310', 'Gold',     ${oid[3]}, 56.80,  'EXPIRED',  'Kwekwe', '2022-03-05', 'J. Mapuranga (SG)',  'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.845,-18.950],[29.855,-18.950],[29.855,-18.958],[29.845,-18.958],[29.845,-18.950]]]}'), 4326)),

      ('MC-KWE-005', 'Zim Alloys Block A',     'REG/2024/0112', 'Chrome',   ${oid[7]}, 340.00, 'ACTIVE',   'Kwekwe', '2024-04-18', 'S. Moyo (SG)',      'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.770,-18.910],[29.795,-18.910],[29.795,-18.928],[29.770,-18.928],[29.770,-18.910]]]}'), 4326)),

      ('MC-KWE-006', 'Munyati Gold Reef',      'REG/2023/0599', 'Gold',     ${oid[5]}, 98.20,  'DISPUTED', 'Kwekwe', '2023-11-02', 'T. Chigumba (SG)',  'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.835,-18.915],[29.848,-18.915],[29.848,-18.928],[29.835,-18.928],[29.835,-18.915]]]}'), 4326)),

      ('MC-KWE-007', 'Patchway Nickel',        'REG/2024/0203', 'Nickel',   ${oid[6]}, 175.00, 'ACTIVE',   'Kwekwe', '2024-02-28', 'R. Nkomo (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.800,-18.940],[29.818,-18.940],[29.818,-18.955],[29.800,-18.955],[29.800,-18.940]]]}'), 4326)),

      ('MC-KWE-008', 'Ripple Creek Gold',      'REG/2024/0301', 'Gold',     ${oid[0]}, 63.40,  'ACTIVE',   'Kwekwe', '2024-06-10', 'S. Moyo (SG)',      'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.815,-18.960],[29.828,-18.960],[29.828,-18.970],[29.815,-18.970],[29.815,-18.960]]]}'), 4326)),

      ('MC-KWE-009', 'Kadoma Gold Extension',  'REG/2024/0415', 'Gold',     ${oid[3]}, 145.00, 'DISPUTED', 'Kwekwe', '2024-08-05', 'J. Mapuranga (SG)', 'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.860,-18.910],[29.878,-18.910],[29.878,-18.925],[29.860,-18.925],[29.860,-18.910]]]}'), 4326)),

      ('MC-KWE-010', 'Zhombe Chrome Claim',    'REG/2024/0520', 'Chrome',   ${oid[4]}, 190.00, 'DISPUTED', 'Kwekwe', '2024-09-12', 'R. Nkomo (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.750,-18.940],[29.772,-18.940],[29.772,-18.958],[29.750,-18.958],[29.750,-18.940]]]}'), 4326)),

      ('MC-KWE-011', 'Silobela Lithium',       'REG/2024/0633', 'Lithium',  ${oid[7]}, 220.00, 'DISPUTED', 'Kwekwe', '2024-10-20', 'T. Chigumba (SG)', 'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.780,-18.970],[29.800,-18.970],[29.800,-18.988],[29.780,-18.988],[29.780,-18.970]]]}'), 4326))
  `)

  // ─── Farm Parcels (around Kwekwe farming areas) ────────────────
  await pool.query(`
    INSERT INTO spatial_data_farmparcel
      (parcel_code, farm_name, deed_no, lease_type, owner_id, land_use, area, survey_date, surveyor, coordinate_system, geom)
    VALUES
      ('FP-KWE-001', 'Doongwai Farm',     'DEED/2020/KWE/001', 'Title Deed',   ${oid[3]}, 'Mixed farming',    450.00, '2020-05-12', 'P. Banda (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.820,-18.925],[29.840,-18.925],[29.840,-18.940],[29.820,-18.940],[29.820,-18.925]]]}'), 4326)),

      ('FP-KWE-002', 'Sherwood Farm',     'DEED/2019/KWE/045', 'Title Deed',   ${oid[4]}, 'Cattle ranching',  820.00, '2019-09-30', 'J. Mapuranga (SG)', 'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.790,-18.945],[29.815,-18.945],[29.815,-18.965],[29.790,-18.965],[29.790,-18.945]]]}'), 4326)),

      ('FP-KWE-003', 'Sebakwe Ranch',     'OL/2021/KWE/012',   'Offer Letter', ${oid[4]}, 'Cattle ranching',  600.00, '2021-02-18', 'T. Chigumba (SG)', 'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.840,-18.948],[29.860,-18.948],[29.860,-18.962],[29.840,-18.962],[29.840,-18.948]]]}'), 4326)),

      ('FP-KWE-004', 'Mbizo Crop Plot',   'LEASE/2022/KWE/003','Lease',        ${oid[2]}, 'Crop farming',     35.00,  '2022-07-01', 'R. Nkomo (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.828,-18.932],[29.836,-18.932],[29.836,-18.938],[29.828,-18.938],[29.828,-18.932]]]}'), 4326)),

      ('FP-KWE-005', 'Patchway Estate',   'DEED/2018/KWE/078', 'Title Deed',   ${oid[6]}, 'Tobacco & maize',  520.00, '2018-11-15', 'P. Banda (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.798,-18.935],[29.820,-18.935],[29.820,-18.950],[29.798,-18.950],[29.798,-18.935]]]}'), 4326)),

      ('FP-KWE-006', 'Munyati Irrigation','OL/2023/KWE/021',   'Offer Letter', ${oid[5]}, 'Irrigated crops',  280.00, '2023-03-20', 'S. Moyo (SG)',      'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.830,-18.910],[29.850,-18.910],[29.850,-18.925],[29.830,-18.925],[29.830,-18.910]]]}'), 4326)),

      ('FP-KWE-007', 'Kadoma Estates',    'DEED/2021/KWE/092', 'Title Deed',   ${oid[1]}, 'Mixed farming',    380.00, '2021-06-10', 'P. Banda (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.855,-18.908],[29.880,-18.908],[29.880,-18.922],[29.855,-18.922],[29.855,-18.908]]]}'), 4326)),

      ('FP-KWE-008', 'Zhombe Grazing',    'OL/2022/KWE/035',   'Offer Letter', ${oid[6]}, 'Cattle ranching',  710.00, '2022-04-25', 'R. Nkomo (SG)',     'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.748,-18.938],[29.775,-18.938],[29.775,-18.960],[29.748,-18.960],[29.748,-18.938]]]}'), 4326)),

      ('FP-KWE-009', 'Silobela Farmlands','LEASE/2023/KWE/018','Lease',        ${oid[2]}, 'Crop farming',     430.00, '2023-08-15', 'S. Moyo (SG)',      'WGS84',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.775,-18.968],[29.805,-18.968],[29.805,-18.990],[29.775,-18.990],[29.775,-18.968]]]}'), 4326))
  `)

  // ─── Disputes (overlapping claim & farm) ───────────────────────
  // MC-KWE-006 (Munyati Gold Reef) overlaps FP-KWE-006 (Munyati Irrigation)
  // MC-KWE-002 (Doris Gold) overlaps FP-KWE-004 (Mbizo Crop Plot)
  await pool.query(`
    INSERT INTO disputes_dispute (mine_claim_id, farm_parcel_id, conflict_area, status, detected_at, geom)
    SELECT mc.id, fp.id, 42.50, 'OPEN', '2024-05-15',
      ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.835,-18.915],[29.848,-18.915],[29.848,-18.925],[29.835,-18.925],[29.835,-18.915]]]}'), 4326)
    FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
    WHERE mc.claim_code = 'MC-KWE-006' AND fp.parcel_code = 'FP-KWE-006'
  `)

  await pool.query(`
    INSERT INTO disputes_dispute (mine_claim_id, farm_parcel_id, conflict_area, status, detected_at, geom)
    SELECT mc.id, fp.id, 12.80, 'OPEN', '2024-07-02',
      ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.828,-18.935],[29.836,-18.935],[29.836,-18.938],[29.828,-18.938],[29.828,-18.935]]]}'), 4326)
    FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
    WHERE mc.claim_code = 'MC-KWE-002' AND fp.parcel_code = 'FP-KWE-004'
  `)

  await pool.query(`
    INSERT INTO disputes_dispute (mine_claim_id, farm_parcel_id, conflict_area, status, detected_at, resolved_at, geom)
    SELECT mc.id, fp.id, 28.10, 'RESOLVED', '2023-12-01', '2024-03-15',
      ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.800,-18.940],[29.818,-18.940],[29.818,-18.950],[29.800,-18.950],[29.800,-18.940]]]}'), 4326)
    FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
    WHERE mc.claim_code = 'MC-KWE-007' AND fp.parcel_code = 'FP-KWE-005'
  `)

  // MC-KWE-009 (Kadoma Gold Extension) overlaps FP-KWE-007 (Kadoma Estates)
  await pool.query(`
    INSERT INTO disputes_dispute (mine_claim_id, farm_parcel_id, conflict_area, status, detected_at, geom)
    SELECT mc.id, fp.id, 55.30, 'OPEN', '2024-08-20',
      ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.860,-18.910],[29.878,-18.910],[29.878,-18.922],[29.860,-18.922],[29.860,-18.910]]]}'), 4326)
    FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
    WHERE mc.claim_code = 'MC-KWE-009' AND fp.parcel_code = 'FP-KWE-007'
  `)

  // MC-KWE-010 (Zhombe Chrome Claim) overlaps FP-KWE-008 (Zhombe Grazing)
  await pool.query(`
    INSERT INTO disputes_dispute (mine_claim_id, farm_parcel_id, conflict_area, status, detected_at, geom)
    SELECT mc.id, fp.id, 38.70, 'OPEN', '2024-09-28',
      ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.750,-18.940],[29.772,-18.940],[29.772,-18.958],[29.750,-18.958],[29.750,-18.940]]]}'), 4326)
    FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
    WHERE mc.claim_code = 'MC-KWE-010' AND fp.parcel_code = 'FP-KWE-008'
  `)

  // MC-KWE-011 (Silobela Lithium) overlaps FP-KWE-009 (Silobela Farmlands)
  await pool.query(`
    INSERT INTO disputes_dispute (mine_claim_id, farm_parcel_id, conflict_area, status, detected_at, geom)
    SELECT mc.id, fp.id, 72.40, 'OPEN', '2024-11-05',
      ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[29.780,-18.970],[29.800,-18.970],[29.800,-18.988],[29.780,-18.988],[29.780,-18.970]]]}'), 4326)
    FROM spatial_data_mineclaim mc, spatial_data_farmparcel fp
    WHERE mc.claim_code = 'MC-KWE-011' AND fp.parcel_code = 'FP-KWE-009'
  `)

  console.log('✅ Kwekwe sample data seeded: 8 owners, 11 mine claims, 9 farm parcels, 6 disputes')
}

async function migrate() {
  console.log('Running migrations...')
  await ensureNodeUsersTable()
  await pool.query(CREATE_ALL)
  await seedAdmin()
  await seedKwekweData()
  console.log('✅ All tables, indexes, and seed data ready.')
  await pool.end()
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
