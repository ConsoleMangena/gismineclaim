require('dotenv').config()
const { pool } = require('./src/config/db')
async function test() {
  try {
    await pool.query("ALTER TABLE spatial_data_trigstation ADD COLUMN IF NOT EXISTS description TEXT;")
    console.log("Success")
  } catch (e) {
    console.error("Error:", e.message)
  }
  process.exit(0)
}
test()
