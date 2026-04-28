/* ══════════════════════════════════════════
   mark.js — Anschuss markieren (2-Schritt-Prozess)
   Schritt 1: Ziel einrahmen → snapAim (GPS/Kompass/Tilt einfrieren)
   Schritt 2: Entfernung + Schießposition → doMark (Ziel berechnen + speichern)
   ══════════════════════════════════════════ */

// Aktuell ausgewählte Schießposition – wird im UI per Segment-Buttons gesetzt.
// Default = letzte Auswahl, initial 'pirsch'.
let _shotPosition = 'pirsch';   // 'pirsch' | 'bodensitz' | 'hochsitz'

function setShotPosition(pos) {
  if (!['pirsch', 'bodensitz', 'hochsitz'].includes(pos)) return;
  _shotPosition = pos;
  // UI: aktiven Button markieren
  ['pirsch', 'bodensitz', 'hochsitz'].forEach(p => {
    const btn = document.getElementById('posBtn-' + p);
    if (btn) btn.classList.toggle('active', p === pos);
  });
}

function snapAim() {
  if (!S.lat || !S.lon) { toast('Warte auf GPS…', true); return; }

  // GPS-Gate: nur snappen, wenn die Ampel auf grün steht.
  const status = (typeof getGpsStatus === 'function') ? getGpsStatus() : 'ready';
  if (status === 'bad') {
    toast('GPS zu schlecht für einen sauberen Snap. Standort wechseln.', true);
    return;
  }
  if (status === 'wait') {
    toast('GPS sammelt sich noch — kurz warten, dann erneut snappen.', true);
    return;
  }

  // Beste Einzelmessung im Buffer nehmen (nicht den Durchschnitt)
  const best = (typeof getBestRecentGPS === 'function') ? getBestRecentGPS() : null;
  const snapLat = best ? best.lat : S.lat;
  const snapLon = best ? best.lon : S.lon;
  const snapAlt = best ? best.alt : S.alt;
  const snapAcc = best ? best.acc : S.acc;

  // Rohester, aktuellster Heading-Wert (nicht geglättet) für maximale Genauigkeit
  const snapHeading = S.headingBuf.length > 0
    ? S.headingBuf[S.headingBuf.length - 1]
    : S.heading;

  S.snap = {
    tilt:    S.tilt,
    heading: snapHeading,
    lat:     snapLat,
    lon:     snapLon,
    alt:     snapAlt,
    acc:     snapAcc,
  };

  document.getElementById('snapHead').textContent = S.heading + '\u00b0';
  document.getElementById('snapTilt').textContent = (S.tilt > 0 ? '+' : '') + S.tilt + '\u00b0';
  document.getElementById('distInp').value = '';

  // Segment-Buttons auf zuletzt benutzten Wert setzen
  setShotPosition(_shotPosition);

  // Foto-Flash
  const fl = document.createElement('div');
  fl.className = 'flash';
  document.body.appendChild(fl);
  setTimeout(() => fl.remove(), 350);

  showMarkStep(2);
}

function redoAim() {
  showMarkStep(1);
}

function doMark() {
  if (!S.snap) { toast('Zuerst Ziel einrahmen!', true); return; }

  const dist = parseFloat(document.getElementById('distInp').value);
  if (!dist || dist <= 0) { toast('Entfernung vom Laser eingeben!', true); return; }

  // Verwende die GESNAPTE Position (nicht die aktuelle gedriftete)
  const tR = (S.snap.tilt    * Math.PI) / 180;
  const hR = (S.snap.heading * Math.PI) / 180;
  const hD = dist * Math.cos(tR);        // horizontale Distanz
  const vD = dist * Math.sin(tR);        // vertikale Distanz (Höhendiff)
  const R  = 6371000;
  const dLat = (hD * Math.cos(hR)) / R;
  const dLon = (hD * Math.sin(hR)) / (R * Math.cos(S.snap.lat * Math.PI / 180));

  const tgtLat = S.snap.lat + dLat * 180 / Math.PI;
  const tgtLon = S.snap.lon + dLon * 180 / Math.PI;
  const tgtAlt = (S.snap.alt != null ? S.snap.alt : 0) + vD;

  // Anschuss als Singleton speichern (ersetzt vorherigen)
  setSingletonTarget('anschuss', {
    label: 'Anschuss',
    lat:   tgtLat,
    lon:   tgtLon,
    alt:   tgtAlt,
    meta: {
      snapDist:    dist,
      snapHeading: S.snap.heading,
      snapTilt:    S.snap.tilt,
      shooterLat:  S.snap.lat,
      shooterLon:  S.snap.lon,
      shooterAlt:  S.snap.alt,
      shooterAcc:  S.snap.acc,        // GPS-Genauigkeit beim Snap, in Metern
      position:    _shotPosition,     // 'pirsch' | 'bodensitz' | 'hochsitz'
    },
  });

  // Visuelles Feedback
  const fl = document.createElement('div');
  fl.className = 'flash';
  document.body.appendChild(fl);
  setTimeout(() => fl.remove(), 350);

  const mb = document.getElementById('markedBadge');
  if (mb) mb.style.display = 'block';

  const mb2 = document.getElementById('markBadgeMain');
  if (mb2) mb2.textContent = '\u2713 Anschuss gespeichert';

  toast('\u2713 Anschuss gespeichert!');
  setTimeout(() => goHome(), 700);
}
