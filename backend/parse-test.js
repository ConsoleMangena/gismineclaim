const fs = require('fs')
const { DOMParser } = require('@xmldom/xmldom')
const toGeoJSON = require('@tmcw/togeojson')

const kmlText = fs.readFileSync('/home/success/gismineclaim/1_NRT_Point_Group.kml', 'utf8')
const kmlDoc = new DOMParser().parseFromString(kmlText, 'text/xml')
const geojson = toGeoJSON.kml(kmlDoc)
const points = geojson.features.filter(f => f.geometry && f.geometry.type === 'Point')
console.log(JSON.stringify(points[0], null, 2))
