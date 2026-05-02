require('dotenv').config()
const { pool } = require('./src/config/db')
async function run() {
  // Pick 4 well-spaced trigs around Kwekwe area
  // 100/Q (central), 152/T (north), 158/T (south-east), 161/T (south-west)
  const keepIds = [457, 612, 627, 636]
  
  const result = await pool.query(
    `DELETE FROM spatial_data_trigstation WHERE id NOT IN (${keepIds.join(',')})`
  )
  console.log("Deleted", result.rowCount, "trig stations")
  
  const remaining = await pool.query("SELECT id, name FROM spatial_data_trigstation ORDER BY name")
  console.log("Remaining:", remaining.rows.map(r => `${r.name} (id=${r.id})`))
  process.exit(0)
}
run()
