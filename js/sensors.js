/* ══════════════════════════════════════════
   sensors.js — GPS + Device-Orientation (Kompass + Tilt)

   Schritt 2 (Sauberer Snap):
   - Outlier-Filter: Sprünge > 25 m mit schlechterer Genauigkeit ignorieren
   - getBestRecentGPS()  → liefert die genaueste Einzelmessung im Buffer
   - getGpsStatus()      → 'ready' | 'wait' | 'bad'  (für UI-Ampel)
   ══════════════════════════════════════════ */

// ── Schwellwerte ─────────────────────────
const GPS_READY_ACC    = 15;   // unter ±15 m: snap-bereit (grün)
const GPS_WAIT_ACC     = 25;   // 15–25 m: warten (gelb)
//  über 25 m: nicht snappen (rot)
const GPS_OUTLIER_JUMP = 25;   // Sprung in Metern, ab dem ein Wert verdächtig ist
const GPS_BUFFER_MAX   = 12;   // Messpunkte im Buffer behalten
const GPS_BUFFER_AGE   = 8000; // ms — älter als das wird verworfen

// ── GPS ───────────────────────────────────
function startGPS() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(pos => {
    const acc  = pos.coords.accuracy;
    const lat  = pos.coords.latitude;
    const lon  = pos.coords.longitude;
    const alt  = pos.coords.altitude != null ? pos.coords.altitude : 0;
    const now  = Date.now();

    // Sehr schlechte Messungen ignorieren (>40 m)
    if (acc > 40) return;

    // ── Outlier-Filter ─────────────────────
    // Wenn die neue Messung weit weg vom letzten Stand ist UND gleichzeitig
    // schlechter als der bisherige Stand, ignorieren (klassischer Mehrwege-Effekt
    // unter Bäumen oder in der Stadt). Bessere Messungen werden NIE ignoriert.
    if (S.lat != null && S.acc != null) {
      const jump = haversine(S.lat, S.lon, lat, lon);
      if (jump > GPS_OUTLIER_JUMP && acc > S.acc * 1.3) {
        return;
      }
    }

    // Gewicht = 1/acc² → bessere Messungen zählen viel stärker
    const w = 1 / (acc * acc);

    GPS_BUF.push({ lat, lon, alt, acc, w, ts: now });

    // Buffer trimmen
    while (GPS_BUF.length > GPS_BUFFER_MAX) GPS_BUF.shift();

    // Aktuelle Werte aus den letzten 8 s mitteln
    const recent = GPS_BUF.filter(p => now - p.ts < GPS_BUFFER_AGE);
    if (recent.length === 0) return;

    const tw = recent.reduce((s, p) => s + p.w, 0);
    S.lat = recent.reduce((s, p) => s + p.lat * p.w, 0) / tw;
    S.lon = recent.reduce((s, p) => s + p.lon * p.w, 0) / tw;
    S.alt = recent.reduce((s, p) => s + p.alt * p.w, 0) / tw;
    // Beste Genauigkeit im Buffer anzeigen (nicht Durchschnitt)
    S.acc = Math.round(Math.min.apply(null, recent.map(p => p.acc)));

    refreshGPS();
    if (getActiveAnschuss()) renderAR();
  }, () => {}, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout:    8000,
  });
}

// ── Helfer: Beste Einzelmessung im Buffer ──
// Wird beim Snap genutzt — wir wollen DEN besten Punkt, nicht den Durchschnitt.
function getBestRecentGPS() {
  const now = Date.now();
  const recent = GPS_BUF.filter(p => now - p.ts < GPS_BUFFER_AGE);
  if (recent.length === 0) return null;
  return recent.reduce((best, p) => p.acc < best.acc ? p : best);
}

// ── Helfer: GPS-Status für UI-Ampel ────────
// 'ready' = snap-bereit (grün) — Genauigkeit < 15 m
// 'wait'  = warten (gelb)      — 15–25 m
// 'bad'   = nicht snappen (rot) — > 25 m oder kein GPS
function getGpsStatus() {
  if (S.acc == null || S.lat == null) return 'bad';
  if (S.acc <= GPS_READY_ACC) return 'ready';
  if (S.acc <= GPS_WAIT_ACC)  return 'wait';
  return 'bad';
}

