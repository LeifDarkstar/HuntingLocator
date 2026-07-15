/* ══════════════════════════════════════════
   track.js — Track-Rubrik, Schritt 1: Blutpunkte sammeln

   Ziel dieses Schritts (bewusst klein gehalten):
   - Karten-Screen mit großem Tap-Button
   - Jeder Tap setzt an der aktuellen GPS-Position einen Blutpunkt
   - Punkte werden als rote Punkte + Verbindungslinie auf der Karte gezeigt
   - Undo (letzten Punkt löschen) + "Neue Suche" (alles verwerfen)
   - "Tier gefunden" → speichert die komplette Suche dauerhaft (IndexedDB)
     = die Datenbasis fürs spätere "Gehirn" (Lern-/Vorhersage-Funktion)

   NOCH NICHT in diesem Schritt: Richtungs-Vorhersage, Kegel, AR, Export.
   ══════════════════════════════════════════ */

// ── Zustand der AKTUELLEN (laufenden) Suche ──
let _trackPoints    = [];     // [{ lat, lon, acc, ts }]  — Reihenfolge = Reihenfolge des Setzens
let _trackStartedAt = null;   // unix-ms des ersten Punkts

// ── Leaflet-Objekte ──
let _trackMap          = null;
let _trackPlayerMarker = null;
let _trackDots         = [];  // L.circleMarker je Punkt
let _trackLine         = null;

// ══════════════════════════════════════════
//  Persistenz — IndexedDB ("hound-tracks")
//  Die Browser-eigene, größere Speicher-Box (nicht das iPhone selbst).
//  Überlebt App-Schließen/Neustart; NICHT "Websitedaten löschen".
// ══════════════════════════════════════════
const TRACK_DB    = 'hound-tracks';
const TRACK_STORE = 'tracks';

function _trackDbOpen() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB nicht verfügbar')); return; }
    const req = indexedDB.open(TRACK_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TRACK_STORE)) {
        db.createObjectStore(TRACK_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function trackSaveArchive(record) {
  try {
    const db = await _trackDbOpen();
    await new Promise((res, rej) => {
      const tx = db.transaction(TRACK_STORE, 'readwrite');
      tx.objectStore(TRACK_STORE).add(record);
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(tx.error);
    });
    return true;
  } catch (e) {
    console.warn('[track] Speichern fehlgeschlagen:', e);
    return false;
  }
}

async function trackCountArchive() {
  try {
    const db = await _trackDbOpen();
    return await new Promise((res, rej) => {
      const tx = db.transaction(TRACK_STORE, 'readonly');
      const rq = tx.objectStore(TRACK_STORE).count();
      rq.onsuccess = () => res(rq.result);
      rq.onerror   = () => rej(rq.error);
    });
  } catch (e) {
    return 0;
  }
}

// Alle gespeicherten Suchen als Array zurückgeben (für Export).
async function trackGetAllArchive() {
  const db = await _trackDbOpen();
  return await new Promise((res, rej) => {
    const tx = db.transaction(TRACK_STORE, 'readonly');
    const rq = tx.objectStore(TRACK_STORE).getAll();
    rq.onsuccess = () => res(rq.result || []);
    rq.onerror   = () => rej(rq.error);
  });
}

// ══════════════════════════════════════════
//  Sicherung — Export / Import
//  Die gespeicherten Suchen sind die Trainingsdaten fürs spätere "Gehirn".
//  Browser-Speicher kann iOS nach ~7 Tagen leeren → hier die Rettungsleine.
// ══════════════════════════════════════════

// Eindeutige "Unterschrift" einer Suche → damit ein erneuter Import keine
// Duplikate anlegt (gleiche Suche zweimal zählt sonst doppelt fürs Gehirn).
function _trackSignature(rec) {
  const s = rec && rec.startedAt  != null ? rec.startedAt  : '?';
  const f = rec && rec.finishedAt != null ? rec.finishedAt : '?';
  const n = rec && rec.points ? rec.points.length : 0;
  return s + '|' + f + '|' + n;
}

async function trackExport() {
  let all;
  try {
    all = await trackGetAllArchive();
  } catch (e) {
    toast('Export fehlgeschlagen — Speicher nicht lesbar.', true);
    return;
  }
  if (!all.length) { toast('Noch keine Suchen zum Sichern.', true); return; }

  const payload = {
    app:        'hound',
    kind:       'track-archive',
    version:    (typeof AR_HUD_VERSION === 'string') ? AR_HUD_VERSION : null,
    exportedAt: Date.now(),
    count:      all.length,
    tracks:     all,
  };
  const json = JSON.stringify(payload, null, 2);

  const now = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const fname = 'hound-suchen-' + now.getFullYear() + '-' +
                pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '.json';

  const blob = new Blob([json], { type: 'application/json' });

  // iOS: Teilen-Menü (Datei in Dateien/iCloud sichern, mailen, …).
  try {
    if (navigator.canShare) {
      const file = new File([blob], fname, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'h.o.u.n.d. Sicherung' });
        toast('Sicherung geteilt ✓  (' + all.length + ' Suchen)');
        return;
      }
    }
  } catch (e) {
    // Nutzer hat abgebrochen oder Share nicht möglich → Fallback unten.
    if (e && e.name === 'AbortError') return;
  }

  // Fallback: normaler Download.
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Sicherung heruntergeladen ✓  (' + all.length + ' Suchen)');
  } catch (e) {
    toast('Export fehlgeschlagen.', true);
  }
}

