/* ══════════════════════════════════════════
   ar.js — AR-Rendering (Mark-Nav + Home-Nav)
   Projiziert Ziele auf die Kamera-Screen-Position.

   ACHTUNG: Hier liegen die Stellen für den AR-Neuaufbau.
   Vertikale Position ist derzeit fix auf -3°.
   ══════════════════════════════════════════ */

// ── Tilt-Glättung (EMA) ───────────────────
// Dämpft Handwackeln beim Gehen (~2-4 Hz) weg.
// Alpha 0.15: ~7 Frames Zeitkonstante bei 60fps ≈ 0.1 s.
// Langsames Kippen (0.5 Hz) folgt sauber; Laufzittern (~4 Hz) wird ~90 % reduziert.
let _tiltEMA = null;

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

  // ── Vertikal: geglätteter Tilt − snapTilt ──
  // EMA glättet Handwackeln weg. Pin folgt bewusstem Kippen (Berg hinauf/hinab),
  // verschwindet bei zu starker Abweichung → edge-arrow übernimmt.
  const rawTilt  = (typeof S.tilt === 'number' && !isNaN(S.tilt)) ? S.tilt : 0;
  _tiltEMA = (_tiltEMA === null) ? rawTilt : (_tiltEMA * 0.85 + rawTilt * 0.15);
  const snapTilt = (tgt.meta && tgt.meta.snapTilt != null) ? tgt.meta.snapTilt : 0;
  // snapTilt − tiltEMA: positiver Wert = Ziel liegt über aktuellem Blickwinkel → Pin oben
  // tiltEMA > snapTilt  = du schaust höher als das Ziel → Pin wandert nach unten, verschwindet
  const vDiff    = snapTilt - _tiltEMA;

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
    try {
      if (getActiveAnschuss() && document.getElementById('s-nav').classList.contains('on')) {
        renderAR();
      }
    } catch (e) {
      console.error('[ar] renderAR error:', e);
      _arLastError = e && e.message ? e.message : String(e);
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
let _arFrameCount = 0;
let _arLastError  = null;

function startHomeARLoop() {
  stopHomeARLoop();
  function loop() {
    try {
      _arFrameCount++;
      if (document.getElementById('s-home-nav').classList.contains('on')) renderHomeAR();
      updateDebugHud();
    } catch (e) {
      console.error('[ar] renderHomeAR error:', e);
      _arLastError = e && e.message ? e.message : String(e);
    }
    _homeARLoop = requestAnimationFrame(loop);
  }
  _homeARLoop = requestAnimationFrame(loop);
}
function stopHomeARLoop() {
  if (_homeARLoop) { cancelAnimationFrame(_homeARLoop); _homeARLoop = null; }
}

// ── Debug-HUD (vorübergehend, bis Bug-Suche durch) ─────
// Zeigt Frame-Counter + GPS + Distanzen pro Ziel.
// So sehen wir live, ob der Loop lebt und was er sieht.
let _debugHud = null;
function ensureDebugHud() {
  if (_debugHud) return _debugHud;
  const el = document.createElement('div');
  el.id = 'arDebugHud';
  el.style.cssText =
    'position:fixed;left:6px;bottom:6px;z-index:90;' +
    'font-family:ui-monospace,Menlo,monospace;font-size:10px;line-height:1.35;' +
    'color:#fff;background:rgba(0,0,0,0.72);padding:5px 8px;border-radius:4px;' +
    'pointer-events:none;max-width:96vw;white-space:pre;';
  document.body.appendChild(el);
  _debugHud = el;
  return el;
}

function updateDebugHud() {
  const sNav  = document.getElementById('s-home-nav');
  const onArV = sNav && sNav.classList.contains('on') && !_homeMapActive;
  const hud   = ensureDebugHud();

  if (!onArV) { hud.style.display = 'none'; return; }
  hud.style.display = 'block';

  const lat  = (S.lat != null) ? S.lat.toFixed(5) : '—';
  const lon  = (S.lon != null) ? S.lon.toFixed(5) : '—';
  const acc  = (S.acc != null) ? (S.acc + 'm') : '—';
  const hd   = (S.heading != null && !isNaN(S.heading)) ? (S.heading + '°') : '—';
  const hAcc = (S.headingAcc != null && S.headingAcc >= 0) ? ('±' + Math.round(S.headingAcc) + '°') : '?';

  const tiltNow = (typeof S.tilt === 'number' && !isNaN(S.tilt)) ? S.tilt : '—';

  const lines = [
    'frame=' + _arFrameCount + ' alarm=' + (_homeAlarmActive ? 'AN' : 'aus'),
    'gps ' + lat + ',' + lon + ' ±' + acc + ' hd=' + hd + ' (' + hAcc + ')',
    'tilt(aktuell)=' + tiltNow + '°',
  ];

  ['hochsitz', 'auto', 'anschuss'].forEach(type => {
    const t = (typeof getFirstByType === 'function') ? getFirstByType(type) : null;
    if (!t) return;
    if (S.lat == null) return;
    const d = haversine(S.lat, S.lon, t.lat, t.lon);
    const b = calcBearing(S.lat, S.lon, t.lat, t.lon);
    const st = (t.meta && t.meta.snapTilt != null) ? t.meta.snapTilt : '—';
    const vd = (t.meta && t.meta.snapTilt != null) ? -t.meta.snapTilt : 0;
    lines.push(type.padEnd(8, ' ') + ' d=' + Math.round(d) + 'm b=' + Math.round(b) + '° snapTilt=' + st + '° vDiff=' + vd);
  });

  if (_arLastError) lines.push('ERR: ' + _arLastError);

  hud.textContent = lines.join('\n');
}

function renderHomeAR() {
  if (!S.lat) return;
  if (_homeMapActive) return;

  // NaN-Schutz: wenn der Kompass kurz ungültige Werte liefert (Magnetfeld-Störung,
  // Kalibrierungslücke), würden die Pin-Positionen "NaN" ergeben und wir würden
  // das letzte Bild einfrieren. Stattdessen kurz pausieren — Label-Update wird
  // unten trotzdem gemacht, weil das nur Distanz braucht (keine Richtung).
  const headingValid = (typeof S.heading === 'number') && !isNaN(S.heading);

  const sw = window.innerWidth, sh = window.innerHeight;
  const targets = [
    { type: 'hochsitz', dotId: 'ar-hochsitz', edgeId: 'edge-hochsitz', labelId: 'labelHochsitz' },
    { type: 'auto',     dotId: 'ar-auto',     edgeId: 'edge-auto',     labelId: 'labelAuto' },
    { type: 'anschuss', dotId: 'ar-anschuss', edgeId: 'edge-anschuss', labelId: 'labelAnschuss' },
  ];

  // Tracker für globale Ankunfts-Logik (Alarm auch ohne explizit angetipptes Ziel)
  let closestType = null;
  let closestDist = Infinity;

  targets.forEach(({ type, dotId, edgeId, labelId }) => {
    const t    = getFirstByType(type);
    const dot  = document.getElementById(dotId);
    const edge = document.getElementById(edgeId);
    if (!t || !dot || !edge) return;

    const dist    = haversine(S.lat, S.lon, t.lat, t.lon);
    const bearing = calcBearing(S.lat, S.lon, t.lat, t.lon);
    const altDiff = t.alt - (S.alt != null ? S.alt : t.alt);

    if (dist < closestDist) {
      closestDist = dist;
      closestType = type;
    }

    // Label mit Distanz
    const lbl = document.getElementById(labelId);
    const labelNames = { hochsitz: 'Hochsitz', auto: 'Auto', anschuss: 'Anschuss' };
    if (lbl) {
      lbl.textContent = (labelNames[type] || type) + ' ' +
        (dist < 1000 ? Math.round(dist) + 'm' : (dist / 1000).toFixed(1) + 'km');
    }

    // ── Nahbereich (< 8 m) ─────────────────
    // Bei sehr kurzer Distanz dominiert der GPS-Zufallsfehler die Bearing-Richtung.
    // → Richtung wird unbrauchbar. Statt einen "tanzenden" Pin zu zeigen, fixieren
    //    wir den Pin unten am Bildschirm zentriert. Visualisiert "du bist hier /
    //    unter dir", was bei dieser Distanz die ehrlichere Aussage ist.
    const isVeryClose = dist < 8;

    // Pin-Größe perspektivisch (näher = größer, ferner = kleiner)
    // Dramatischer Bereich, damit man auf einen Blick erkennt was nah und was fern ist.
    // 200 m → 18 px, 50 m → 30 px, 20 m → 75 px, 15 m → 100 px (clamped 18–100).
    // Im Nahbereich (< 8 m) festes ~70 px.
    const img = dot.querySelector('img');
    if (img) {
      const sz = isVeryClose
        ? 70
        : Math.min(100, Math.max(18, 1500 / Math.max(dist, 1)));
      img.style.width = Math.round(sz) + 'px';
    }

    let screenX, screenY, onScreen;

    if (isVeryClose) {
      // Pin fest unten am Bildschirm — kein hDiff/vDiff
      screenX = sw / 2;
      screenY = sh * 0.82;
      onScreen = true;
    } else {
      // Wenn Heading gerade ungültig ist, Pin-Position nicht neu berechnen
      // (wäre sonst NaN). Label oben drüber wurde aber bereits aktualisiert.
      if (!headingValid) return;

      // Horizontaler Winkel
      let hDiff = bearing - S.heading;
      while (hDiff >  180) hDiff -= 360;
      while (hDiff < -180) hDiff += 360;

      // Vertikal: geglätteter Tilt − snapTilt (EMA, geteilt mit renderAR).
      // snapTilt − tiltEMA: positiver Wert = Ziel liegt über aktuellem Blickwinkel → Pin oben
      // tiltEMA > snapTilt  = du schaust höher als das Ziel → Pin wandert nach unten, verschwindet
      const rawTilt  = (typeof S.tilt === 'number' && !isNaN(S.tilt)) ? S.tilt : 0;
      _tiltEMA = (_tiltEMA === null) ? rawTilt : (_tiltEMA * 0.85 + rawTilt * 0.15);
      const snapTilt = (t.meta && t.meta.snapTilt != null) ? t.meta.snapTilt : 0;
      const vDiff    = snapTilt - _tiltEMA;

      const xPx = ( hDiff / (CAM_HFOV / 2)) * (sw / 2);
      const yPx = (-vDiff / (CAM_VFOV / 2)) * (sh / 2);
      screenX   = sw / 2 + xPx;
      screenY   = sh / 2 + yPx;

      if (isNaN(screenX) || isNaN(screenY)) return;

      const buf = 20;
      onScreen = screenX > buf && screenX < sw - buf
              && screenY > buf && screenY < sh - buf;
    }

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

    // ── Suchradius-Kreis (Boden-Disc, perspektivisch) ──
    // Sichtbar nur wenn (a) Pin onScreen ist, (b) wir die Snap-Genauigkeit haben.
    //
    // Geometrie:
    //   • Mittelpunkt = Pin-Spitze (= echte Ziel-Koordinate auf dem Boden)
    //   • Breite      = angularer Durchmesser × Pixel-pro-Radiant (Standard-Projektion)
    //   • Höhe        = Breite × sin(Sichtwinkel zur Disc-Ebene)
    //         → nahes Ziel: Sichtwinkel groß → Aspekt ~1 (fast Kreis)
    //         → fernes Ziel: Sichtwinkel klein → Aspekt klein (flache Ellipse)
    //   • Wenn der Nutzer das Telefon stärker nach unten kippt, wirkt die Disc
    //     rundlicher — wir mischen den natürlichen Sichtwinkel mit |S.tilt|.
    //
    // z-index: Pin (15) > Kreis (14) → Pin liegt über dem Kreis.
    const circle = document.getElementById('ar-circle-' + type);
    if (circle) {
      const acc = (t.meta && t.meta.shooterAcc) ? t.meta.shooterAcc : null;
      if (onScreen && acc != null && acc > 0 && dist > 0.5) {
        const HFOV_rad = CAM_HFOV * Math.PI / 180;
        const angDiameterRad = (2 * acc) / dist;            // kleine Winkel ≈ tan
        const widthPx  = angDiameterRad * (sw / HFOV_rad);

        // Sichtwinkel auf eine Boden-Disc: arctan(Kamerahöhe / Distanz).
        // Bei Telefon-Tilt nach unten erhöht sich der gefühlte Sichtwinkel —
        // wir nehmen das Maximum aus Natur-Winkel und |Tilt|.
        const CAMERA_HEIGHT_M  = 1.6;
        const naturalAngleRad  = Math.atan(CAMERA_HEIGHT_M / Math.max(dist, 0.1));
        const tiltDeg          = (typeof S.tilt === 'number' && !isNaN(S.tilt)) ? S.tilt : 0;
        const tiltRad          = Math.abs(tiltDeg) * Math.PI / 180;
        const effectiveAngle   = Math.max(naturalAngleRad, tiltRad);
        // Mindest-Aspekt 0.12 sonst wird die Ellipse zur unsichtbaren Linie
        const aspect           = Math.max(0.12, Math.sin(effectiveAngle));

        const w = Math.max(60, Math.round(widthPx));
        const h = Math.max(10, Math.round(w * aspect));

        circle.style.display = 'block';
        circle.style.left    = screenX + 'px';       // Mitte = Pin-Spitze
        circle.style.top     = screenY + 'px';
        circle.style.width   = w + 'px';
        circle.style.height  = h + 'px';
        // border-radius: 50% kommt aus css/home.css → bei width ≠ height: Ellipse
      } else {
        circle.style.display = 'none';
      }
    }

    // Stats nur für das selektierte Ziel anzeigen
    if (_homeTarget === type) {
      document.getElementById('hDist').textContent =
        dist < 1000 ? Math.round(dist) + ' m' : (dist / 1000).toFixed(2) + ' km';
      document.getElementById('hBear').textContent = Math.round(bearing) + '°';
      document.getElementById('hAlt').textContent  = (altDiff >= 0 ? '+' : '') + Math.round(altDiff) + ' m';
    }
  });

  // ── Globaler Ankunfts-Check ──
  // Alarm + Ankunfts-Meldung feuern, sobald irgendein Ziel < 8 m ist —
  // egal ob du vorher ein Ziel angetippt hattest.
  const arrivedMsg = document.getElementById('homeArrivedMsg');
  const arrived    = closestDist < 8;
  if (arrivedMsg) arrivedMsg.classList.toggle('show', arrived);

  if (arrived && !_homeAlarmActive) {
    startHomeAlarm();
    // Wenn noch kein Ziel selektiert ist, automatisch das nächste auswählen
    // → damit zeigt der Stats-Streifen sinnvolle Werte
    if (!_homeTarget && closestType && typeof selectHomeTarget === 'function') {
      selectHomeTarget(closestType);
    }
  }
  if (!arrived && _homeAlarmActive) stopHomeAlarm();
}
