require('dotenv').config()
const { pool } = require('./src/config/db')
async function test() {
  const { rows } = await pool.query(`
    SELECT id, name, ST_X(geom) AS lon, ST_Y(geom) AS lat
    FROM spatial_data_trigstation
    WHERE geom && ST_MakeEnvelope(29.4, -19.3, 30.1, -18.5, 4326)
    ORDER BY name
    LIMIT 30
  `)
  console.log("Total in Kwekwe bbox:", rows.length, "(showing first 30)")
  rows.forEach(r => console.log(`  id=${r.id}  name=${r.name}  lon=${r.lon}  lat=${r.lat}`))
  
  const total = await pool.query("SELECT COUNT(*)::int AS c FROM spatial_data_trigstation WHERE geom && ST_MakeEnvelope(29.4, -19.3, 30.1, -18.5, 4326)")
  console.log("Total count in Kwekwe:", total.rows[0].c)
  process.exit(0)
}
test()
