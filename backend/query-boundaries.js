require('dotenv').config()
const { pool } = require('./src/config/db')
async function test() {
  const { rows } = await pool.query("SELECT name FROM spatial_data_boundary")
  console.log("Boundaries:", rows.map(r => r.name))
  process.exit(0)
}
test()
