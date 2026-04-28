/* ══════════════════════════════════════════
   ar.js — AR-Rendering (Mark-Nav + Home-Nav)
   Projiziert Ziele auf die Kamera-Screen-Position.

   ACHTUNG: Hier liegen die Stellen für den AR-Neuaufbau.
   Vertikale Position ist derzeit fix auf -3°.
   ══════════════════════════════════════════ */

// ── AR: Mark-Nav (Anschuss) ────────────────
function renderAR() {
  const tgt = getActiveAnschuss();
  if (!tgt || !S.lat) return;

  const dist    = haversine(S.lat, S.lon, tgt.lat, tgt.lon);
  const bearing = calcBearing(S.lat, S.lon, tgt.lat, tgt.lon);
  const altDiff = tgt.alt - (S.alt != null ? S.alt : tgt.alt);

  // ── Stats-Anzeige ──
  const corrDist = dist;
  document.getElementById('nDist').textContent =
    corrDist < 1000 ? Math.round(corrDist) + ' m' : (corrDist / 1000).toFixed(2) + ' km';
  document.getElementById('nBear').textContent = Math.round(bearing) + '\u00b0';
  document.getElementById('nAlt').textContent  = (altDiff >= 0 ? '+' : '') + Math.round(altDiff) + ' m';
  document.getElementById('nDist').className   = 'nv' + (dist < 25 ? ' close' : '');

  // ── Arrived-Check + Sound ──
  const arrived = corrDist < 8;
  document.getElementById('arrivedMsg').classList.toggle('show', arrived);
  if ( arrived && !S.wasArrived) playArrivalSound();
  if (!arrived &&  S.wasArrived) stopAlarm();
  S.wasArrived = arrived;

  // ── Horizontaler Winkel ──
  let hDiff = bearing - S.heading;
  while (hDiff >  180) hDiff -= 360;
  while (hDiff < -180) hDiff += 360;

  // ── Vertikal: derzeit fix -3° (AR-Neuaufbau: hier Laser×sin(Tilt) + Barometer) ──
  const vDiff = -3;

  const sw = window.innerWidth;
  const sh = window.innerHeight;

  // FOV-Projektion
  const xPxBase = ( hDiff / (CAM_HFOV / 2)) * (sw / 2);
  const yPxBase = (-vDiff / (CAM_VFOV / 2)) * (sh / 2);
  const xPx = xPxBase * S.pinchZoom;
  const yPx = yPxBase * S.pinchZoom;
  const screenX = sw / 2 + xPx;
  const screenY = sh / 2 + yPx;

  // Negativer Rand: Pin erscheint bevor er ganz drin ist (kein Snap)
  const marginIn = -20;
  const onScreen = screenX > marginIn && screenX < sw - marginIn
                && screenY > marginIn && screenY < sh - marginIn;

  const dot     = document.getElementById('ar-dot');
  const edgeArr = document.getElementById('edge-arrow');
  const dirArr  = document.getElementById('dir-arrow');

  if (arrived) {
    dot.style.display = 'block';
    dot.style.left    = (sw / 2) + 'px';
    dot.style.top     = (sh / 2) + 'px';
    setDotStyle(dot, 90, dist);
    edgeArr.style.display = 'none';
    dirArr.style.display  = 'none';

  } else if (onScreen) {
    // Pin-Größe perspektivisch (näher = größer)
    // 200m ≈ 10px · 50m ≈ 24px · 20m ≈ 50px · 8m = 90px
    const dotSize = Math.min(90, Math.max(10, 700 / dist));
    dot.style.display = 'block';
    dot.style.left    = screenX + 'px';
    dot.style.top     = screenY + 'px';
    setDotStyle(dot, dotSize, dist);
    edgeArr.style.display = 'none';
    dirArr.style.display  = 'none';

  } else {
    dot.style.display = 'none';

    // Zentraler Richtungs-Pfeil
    dirArr.style.display = 'block';
    const dirAngle = (bearing - S.heading + 360) % 360;
    dirArr.style.transform = 'translate(-50%,-50%) rotate(' + dirAngle + 'deg)';

    // Edge-Pfeil am Bildschirmrand
    edgeArr.style.display = 'block';
    const pad = 32;
    const cx  = Math.max(pad, Math.min(sw - pad, screenX));
    const cy  = Math.max(pad, Math.min(sh - pad, screenY));
    const ea  = Math.atan2(screenY - sh / 2, screenX - sw / 2) * 180 / Math.PI + 90;
    edgeArr.style.left      = cx + 'px';
    edgeArr.style.top       = cy + 'px';
    edgeArr.style.transform = 'translate(-50%,-50%) rotate(' + ea + 'deg)';
  }
}

// Größe + Drop-Shadow für Pin (mark-nav)
function setDotStyle(dot, size, dist) {
  const img = dot.querySelector('img');
  if (img) {
    img.style.width = Math.round(size * 0.8) + 'px';
  } else {
    dot.style.width  = Math.round(size * 0.8) + 'px';
    dot.style.height = size + 'px';
  }
  if (dist < 20) dot.classList.add('bounce');
  else           dot.classList.remove('bounce');

  const shadowSize = Math.round(size * 0.4);
  dot.style.filter =
    'drop-shadow(0 4px ' + shadowSize + 'px rgba(0,0,0,0.6)) ' +
    'drop-shadow(0 0 '    + shadowSize + 'px rgba(201,162,39,' + (dist < 30 ? 0.8 : 0.4) + '))';
}

