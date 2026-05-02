const express = require('express')
const router = express.Router()
const multer = require('multer')
const fs = require('fs')
const { DOMParser } = require('@xmldom/xmldom')
const toGeoJSON = require('@tmcw/togeojson')
const { pool } = require('../config/db')

const upload = multer({ dest: 'uploads/' })

// GET all trig stations
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        name,
        description,
        ST_AsGeoJSON(geom)::json AS geometry
      FROM spatial_data_trigstation
      -- Tight bounding box around core Kwekwe mining area
      WHERE geom && ST_MakeEnvelope(29.55, -19.15, 29.95, -18.75, 4326)
      LIMIT 20
    `)
    
    const features = result.rows.map(row => ({
      type: 'Feature',
      id: row.id,
      properties: { name: row.name, description: row.description },
      geometry: row.geometry
    }))

    res.json({
      type: 'FeatureCollection',
      features
    })
  } catch (error) {
    console.error('Error fetching trig stations:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST upload KML
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  
  try {
    // 1. Read & parse KML
    const kmlText = fs.readFileSync(req.file.path, 'utf8')
    const kmlDoc = new DOMParser().parseFromString(kmlText, 'text/xml')
    const geojson = toGeoJSON.kml(kmlDoc)
    
    // 2. Filter for points
    const points = geojson.features.filter(f => f.geometry && f.geometry.type === 'Point')
    if (points.length === 0) {
      return res.status(400).json({ error: 'No Point geometries found in the uploaded KML.' })
    }

    // 3. Clear existing (optional, but typical for "importing a dataset" replacing old)
    // Actually, usually we just want to clear so we don't duplicate. Let's clear it first.
    await pool.query('TRUNCATE TABLE spatial_data_trigstation RESTART IDENTITY')

    // 4. Insert into DB in batches
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

    res.json({ message: `Successfully imported ${insertedCount} trig stations.` })
  } catch (error) {
    console.error('Error parsing/uploading KML:', error)
    res.status(500).json({ error: 'Failed to process KML file' })
  } finally {
    // Clean up uploaded file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
  }
})

// DELETE a trig station by ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query('DELETE FROM spatial_data_trigstation WHERE id = $1', [id])
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Trig station not found' })
    }
    res.json({ message: 'Trig station deleted successfully' })
  } catch (error) {
    console.error('Error deleting trig station:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
