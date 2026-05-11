/* ══════════════════════════════════════════
   calibration.js — Kompass-Kalibrierungs-Flow

   Ablauf:
   1. User öffnet "Kompass kalibrieren" im Home-Menü
   2. Screen "s-cal-snap": Kamera + Fadenkreuz + SNAP-Knopf
      → user visiert einen festen Bezugspunkt an und drückt SNAP
      → wir speichern: Snap-GPS, Snap-Heading (Roh, ohne bisherigen Offset)
   3. Screen "s-cal-map": Leaflet-Karte zentriert auf User-Position
      → user tippt auf der Karte den ECHTEN Standort des Bezugspunkts an
      → wir berechnen die Wahre Bearing von User-Position zu Tap-Position
   4. Offset = Snap-Heading - Wahre Bearing  (signiert, modulo 360)
   5. localStorage speichern, Bestätigung, zurück ins Menü.

   Wichtig: Roh-Heading (ohne bisherigen Offset) wird beim Snap genommen,
   damit aufeinanderfolgende Kalibrierungen sich nicht aufaddieren.
   ══════════════════════════════════════════ */

let _calSnap     = null;   // { lat, lon, heading } vom Bezugspunkt-Snap
let _calMap      = null;   // Leaflet-Map-Instanz
let _calMapTap   = null;   // { lat, lon } vom Karten-Tap
let _calTapMarker = null;  // L.marker für die Tap-Position
let _calSelfMarker = null; // L.marker für die User-Position
let _calLineLayer  = null; // L.polyline zwischen self und tap

// ── EINSTIEGSPUNKT ───────────────────────
function openCalibration() {
  // Status aktualisieren (falls schon kalibriert wurde)
  refreshCalibrationStatus();

  // Direkt in den Snap-Screen
  startCalibration();
}

function refreshCalibrationStatus() {
  const el = document.getElementById('calStatus');
  if (!el) return;
  const info = (typeof getCompassOffsetInfo === 'function') ? getCompassOffsetInfo() : null;
  if (info && typeof info.degrees === 'number') {
    const sign = info.degrees >= 0 ? '+' : '';
    const date = info.date ? new Date(info.date).toLocaleDateString('de-DE') : '?';
    el.textContent = 'Versatz ' + sign + info.degrees.toFixed(1) + '° (kalibriert ' + date + ')';
  } else {
    el.textContent = 'noch nicht kalibriert';
  }
}

async function startCalibration() {
  // Sensor- und Kamera-Permissions
  if (typeof requestOri === 'function') await requestOri();

  // Aus dem Home-Untermenü raus, in den Snap-Screen rein
  const h = document.getElementById('s-home');
  if (h) h.classList.remove('on');
  const cs = document.getElementById('s-cal-snap');
  if (cs) cs.classList.add('on');

  // Kamera an
  if (typeof attachCam === 'function') await attachCam('vid-cal');

  _calSnap   = null;
  _calMapTap = null;
}

function cancelCalibration() {
  // Snap-Screen
  const cs = document.getElementById('s-cal-snap');
  if (cs) cs.classList.remove('on');
  if (typeof detachCam === 'function') detachCam('vid-cal');

  // Map-Screen
  const cm = document.getElementById('s-cal-map');
  if (cm) cm.classList.remove('on');
  // Map aufräumen, damit beim nächsten Mal frisch initialisiert wird
  if (_calMap) {
    _calMap.remove();
    _calMap = null;
  }
  _calTapMarker = null;
  _calSelfMarker = null;
  _calLineLayer  = null;
  _calMapTap     = null;
  _calSnap       = null;

  // Zurück ins Home-Untermenü
  const h = document.getElementById('s-home');
  if (h) h.classList.add('on');
}

// ── SCHRITT 1: SNAP ──────────────────────
function calSnapAim() {
  if (!S.lat || !S.lon) {
    toast('Warte auf GPS…', true);
    return;
  }
  // GPS-Genauigkeit: streng, weil sonst die Kalibrierung selbst Müll ist.
  if (S.acc != null && S.acc > 15) {
    toast('GPS zu schlecht — ein paar Sekunden warten, dann nochmal.', true);
    return;
  }
  if (S.headingBuf.length === 0) {
    toast('Kompass startet noch — kurz warten, dann nochmal.', true);
    return;
  }

  // ROH-Heading nehmen (ohne bisherigen Offset).
  // Damit man wiederholt kalibrieren kann, ohne dass sich Offsets aufaddieren.
  const rawHeading = circularMeanHeading(S.headingBuf, S.heading);

  // GPS: beste Einzelmessung im Buffer
  const best = (typeof getBestRecentGPS === 'function') ? getBestRecentGPS() : null;
  const snapLat = best ? best.lat : S.lat;
  const snapLon = best ? best.lon : S.lon;

  _calSnap = {
    lat:     snapLat,
    lon:     snapLon,
    heading: rawHeading,
    acc:     best ? best.acc : S.acc,
  };

  // Foto-Flash
  const fl = document.createElement('div');
  fl.className = 'flash';
  document.body.appendChild(fl);
  setTimeout(() => fl.remove(), 350);

  // Snap-Screen aus, Map-Screen an
  const cs = document.getElementById('s-cal-snap');
  if (cs) cs.classList.remove('on');
  if (typeof detachCam === 'function') detachCam('vid-cal');

  const cm = document.getElementById('s-cal-map');
  if (cm) cm.classList.add('on');

  initCalMap();
}