// ── AR-Render-Loop (Mark-Nav) ────────────
let _arLoopId = null;
function startARLoop() {
  stopARLoop();
  function loop() {
    if (getActiveAnschuss() && document.getElementById('s-nav').classList.contains('on')) {
      renderAR();
    }
    _arLoopId = requestAnimationFrame(loop);
  }
  _arLoopId = requestAnimationFrame(loop);
}
function stopARLoop() {
  if (_arLoopId) { cancelAnimationFrame(_arLoopId); _arLoopId = null; }
}

// ══════════════════════════════════════════
// HOME-NAV AR (mehrere Ziele gleichzeitig)
// ══════════════════════════════════════════

let _homeARLoop = null;

function startHomeARLoop() {
  stopHomeARLoop();
  function loop() {
    if (document.getElementById('s-home-nav').classList.contains('on')) renderHomeAR();
    _homeARLoop = requestAnimationFrame(loop);
  }
  _homeARLoop = requestAnimationFrame(loop);
}
function stopHomeARLoop() {
  if (_homeARLoop) { cancelAnimationFrame(_homeARLoop); _homeARLoop = null; }
}

function renderHomeAR() {
  if (!S.lat) return;
  if (_homeMapActive) return;

  const sw = window.innerWidth, sh = window.innerHeight;
  const targets = [
    { type: 'hochsitz', dotId: 'ar-hochsitz', edgeId: 'edge-hochsitz', labelId: 'labelHochsitz' },
    { type: 'auto',     dotId: 'ar-auto',     edgeId: 'edge-auto',     labelId: 'labelAuto' },
    { type: 'anschuss', dotId: 'ar-anschuss', edgeId: 'edge-anschuss', labelId: 'labelAnschuss' },
  ];

  targets.forEach(({ type, dotId, edgeId, labelId }) => {
    const t    = getFirstByType(type);
    const dot  = document.getElementById(dotId);
    const edge = document.getElementById(edgeId);
    if (!t || !dot || !edge) return;

    const dist    = haversine(S.lat, S.lon, t.lat, t.lon);
    const bearing = calcBearing(S.lat, S.lon, t.lat, t.lon);
    const altDiff = t.alt - (S.alt != null ? S.alt : t.alt);

    // Label mit Distanz
    const lbl = document.getElementById(labelId);
    const labelNames = { hochsitz: 'Hochsitz', auto: 'Auto', anschuss: 'Anschuss' };
    if (lbl) {
      lbl.textContent = (labelNames[type] || type) + ' ' +
        (dist < 1000 ? Math.round(dist) + 'm' : (dist / 1000).toFixed(1) + 'km');
    }

    // Horizontaler Winkel
    let hDiff = bearing - S.heading;
    while (hDiff >  180) hDiff -= 360;
    while (hDiff < -180) hDiff += 360;

    // Vertikal: fix -3° (siehe AR-Neuaufbau-Plan)
    const vDiff = -3;

    const xPx     = ( hDiff / (CAM_HFOV / 2)) * (sw / 2);
    const yPx     = (-vDiff / (CAM_VFOV / 2)) * (sh / 2);
    const screenX = sw / 2 + xPx;
    const screenY = sh / 2 + yPx;

    const buf = 20;
    const onScreen = screenX > buf && screenX < sw - buf
                  && screenY > buf && screenY < sh - buf;

    if (onScreen) {
      dot.style.display  = 'block';
      dot.style.left     = screenX + 'px';
      dot.style.top      = screenY + 'px';
      edge.style.display = 'none';
    } else {
      dot.style.display  = 'none';
      edge.style.display = 'block';
      const pad = 48;
      const cx  = Math.max(pad, Math.min(sw - pad, screenX));
      const cy  = Math.max(pad, Math.min(sh - pad, screenY));
      const ea  = Math.atan2(screenY - sh / 2, screenX - sw / 2) * 180 / Math.PI + 90;
      edge.style.left      = cx + 'px';
      edge.style.top       = cy + 'px';
      edge.style.transform = 'translate(-50%,-50%) rotate(' + ea + 'deg)';
    }

    // Ausgewähltes Ziel: Stats + Arrived-Check
    if (_homeTarget === type) {
      document.getElementById('hDist').textContent =
        dist < 1000 ? Math.round(dist) + ' m' : (dist / 1000).toFixed(2) + ' km';
      document.getElementById('hBear').textContent = Math.round(bearing) + '°';
      document.getElementById('hAlt').textContent  = (altDiff >= 0 ? '+' : '') + Math.round(altDiff) + ' m';
      const arrived = dist < 8;
      document.getElementById('homeArrivedMsg').classList.toggle('show', arrived);
      if ( arrived && !_homeAlarmActive) startHomeAlarm();
      if (!arrived &&  _homeAlarmActive) stopHomeAlarm();
    }
  });
}
