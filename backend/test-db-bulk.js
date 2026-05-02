require('dotenv').config()
const fs = require('fs')
const { DOMParser } = require('@xmldom/xmldom')
const toGeoJSON = require('@tmcw/togeojson')
const { pool } = require('./src/config/db')

async function test() {
  try {
    const kmlText = fs.readFileSync('/home/success/gismineclaim/1_NRT_Point_Group.kml', 'utf8')
    const kmlDoc = new DOMParser().parseFromString(kmlText, 'text/xml')
    const geojson = toGeoJSON.kml(kmlDoc)
    const points = geojson.features.filter(f => f.geometry && f.geometry.type === 'Point')
    
    await pool.query('TRUNCATE TABLE spatial_data_trigstation RESTART IDENTITY')

    let insertedCount = 0
    const BATCH_SIZE = 1000

    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE)
      const values = []
      const flatParams = []
      
      batch.forEach((p, index) => {
        const name = p.properties?.name || 'Unknown Trig Station'
        const description = p.properties?.description || null
        const geomJson = JSON.stringify(p.geometry)
        const offset = index * 3
        values.push(`($${offset + 1}, $${offset + 2}, ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($${offset + 3}), 4326)))`)
        flatParams.push(name, description, geomJson)
      })

      const query = `
        INSERT INTO spatial_data_trigstation (name, description, geom)
        VALUES ${values.join(', ')}
      `
      await pool.query(query, flatParams)
      insertedCount += batch.length
    }
    console.log("Success! Inserted", insertedCount)
  } catch (e) {
    console.error("Error:", e.message)
  }
  process.exit(0)
}
test()