function goBackToCalSnap() {
  // Zurück zum Snap-Screen (Map-Tap war nicht gut)
  if (_calMap) {
    _calMap.remove();
    _calMap = null;
  }
  _calTapMarker = null;
  _calSelfMarker = null;
  _calLineLayer  = null;
  _calMapTap     = null;

  const cm = document.getElementById('s-cal-map');
  if (cm) cm.classList.remove('on');
  startCalibration();
}

// ── SCHRITT 2: KARTEN-TAP ────────────────
function initCalMap() {
  if (!_calSnap) return;

  // Falls schon initialisiert: aufräumen
  if (_calMap) {
    _calMap.remove();
    _calMap = null;
  }

  _calMap = L.map('cal-map', {
    zoomControl:        true,
    attributionControl: false,
  }).setView([_calSnap.lat, _calSnap.lon], 17);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(_calMap);

  // User-Position als blauer Punkt
  const selfIcon = L.divIcon({
    html:       '<div style="width:18px;height:18px;background:#4a90d9;' +
                'border:3px solid #fff;border-radius:50%;' +
                'box-shadow:0 0 10px rgba(74,144,217,0.9);"></div>',
    className:  '',
    iconSize:   [24, 24],
    iconAnchor: [12, 12],
  });
  _calSelfMarker = L.marker([_calSnap.lat, _calSnap.lon], { icon: selfIcon }).addTo(_calMap);

  // Tap-Handler
  _calMap.on('click', onCalMapClick);

  // Resize-Fix
  setTimeout(() => { if (_calMap) _calMap.invalidateSize(); }, 150);
}

function onCalMapClick(e) {
  _calMapTap = { lat: e.latlng.lat, lon: e.latlng.lng };

  // Marker setzen oder verschieben
  if (_calTapMarker) {
    _calTapMarker.setLatLng(e.latlng);
  } else {
    const refIcon = L.divIcon({
      html:       '<div style="width:24px;height:24px;background:#e85d3a;' +
                  'border:3px solid #fff;border-radius:50%;' +
                  'box-shadow:0 0 12px rgba(232,93,58,0.9);"></div>',
      className:  '',
      iconSize:   [30, 30],
      iconAnchor: [15, 15],
    });
    _calTapMarker = L.marker(e.latlng, { icon: refIcon, draggable: true }).addTo(_calMap);
    _calTapMarker.on('dragend', ev => {
      const p = ev.target.getLatLng();
      _calMapTap = { lat: p.lat, lon: p.lng };
      updateCalPreview();
    });
  }

  // Linie zwischen self und tap (zeigt visuell die Richtung)
  if (_calLineLayer) {
    _calLineLayer.setLatLngs([
      [_calSnap.lat, _calSnap.lon],
      [_calMapTap.lat, _calMapTap.lon],
    ]);
  } else {
    _calLineLayer = L.polyline(
      [[_calSnap.lat, _calSnap.lon], [_calMapTap.lat, _calMapTap.lon]],
      { color: '#c9a227', weight: 3, opacity: 0.85, dashArray: '6 6', interactive: false },
    ).addTo(_calMap);
  }

  updateCalPreview();
}

function updateCalPreview() {
  if (!_calSnap || !_calMapTap) return;
  const trueBearing = calcBearing(_calSnap.lat, _calSnap.lon, _calMapTap.lat, _calMapTap.lon);
  let off = _calSnap.heading - trueBearing;
  // Auf signed [-180, +180] bringen
  while (off >  180) off -= 360;
  while (off < -180) off += 360;

  const dist = haversine(_calSnap.lat, _calSnap.lon, _calMapTap.lat, _calMapTap.lon);
  const sign = off >= 0 ? '+' : '';
  const previewEl = document.getElementById('calOffsetPreview');
  if (previewEl) {
    previewEl.innerHTML =
      'Bezugspunkt-Entfernung: <strong>' + Math.round(dist) + ' m</strong> · ' +
      'Berechneter Versatz: <strong>' + sign + off.toFixed(1) + '°</strong>';
  }

  // Confirm-Button aktivieren
  const btn = document.getElementById('btnCalConfirm');
  if (btn) btn.disabled = false;
}

// ── SCHRITT 3: SPEICHERN ─────────────────
function confirmCalibration() {
  if (!_calSnap || !_calMapTap) return;
  const trueBearing = calcBearing(_calSnap.lat, _calSnap.lon, _calMapTap.lat, _calMapTap.lon);
  let off = _calSnap.heading - trueBearing;
  while (off >  180) off -= 360;
  while (off < -180) off += 360;

  // Auf eine Nachkommastelle runden — mehr Präzision wäre Scheingenauigkeit
  off = Math.round(off * 10) / 10;

  const ok = setCompassOffset(off);
  if (!ok) {
    toast('Konnte Versatz nicht speichern (localStorage gesperrt?)', true);
    return;
  }

  const sign = off >= 0 ? '+' : '';
  toast('Versatz ' + sign + off.toFixed(1) + '° gespeichert');

  // Zurück ins Home-Untermenü
  cancelCalibration();
  refreshCalibrationStatus();
}

// ── RESET ────────────────────────────────
function resetCalibrationOffset() {
  if (!confirm('Kompass-Versatz wirklich zurücksetzen?')) return;
  resetCompassOffset();
  refreshCalibrationStatus();
  toast('Kompass-Versatz zurückgesetzt');
}
