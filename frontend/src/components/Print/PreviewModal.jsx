import { useEffect, useRef } from 'react'
import { X, Printer } from 'lucide-react'
import { MapContainer, TileLayer, GeoJSON, Marker, Tooltip, Polyline } from 'react-leaflet'
import L from 'leaflet'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import turfDistance from '@turf/distance'
import { point } from '@turf/helpers'
import 'leaflet/dist/leaflet.css'

function flattenCoordinates(coords, type) {
  if (!coords) return []
  if (type === 'Polygon') return coords[0] || []
  if (type === 'MultiPolygon') {
    return coords.flatMap(polygon => polygon[0] || [])
  }
  if (type === 'LineString') return coords
  if (type === 'Point') return [coords]
  return []
}

function getLetter(index) {
  let letter = ''
  let i = index
  while (i >= 0) {
    letter = String.fromCharCode((i % 26) + 65) + letter
    i = Math.floor(i / 26) - 1
  }
  return letter
}

function calculateDistances(coords) {
  const distances = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const pt1 = point(coords[i]);
    const pt2 = point(coords[i + 1]);
    const dist = turfDistance(pt1, pt2, { units: 'meters' });
    distances.push(dist);
  }
  return distances;
}

// Use proper iconSize/iconAnchor so Leaflet centers the icons natively —
// this avoids html2canvas misrendering the CSS translate3d + absolute offset combo.
const createPointIcon = (letter) => L.divIcon({
  className: 'custom-point-icon',
  html: `
    <div style="width: 30px; text-align: center; font-family: sans-serif; pointer-events: none;">
      <div style="font-weight: 900; color: #1e293b; font-size: 13px; text-shadow: 1.5px 1.5px 0 #fff, -1.5px 1.5px 0 #fff, 1.5px -1.5px 0 #fff, -1.5px -1.5px 0 #fff;">${letter}</div>
      <div style="width: 6px; height: 6px; background: #059669; border-radius: 50%; border: 1.5px solid #fff; margin: 1px auto 0;"></div>
    </div>
  `,
  iconSize: [30, 28],
  iconAnchor: [15, 28],
})

const createDistIcon = (text) => L.divIcon({
  className: 'custom-dist-icon',
  html: `
    <div style="width: 80px; text-align: center; pointer-events: none;">
      <span style="background: rgba(255,255,255,0.9); border: 1px solid #10b981; color: #065f46; font-family: monospace; font-weight: bold; font-size: 10px; padding: 2px 4px; border-radius: 4px; white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
        ${text}
      </span>
    </div>
  `,
  iconSize: [80, 20],
  iconAnchor: [40, 10],
})

