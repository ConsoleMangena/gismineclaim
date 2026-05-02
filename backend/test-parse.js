const fs = require('fs')
const { DOMParser } = require('@xmldom/xmldom')
const toGeoJSON = require('@tmcw/togeojson')

try {
  console.log("Reading file...")
  const kmlText = fs.readFileSync('/home/success/gismineclaim/1_NRT_Point_Group.kml', 'utf8')
  console.log("File size:", kmlText.length)
  console.log("Parsing XML...")
  const kmlDoc = new DOMParser().parseFromString(kmlText, 'text/xml')
  console.log("Converting to GeoJSON...")
  const geojson = toGeoJSON.kml(kmlDoc)
  console.log("Points:", geojson.features.filter(f => f.geometry && f.geometry.type === 'Point').length)
} catch (e) {
  console.error("Error:", e)
}