function trackImport() {
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = 'application/json,.json';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    document.body.removeChild(input);
    if (!file) return;

    let data;
    try {
      const text = await file.text();
      data = JSON.parse(text);
    } catch (e) {
      toast('Datei nicht lesbar (kein gültiges JSON).', true);
      return;
    }

    const tracks = data && Array.isArray(data.tracks) ? data.tracks
                 : (Array.isArray(data) ? data : null);
    if (!tracks) { toast('Keine Suchen in der Datei gefunden.', true); return; }

    // Vorhandene Unterschriften sammeln → nur wirklich neue Suchen einspielen.
    let existing = [];
    try { existing = await trackGetAllArchive(); } catch (e) {}
    const known = new Set(existing.map(_trackSignature));

    let added = 0, skipped = 0;
    for (const rec of tracks) {
      if (!rec || !Array.isArray(rec.points)) { skipped++; continue; }
      const sig = _trackSignature(rec);
      if (known.has(sig)) { skipped++; continue; }
      const clean = Object.assign({}, rec);
      delete clean.id;   // eigene autoIncrement-ID vergeben lassen
      const ok = await trackSaveArchive(clean);
      if (ok) { added++; known.add(sig); } else { skipped++; }
    }

    refreshTrackArchiveCount();
    toast(added + ' neue Suche' + (added === 1 ? '' : 'n') + ' geladen' +
          (skipped ? '  (' + skipped + ' übersprungen)' : '') + ' ✓');
  });

  input.click();
}

// ══════════════════════════════════════════
//  Screen öffnen / schließen
// ══════════════════════════════════════════
function openTrack() {
  document.getElementById('s-main').classList.remove('on');
  document.getElementById('s-track').classList.add('on');

  // Best-effort: iOS bitten, den Speicher NICHT nach Tagen Nichtnutzung zu leeren.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  initTrackMap();
  updateTrackUI();
  refreshTrackArchiveCount();
}

