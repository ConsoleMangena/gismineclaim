require('dotenv').config()
const { pool } = require('./src/config/db')
async function run() {
  const all = await pool.query("SELECT COUNT(*)::int AS c FROM spatial_data_trigstation")
  const kwekwe = await pool.query("SELECT COUNT(*)::int AS c FROM spatial_data_trigstation WHERE geom && ST_MakeEnvelope(29.4, -19.3, 30.1, -18.5, 4326)")
  console.log("Total in DB:", all.rows[0].c)
  console.log("In Kwekwe bbox:", kwekwe.rows[0].c)
  process.exit(0)
}
run()