// ── Helfer: Compass-Status für UI-Ampel ────────
// 'ready' = Kompass kalibriert (< 10°)
// 'wait'  = mäßig (10–25°), kalibrieren empfohlen
// 'bad'   = unkalibriert (> 25°), Snap blockieren
//
// iOS liefert webkitCompassAccuracy in Grad. -1 oder null = unbekannt.
// Android liefert i.d.R. nichts → behandeln wir als 'ready' (sonst blockieren wir
// Android-Nutzer ohne Grund).
const COMPASS_READY_ACC = 10;   // Grad
const COMPASS_WAIT_ACC  = 25;   // Grad

function getCompassStatus() {
  if (S.heading == null || isNaN(S.heading)) return 'wait';
  if (S.headingAcc == null || S.headingAcc < 0) return 'ready'; // unbekannt → keine Sperre
  if (S.headingAcc <= COMPASS_READY_ACC) return 'ready';
  if (S.headingAcc <= COMPASS_WAIT_ACC)  return 'wait';
  return 'bad';
}

// Kombinierter Snap-Bereitschafts-Status (GPS UND Kompass müssen passen)
function getSnapReadiness() {
  const g = getGpsStatus();
  const c = getCompassStatus();
  if (g === 'bad' || c === 'bad') return 'bad';
  if (g === 'wait' || c === 'wait') return 'wait';
  return 'ready';
}

function refreshGPS() {
  const cls = S.acc < GPS_READY_ACC ? 'ok' : 'warn';
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
  updateSnapStatus();   // Ampel über dem Snap-Button

  const ma = document.getElementById('mAcc');
  if (ma) {
    ma.textContent = S.acc + 'm';
    ma.className   = 'sc-v' + (S.acc < GPS_READY_ACC ? '' : ' bad');
  }
}

// ── UI: Snap-Ampel im Mark-Screen ───────────
// Berücksichtigt jetzt sowohl GPS als auch Kompass. Sagt klar, was gerade
// das Problem ist. Bei rot/gelb wird der Snap-Knopf optisch ausgegraut.
function updateSnapStatus() {
  const gps      = getGpsStatus();
  const compass  = getCompassStatus();
  const overall  = getSnapReadiness();

  const pill = document.getElementById('snapStatus');
  const btn  = document.getElementById('btnSnap');

  if (pill) {
    pill.classList.remove('ready', 'wait', 'bad');
    pill.classList.add(overall);
    const txt = pill.querySelector('.snap-status-txt');
    if (txt) {
      let msg;
      // Reihenfolge: schwerwiegendstes Problem zuerst
      if (gps === 'bad') {
        msg = 'GPS zu schlecht — Standort wechseln';
      } else if (compass === 'bad') {
        msg = 'Kompass unkalibriert — Telefon in 8 schwenken';
      } else if (compass === 'wait') {
        msg = 'Kompass mäßig — kurz in 8 schwenken';
      } else if (gps === 'wait') {
        msg = 'GPS sammelt sich… kurz warten';
      } else {
        msg = 'Bereit — kannst snappen';
      }
      txt.textContent = msg;
    }
  }

  if (btn) {
    btn.classList.toggle('disabled', overall !== 'ready');
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
    const beta = e.beta != null ? e.beta : 90;
    S.tilt = Math.round(Math.max(-85, Math.min(85, 90 - beta)));

    let hd = null;
    if (e.webkitCompassHeading != null) hd = e.webkitCompassHeading;       // iOS
    else if (e.alpha != null)           hd = (360 - e.alpha + 360) % 360;  // Android

    // Compass-Genauigkeit (nur iOS) — in Grad. -1 oder undefined = unbekannt.
    if (typeof e.webkitCompassAccuracy === 'number' && e.webkitCompassAccuracy >= 0) {
      S.headingAcc = e.webkitCompassAccuracy;
    }

    if (hd !== null) {
      // Roh-Heading-Buffer (für Snap maximal aktuell)
      S.headingBuf.push(hd);
      while (S.headingBuf.length > 5) S.headingBuf.shift();

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
    if (mt) mt.textContent = (S.tilt > 0 ? '+' : '') + S.tilt + '°';
    const mh = document.getElementById('mHead');
    if (mh) mh.textContent = S.heading + '°';

    if (getActiveAnschuss()) renderAR();
  };

  window.addEventListener('deviceorientationabsolute', window._oriHandler, true);
  window.addEventListener('deviceorientation',         window._oriHandler, true);
}