// ══════════════════════════════════════════
//  Karte
// ══════════════════════════════════════════
function initTrackMap() {
  if (typeof L === 'undefined') { toast('Karte lädt nicht (offline?).', true); return; }

  if (!_trackMap) {
    const hasGps = S.lat != null;
    _trackMap = L.map('track-map', {
      zoomControl:        true,
      attributionControl: false,
    }).setView(hasGps ? [S.lat, S.lon] : [51, 10], hasGps ? 17 : 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(_trackMap);
  } else if (S.lat != null && _trackPoints.length === 0) {
    // Solange noch keine Punkte gesetzt sind: Karte auf den Nutzer zentrieren.
    _trackMap.setView([S.lat, S.lon], 17);
  }

  // Leaflet muss nach dem Einblenden seine Größe neu berechnen.
  setTimeout(() => {
    if (_trackMap) { _trackMap.invalidateSize(); renderTrackMap(); }
  }, 150);
  renderTrackMap();
}

function renderTrackMap() {
  if (!_trackMap) return;

  // Alte Punkte + Linie entfernen (force-recreate = keine stale-state-Probleme)
  _trackDots.forEach(d => _trackMap.removeLayer(d));
  _trackDots = [];
  if (_trackLine) { _trackMap.removeLayer(_trackLine); _trackLine = null; }

  // Verbindungslinie (Blutspur)
  if (_trackPoints.length > 1) {
    _trackLine = L.polyline(_trackPoints.map(p => [p.lat, p.lon]), {
      color:       '#b83030',
      weight:      2.5,
      opacity:     0.85,
      interactive: false,
    }).addTo(_trackMap);
  }

  // Punkte — erster Punkt (Start = erster Bluttropfen) grün hervorgehoben
  _trackPoints.forEach((p, i) => {
    const isStart = (i === 0);
    const m = L.circleMarker([p.lat, p.lon], {
      radius:      isStart ? 8 : 6,
      color:       isStart ? '#8fae1b' : '#b83030',
      weight:      2,
      fillColor:   isStart ? '#8fae1b' : '#e04545',
      fillOpacity: 0.9,
      interactive: false,
    }).addTo(_trackMap);
    _trackDots.push(m);
  });

  // Spieler-Marker (blauer Punkt = aktuelle Position)
  if (S.lat != null) {
    if (_trackPlayerMarker) {
      _trackPlayerMarker.setLatLng([S.lat, S.lon]);
    } else {
      const icon = L.divIcon({
        html:       '<div style="width:16px;height:16px;background:#4a90d9;' +
                    'border:2px solid #fff;border-radius:50%;' +
                    'box-shadow:0 0 8px rgba(74,144,217,0.8);"></div>',
        className:  '',
        iconAnchor: [8, 8],
      });
      _trackPlayerMarker = L.marker([S.lat, S.lon], { icon: icon, interactive: false }).addTo(_trackMap);
    }
  }
}

// Wird aus sensors.refreshGPS() aufgerufen → Spieler-Marker live nachziehen.
function updateTrackMapPlayer() {
  const scr = document.getElementById('s-track');
  if (!scr || !scr.classList.contains('on')) return;
  if (_trackMap && _trackPlayerMarker && S.lat != null) {
    _trackPlayerMarker.setLatLng([S.lat, S.lon]);
  }
}

// ══════════════════════════════════════════
//  Aktionen
// ══════════════════════════════════════════
function _bestGpsNow() {
  const best = (typeof getBestRecentGPS === 'function') ? getBestRecentGPS() : null;
  if (best) return { lat: best.lat, lon: best.lon, acc: best.acc };
  if (S.lat != null) return { lat: S.lat, lon: S.lon, acc: S.acc };
  return null;
}

function addBloodPoint() {
  const g = _bestGpsNow();
  if (!g) { toast('Kein GPS — kurz warten…', true); return; }

  if (_trackPoints.length === 0) _trackStartedAt = Date.now();
  _trackPoints.push({ lat: g.lat, lon: g.lon, acc: g.acc != null ? Math.round(g.acc) : null, ts: Date.now() });

  renderTrackMap();
  updateTrackUI();
  toast('Blutpunkt ' + _trackPoints.length + ' gesetzt  (±' + (g.acc != null ? Math.round(g.acc) : '?') + ' m)');
}

function undoBloodPoint() {
  if (_trackPoints.length === 0) { toast('Nichts rückgängig zu machen.'); return; }
  _trackPoints.pop();
  if (_trackPoints.length === 0) _trackStartedAt = null;
  renderTrackMap();
  updateTrackUI();
}

function newTrack() {
  if (_trackPoints.length > 0 &&
      !confirm('Aktuelle Suche verwerfen? Alle ' + _trackPoints.length + ' Punkte werden gelöscht.')) {
    return;
  }
  _trackPoints = [];
  _trackStartedAt = null;
  renderTrackMap();
  updateTrackUI();
  toast('Neue Suche gestartet.');
}

async function finishTrack() {
  if (_trackPoints.length === 0) { toast('Noch keine Punkte gesetzt.', true); return; }

  const g = _bestGpsNow();
  const found = g ? { lat: g.lat, lon: g.lon, acc: g.acc != null ? Math.round(g.acc) : null, ts: Date.now() } : null;

  const record = {
    startedAt:  _trackStartedAt,
    finishedAt: Date.now(),
    points:     _trackPoints.slice(),
    found:      found,
    outcome:    'found',
    stats:      _trackStats(_trackPoints, found),
    version:    (typeof AR_HUD_VERSION === 'string') ? AR_HUD_VERSION : null,
  };

  const ok = await trackSaveArchive(record);
  if (ok) {
    console.log('[track] Suche gespeichert:', record);
    toast('Suche gespeichert ✓  (' + _trackPoints.length + ' Punkte)');
    _trackPoints = [];
    _trackStartedAt = null;
    renderTrackMap();
    updateTrackUI();
    refreshTrackArchiveCount();
  } else {
    toast('Speichern fehlgeschlagen — Punkte bleiben erhalten.', true);
  }
}

// ── Kennzahlen für den Datensatz (Basis fürs spätere Gehirn) ──
function _trackStats(points, found) {
  let path = 0;
  for (let i = 1; i < points.length; i++) {
    path += haversine(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
  }
  let straight = null;
  if (found && points.length > 0) {
    straight = haversine(points[0].lat, points[0].lon, found.lat, found.lon);
  }
  return {
    pointCount:   points.length,
    pathLengthM:  Math.round(path),                       // gelaufene Blutspur-Länge
    straightM:    straight != null ? Math.round(straight) : null, // Luftlinie Start→Fund
  };
}

// ══════════════════════════════════════════
//  UI-Aktualisierung
// ══════════════════════════════════════════
function updateTrackUI() {
  const c = document.getElementById('trackCount');
  if (c) c.textContent = _trackPoints.length;

  // Undo + "Tier gefunden" nur aktiv, wenn es Punkte gibt
  const hasPts = _trackPoints.length > 0;
  ['btnTrackUndo', 'btnTrackFound'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.classList.toggle('disabled', !hasPts);
  });
}

async function refreshTrackArchiveCount() {
  const el = document.getElementById('trackArchive');
  if (!el) return;
  const n = await trackCountArchive();
  el.textContent = n + (n === 1 ? ' Suche gespeichert' : ' Suchen gespeichert');
}