export default function PreviewModal({ feature, onClose, titlePrefix = "Claim" }) {
  const mapRef = useRef(null)
  const printRef = useRef(null)

  // ── oklch → rgb conversion for html2canvas compatibility ──────
  // html2canvas parses raw CSS rules from stylesheets, and Tailwind v4
  // uses oklch() which html2canvas cannot parse. We temporarily replace
  // every stylesheet that contains oklch with a clone where all oklch
  // values are converted to rgba using the Canvas 2D pixel-readback trick.

  const prepareForCapture = () => {
    // Canvas 2D is the only reliable cross-browser oklch→rgb converter
    const cvs = document.createElement('canvas');
    cvs.width = 1; cvs.height = 1;
    const ctx = cvs.getContext('2d', { willReadFrequently: true });

    const oklchToRgba = (match) => {
      try {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillStyle = match;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        if (d[3] === 0) return 'transparent';
        return d[3] < 255
          ? `rgba(${d[0]},${d[1]},${d[2]},${(d[3] / 255).toFixed(3)})`
          : `rgb(${d[0]},${d[1]},${d[2]})`;
      } catch { return 'transparent'; }
    };

    const convertCss = (text) => text.replace(/oklch\([^)]*\)/gi, oklchToRgba);

    // 1) Replace stylesheets that contain oklch
    const fixedSheets = [];
    for (const sheet of [...document.styleSheets]) {
      try {
        if (!sheet.cssRules) continue;
        let css = '';
        for (const rule of sheet.cssRules) css += rule.cssText + '\n';
        if (!css.includes('oklch')) continue;

        sheet.disabled = true;
        const el = document.createElement('style');
        el.textContent = convertCss(css);
        el.dataset.oklchFix = '1';
        document.head.appendChild(el);
        fixedSheets.push({ orig: sheet, fix: el });
      } catch (e) { /* CORS – skip */ }
    }

    // 2) Fix inline styles on all elements
    const inlineFixed = [];
    const walkInline = (el) => {
      if (!(el instanceof HTMLElement)) return;
      const raw = el.getAttribute('style');
      if (raw && raw.includes('oklch')) {
        inlineFixed.push({ el, original: raw });
        el.setAttribute('style', convertCss(raw));
      }
      for (const child of el.children) walkInline(child);
    };
    walkInline(document.body);

    // Return a restore function
    return () => {
      for (const { orig, fix } of fixedSheets) {
        orig.disabled = false;
        fix.remove();
      }
      for (const { el, original } of inlineFixed) {
        el.setAttribute('style', original);
      }
    };
  };

  const handlePrint = async () => {
    if (!printRef.current) return
    
    const target = printRef.current;
    
    // Store original styles to restore after capture
    const originalOverflow = target.style.overflow;
    const originalHeight = target.style.height;
    const originalMaxHeight = target.style.maxHeight;
    let restoreColors = () => {};
    const hideDistStyle = document.createElement('style');
    hideDistStyle.textContent = '.custom-dist-icon, .custom-point-icon { display: none !important; }';

    try {
      // Temporarily expand scrollable container to full height
      target.style.overflow = 'visible';
      target.style.height = 'auto';
      target.style.maxHeight = 'none';

      // Replace oklch colors across ALL stylesheets so html2canvas can parse them
      restoreColors = prepareForCapture();

      // Hide distance/point labels on the map for print
      document.head.appendChild(hideDistStyle);

      // Force map to fit the full geometry at proper zoom before capture
      const map = mapRef.current;
      if (map) {
        map.invalidateSize();
        if (bounds.length > 1) {
          map.fitBounds(bounds, { padding: [30, 30] });
        }
        // Wait for map tiles to load
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const canvas = await html2canvas(target, {
        useCORS: true,
        scale: 2,
        logging: false,
        windowHeight: target.scrollHeight,
        scrollY: -window.scrollY
      })
      
      const imgData = canvas.toDataURL('image/png')
      
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      })

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
      pdf.save(`${feature.claim_code || feature.parcel_code || 'export'}.pdf`)
    } catch (err) {
      console.error('Failed to generate PDF', err)
      alert('Failed to generate PDF. Check console for details.')
    } finally {
      hideDistStyle.remove();
      restoreColors();
      target.style.overflow = originalOverflow;
      target.style.height = originalHeight;
      target.style.maxHeight = originalMaxHeight;
    }
  }

  const isDispute = titlePrefix === 'Dispute'

  // Calculate generic bounds for the feature to auto-zoom the map
  const coords = flattenCoordinates(feature?.geometry?.coordinates, feature?.geometry?.type)
  const bounds = coords.length > 0 ? coords.map(c => [c[1], c[0]]) : [[-18.93, 29.78]]

  // Exclude the redundant closing point of a GeoJSON polygon from labels
  const uniqueCoords = coords.length > 1 && coords[0][0] === coords[coords.length-1][0] && coords[0][1] === coords[coords.length-1][1] 
    ? coords.slice(0, -1) 
    : coords;
  
  const distances = calculateDistances(coords);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      {/* Modal Container */}
      <div 
        className="bg-white rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">
            {titlePrefix}: {feature.claim_code || feature.parcel_code}
          </h3>
          <div className="flex items-center gap-3">
            <button 
              onClick={handlePrint} 
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-500 transition-all"
            >
              <Printer size={16} /> Print PDF
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Area - Scrollable */}
        <div className="flex-1 overflow-y-auto p-8" ref={printRef}>
          <div className="max-w-3xl mx-auto space-y-6">
            
            {/* Title / Metadata */}
            <div className="border-b border-slate-200 pb-4">
              {isDispute ? (
                <>
                  <h1 className="text-3xl font-black text-red-700 mb-2 uppercase tracking-wide">
                    ⚠ Dispute Overlap Report
                  </h1>
                  <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-600">
                    <p><strong>Mine Claim:</strong> <span className="text-slate-800 font-bold">{feature.mine_claim_code || feature.claim_code}</span></p>
                    <p><strong>Farm Parcel:</strong> <span className="text-slate-800 font-bold">{feature.farm_parcel_code || '—'}</span></p>
                    <p><strong>Overlap Area:</strong> <span className="text-red-600 font-bold">{feature.conflict_area ? `${Number(feature.conflict_area).toFixed(4)} ha` : '—'}</span></p>
                    <p><strong>Status:</strong> <span className={`font-bold ${feature.status === 'OPEN' ? 'text-red-600' : 'text-emerald-600'}`}>{feature.status || '—'}</span></p>
                    <p><strong>Detected:</strong> {feature.detected_at ? new Date(feature.detected_at).toLocaleDateString() : '—'}</p>
                    <p><strong>CRS:</strong> <span className="text-emerald-700 font-bold">{feature.coordinate_system || 'WGS84'}</span></p>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-3xl font-black text-slate-800 mb-2 uppercase tracking-wide">
                    {titlePrefix} {feature.claim_code || feature.parcel_code} Map View
                  </h1>
                  <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-600">
                    <p><strong>Name:</strong> {feature.claim_name || feature.farm_name || '—'}</p>
                    <p><strong>Owner:</strong> {feature.owner_name || '—'}</p>
                    <p><strong>Status/Use:</strong> {feature.status || feature.land_use || '—'}</p>
                    <p><strong>Area:</strong> {feature.area || '—'} ha</p>
                    <p><strong>CRS:</strong> <span className="text-emerald-700 font-bold">{feature.coordinate_system || 'WGS84'}</span></p>
                  </div>
                </>
              )}
            </div>

            {/* Map Container */}
            {feature.geometry ? (
              <div className={`h-[400px] w-full bg-slate-100 rounded-xl overflow-hidden border-2 ${isDispute ? 'border-red-400' : 'border-slate-300'} relative z-10`}>
                <MapContainer 
                  bounds={bounds}
                  zoom={12}
                  className="h-full w-full"
                  zoomControl={true}
                  attributionControl={false}
                  ref={mapRef}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <GeoJSON 
                    data={feature.geometry} 
                    style={isDispute
                      ? { color: '#dc2626', weight: 3, fillOpacity: 0.50, fillColor: '#ef4444', dashArray: '6,4' }
                      : { color: '#059669', weight: 3, fillOpacity: 0.4 }
                    } 
                  />
                  {uniqueCoords.map((c, i) => (
                    <Marker key={`marker-${i}`} position={[c[1], c[0]]} icon={createPointIcon(getLetter(i))} />
                  ))}
                  {coords.map((c, i) => {
                    if (i === coords.length - 1) return null;
                    const nextC = coords[i + 1];
                    const midPoint = [(c[1] + nextC[1]) / 2, (c[0] + nextC[0]) / 2];
                    const distText = Math.round(distances[i]) + ' m';
                    return (
                      <Marker key={`dist-${i}`} position={midPoint} icon={createDistIcon(distText)} />
                    )
                  })}
                </MapContainer>
              </div>
            ) : (
              <div className="p-10 text-center bg-slate-100 rounded-xl border border-dashed border-slate-300 italic text-slate-500">
                No reliable geometry stored for this entity.
              </div>
            )}

            {/* Coordinates Table */}
            {coords.length > 0 && (
              <div className="mt-8">
                <h4 className="text-lg font-bold text-slate-800 mb-3 block">
                  {isDispute ? 'Overlap Boundary' : 'Boundary Coordinates'} ({feature.coordinate_system || 'WGS84'})
                </h4>
                <div className={`border rounded-lg p-4 ${isDispute ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className={`border-b ${isDispute ? 'border-red-300 text-red-700' : 'border-slate-300 text-slate-600'}`}>
                        <th className="py-2 font-semibold">Point</th>
                        <th className="py-2 font-semibold">Longitude (X)</th>
                        <th className="py-2 font-semibold">Latitude (Y)</th>
                        <th className="py-2 font-semibold text-right">Distance to next</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDispute ? 'divide-red-200' : 'divide-slate-200'}`}>
                      {uniqueCoords.map((c, i) => {
                        const nextDist = distances[i];
                        return (
                          <tr key={i} className={isDispute ? 'text-red-800' : 'text-slate-700'}>
                            <td className="py-1.5 font-bold">{getLetter(i)}</td>
                            <td className="py-1.5 font-mono">{c[0].toFixed(6)}</td>
                            <td className="py-1.5 font-mono">{c[1].toFixed(6)}</td>
                            <td className={`py-1.5 font-mono text-right ${isDispute ? 'text-red-600' : 'text-emerald-600'}`}>
                              {nextDist ? `${Math.round(nextDist)} m` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                      {/* Last connecting line to close polygon */}
                      {coords.length > uniqueCoords.length && distances[uniqueCoords.length] && (
                        <tr className={`${isDispute ? 'text-red-500 bg-red-100/50' : 'text-slate-500 bg-slate-100/50'}`}>
                          <td className="py-1.5 font-bold italic">{getLetter(uniqueCoords.length - 1)} → A</td>
                          <td className="py-1.5 font-mono italic" colSpan="2">Polygon closure</td>
                          <td className={`py-1.5 font-mono text-right ${isDispute ? 'text-red-600' : 'text-emerald-600'}`}>
                            {Math.round(distances[uniqueCoords.length])} m
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>
        
      </div>
    </div>
  )
}
