/* ══════════════════════════════════════════
   sensors.js — GPS + Device-Orientation (Kompass + Tilt)
   ══════════════════════════════════════════ */

// ── GPS ───────────────────────────────────
// watchPosition mit gewichtetem Mittelwert der letzten 10 Messungen.
function startGPS() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(pos => {
    const acc = pos.coords.accuracy;

    // Sehr schlechte Messungen ignorieren
    if (acc > 40) return;

    // Gewicht = 1/acc² → bessere Messungen zählen viel stärker
    const w = 1 / (acc * acc);

    GPS_BUF.push({
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      alt: pos.coords.altitude ?? 0,
      acc: acc,
      w:   w,
      ts:  Date.now(),
    });

    // Max 10 behalten, aber alles älter 8 s verwerfen
    const now = Date.now();
    while (GPS_BUF.length > 10) GPS_BUF.shift();
    const recent = GPS_BUF.filter(p => now - p.ts < 8000);
    if (recent.length === 0) return;

    const tw = recent.reduce((s, p) => s + p.w, 0);
    S.lat = recent.reduce((s, p) => s + p.lat * p.w, 0) / tw;
    S.lon = recent.reduce((s, p) => s + p.lon * p.w, 0) / tw;
    S.alt = recent.reduce((s, p) => s + p.alt * p.w, 0) / tw;
    // Beste Genauigkeit im Buffer anzeigen (nicht Durchschnitt)
    S.acc = Math.round(Math.min(...recent.map(p => p.acc)));

    refreshGPS();
    if (getActiveAnschuss()) renderAR();
  }, () => {}, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout:    8000,
  });
}

function refreshGPS() {
  const cls = S.acc < 15 ? 'ok' : 'warn';
  const txt = '+/-' + S.acc + 'm';

  // Update alle GPS-Badges (home, mark-menu, mark, nav, home-nav)
  for (let i = 0; i < 3; i++) {
    const d = document.getElementById('gpsD' + i);
    if (d) d.className = 'gps-dot ' + cls;
    const t = document.getElementById('gpsT' + i);
    if (t) { t.textContent = txt; t.style.fontFamily = 'var(--mono)'; }
  }
  ['gpsD0b', 'gpsD0c', 'gpsD4'].forEach(id => {
    const d = document.getElementById(id);
    if (d) d.className = 'gps-dot ' + cls;
  });
  ['gpsT0b', 'gpsT0c', 'gpsT4'].forEach(id => {
    const t = document.getElementById(id);
    if (t) { t.textContent = txt; t.style.fontFamily = 'var(--mono)'; }
  });

  updateSavedDistances();
  updateHomeMapPlayer();

  const ma = document.getElementById('mAcc');
  if (ma) {
    ma.textContent = S.acc + 'm';
    ma.className   = 'sc-v' + (S.acc < 15 ? '' : ' bad');
  }
}

// ── ORIENTATION (Kompass + Tilt) ─────────
async function requestOri() {
  if (S.oriListening) return;
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r === 'granted') listenOri();
    } catch (e) {
      listenOri();
    }
  } else {
    listenOri();
  }
}

function listenOri() {
  if (S.oriListening) return;
  S.oriListening = true;

  // Alte Listener entfernen bevor neue gesetzt werden
  window.removeEventListener('deviceorientationabsolute', window._oriHandler, true);
  window.removeEventListener('deviceorientation',         window._oriHandler, true);

  window._oriHandler = e => {
    // iPhone beta: 90 = aufrecht horizontal, <90 = nach oben, >90 = nach unten
    // Kamera-Elevation = 90 - beta
    const beta = e.beta ?? 90;
    S.tilt = Math.round(Math.max(-85, Math.min(85, 90 - beta)));

    let hd = null;
    if (e.webkitCompassHeading != null) hd = e.webkitCompassHeading;       // iOS
    else if (e.alpha != null)           hd = (360 - e.alpha + 360) % 360;  // Android

    if (hd !== null) {
      if (S.heading === 0) {
        S.heading = Math.round(hd);
      } else {
        // EMA mit α=0.3
        let diff = hd - S.heading;
        if (diff >  180) diff -= 360;
        if (diff < -180) diff += 360;
        S.heading = Math.round((S.heading + diff * 0.3 + 360) % 360);
      }
      S.headingReady = true;
    }

    const mt = document.getElementById('mTilt');
    if (mt) mt.textContent = (S.tilt > 0 ? '+' : '') + S.tilt + '\u00b0';
    const mh = document.getElementById('mHead');
    if (mh) mh.textContent = S.heading + '\u00b0';

    if (getActiveAnschuss()) renderAR();
  };

  window.addEventListener('deviceorientationabsolute', window._oriHandler, true);
  window.addEventListener('deviceorientation',         window._oriHandler, true);
}
