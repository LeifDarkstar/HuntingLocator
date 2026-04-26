/* ══════════════════════════════════════════
   mark.js — Anschuss markieren (2-Schritt-Prozess)
   Schritt 1: Ziel einrahmen → snapAim (GPS/Kompass/Tilt einfrieren)
   Schritt 2: Entfernung eingeben → doMark (Ziel berechnen + speichern)
   ══════════════════════════════════════════ */

function snapAim() {
  if (!S.lat || !S.lon) { toast('Warte auf GPS...', true); return; }

  // Rohester, aktuellster Heading-Wert (nicht geglättet) für maximale Genauigkeit
  const snapHeading = S.headingBuf.length > 0
    ? S.headingBuf[S.headingBuf.length - 1]
    : S.heading;

  S.snap = {
    tilt:    S.tilt,
    heading: snapHeading,
    lat:     S.lat,
    lon:     S.lon,
    alt:     S.alt,
  };

  document.getElementById('snapHead').textContent = S.heading + '\u00b0';
  document.getElementById('snapTilt').textContent = (S.tilt > 0 ? '+' : '') + S.tilt + '\u00b0';
  document.getElementById('distInp').value = '';

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
  const tgtAlt = (S.snap.alt ?? 0) + vD;

  S.target = { lat: tgtLat, lon: tgtLon, alt: tgtAlt, snapDist: dist };
  saveGlobalTarget('anschuss', 'Anschuss', tgtLat, tgtLon, tgtAlt);

  // Visuelles Feedback
  const fl = document.createElement('div');
  fl.className = 'flash';
  document.body.appendChild(fl);
  setTimeout(() => fl.remove(), 350);

  const mb = document.getElementById('markedBadge');
  if (mb) mb.style.display = 'block';

  const mb2 = document.getElementById('markBadgeMain');
  if (mb2) mb2.textContent = '✓ Anschuss gespeichert';

  toast('\u2713 Anschuss gespeichert!');
  setTimeout(() => goHome(), 700);
}
