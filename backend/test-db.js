require('dotenv').config()
const { pool } = require('./src/config/db')
async function test() {
  try {
    await pool.query(
      "INSERT INTO spatial_data_trigstation (name, geom) VALUES ('Test 3D', ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON('{\"type\":\"Point\",\"coordinates\":[29.7,-18.9,1200]}'), 4326)));"
    )
    console.log("Success")
  } catch (e) {
    console.error("Error:", e.message)
  }
  process.exit(0)
}
test()
