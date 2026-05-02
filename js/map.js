/* ══════════════════════════════════════════
   map.js — Leaflet Karte (home-nav → Kartenansicht)
   ══════════════════════════════════════════ */

let _homeMap = null;
let _homeMapActive = false;
let _homeMapMarkers = {};
let _homePlayerMarker = null;

// Pfade zu den Icon-Dateien (extrahiert aus Base64)
const HOCHSITZ_ICON = 'assets/icons/hochsitz.png';
const ANSCHUSS_ICON = 'assets/icons/anschuss.png';
const AUTO_ICON     = 'assets/icons/auto.png';

function toggleHomeMap() {
  _homeMapActive = !_homeMapActive;
  const mapDiv = document.getElementById('home-map');
  const camVid = document.getElementById('vid-home-nav');
  const arHoch = document.getElementById('ar-hochsitz');
  const arAuto = document.getElementById('ar-auto');
  const edgeH  = document.getElementById('edge-hochsitz');
  const edgeA  = document.getElementById('edge-auto');
  const btn    = document.getElementById('btnToggleMap');

  if (_homeMapActive) {
    mapDiv.style.display = 'block';
    camVid.style.opacity = '0';
    const arAnschuss   = document.getElementById('ar-anschuss');
    const edgeAnschuss = document.getElementById('edge-anschuss');
    [arHoch, arAuto, edgeH, edgeA, arAnschuss, edgeAnschuss].forEach(el => {
      if (el) { el.style.display = 'none'; el.style.visibility = 'hidden'; }
    });
    btn.textContent = '📷 AR';
    btn.style.borderColor = 'var(--accent)';
    initHomeMap();
  } else {
    mapDiv.style.display = 'none';
    camVid.style.opacity = '1';
    const arAnschuss2   = document.getElementById('ar-anschuss');
    const edgeAnschuss2 = document.getElementById('edge-anschuss');
    [arHoch, arAuto, edgeH, edgeA, arAnschuss2, edgeAnschuss2].forEach(el => {
      if (el) { el.style.display = ''; el.style.visibility = ''; }
    });
    btn.textContent = '🗺 Karte';
    btn.style.borderColor = 'rgba(255,255,255,0.2)';
  }
}

function initHomeMap() {
  if (!S.lat) { toast('Warte auf GPS…', true); return; }

  if (!_homeMap) {
    _homeMap = L.map('home-map', {
      zoomControl:        true,
      attributionControl: false,
    }).setView([S.lat, S.lon], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(_homeMap);
  } else {
    _homeMap.setView([S.lat, S.lon], 16);
  }

  // Player-Marker (blauer Punkt)
  if (_homePlayerMarker) {
    _homePlayerMarker.setLatLng([S.lat, S.lon]);
  } else {
    const playerIcon = L.divIcon({
      html:       '<div style="width:16px;height:16px;background:#4a90d9;' +
                  'border:2px solid #fff;border-radius:50%;' +
                  'box-shadow:0 0 8px rgba(74,144,217,0.8);"></div>',
      className:  '',
      iconAnchor: [8, 8],
    });
    _homePlayerMarker = L.marker([S.lat, S.lon], { icon: playerIcon }).addTo(_homeMap);
  }

  // Hochsitz + Auto Marker
  ['hochsitz', 'auto'].forEach(type => {
    const t = GLOBAL_TARGETS[type];
    if (!t) return;

    const iconSrc = type === 'hochsitz' ? HOCHSITZ_ICON : AUTO_ICON;
    const label   = type === 'hochsitz' ? 'Hochsitz' : 'Auto';
    const pinIcon = createMapPinIcon(iconSrc, label);

    if (_homeMapMarkers[type]) {
      _homeMapMarkers[type].setLatLng([t.lat, t.lon]);
    } else {
      _homeMapMarkers[type] = L.marker([t.lat, t.lon], { icon: pinIcon })
        .addTo(_homeMap)
        .on('click', () => selectHomeTarget(type));
    }
  });

  // Kartenausschnitt so wählen dass alles sichtbar ist
  const points = [[S.lat, S.lon]];
  ['hochsitz', 'auto'].forEach(type => {
    if (HOME_TARGETS[type]) points.push([HOME_TARGETS[type].lat, HOME_TARGETS[type].lon]);
  });
  if (points.length > 1) {
    _homeMap.fitBounds(L.latLngBounds(points), { padding: [60, 60] });
  }

  setTimeout(() => {
    if (_homeMap) {
      _homeMap.invalidateSize();
      updateHomeMapMarkers();
    }
  }, 150);
  updateHomeMapMarkers();
}

function updateHomeMapMarkers() {
  if (!_homeMap) return;
  const allTypes = [
    { type: 'hochsitz', iconSrc: HOCHSITZ_ICON, label: 'Hochsitz' },
    { type: 'auto',     iconSrc: AUTO_ICON,     label: 'Auto' },
    { type: 'anschuss', iconSrc: ANSCHUSS_ICON, label: 'Anschuss' },
  ];
  allTypes.forEach(({ type, iconSrc, label }) => {
    const t = GLOBAL_TARGETS[type];
    if (!t) {
      if (_homeMapMarkers[type]) {
        _homeMap.removeLayer(_homeMapMarkers[type]);
        delete _homeMapMarkers[type];
      }
      return;
    }
    const pinIcon = createMapPinIcon(iconSrc, label);
    if (_homeMapMarkers[type]) {
      _homeMapMarkers[type].setLatLng([t.lat, t.lon]).setIcon(pinIcon);
    } else {
      _homeMapMarkers[type] = L.marker([t.lat, t.lon], { icon: pinIcon }).addTo(_homeMap);
    }
  });
}

// ── Helfer: Konsistente Pin-Icons für die Karte ────
// Wichtig: iconSize + iconAnchor sauber definieren, sonst springt die Pin-Spitze
// bei verschiedenen Zoomstufen scheinbar weg von der echten Koordinate.
//
// Pin-Bild ist 264×330 px (verhältnis ≈ 0.8). Bei Width 48 → Height 60.
// Pin-Spitze (untere Spitze des Tropfens, wo die Schatten-Ellipse ist) liegt
// bei y ≈ 60 im gerenderten Icon. Genau dort muss der Anker sein.
function createMapPinIcon(iconSrc, label) {
  return L.divIcon({
    html:
      '<div style="width:60px;text-align:center;line-height:0;pointer-events:none;">' +
        '<img src="' + iconSrc + '" style="width:48px;height:60px;display:inline-block;' +
        'filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));">' +
        '<div style="line-height:1.1;margin-top:2px;background:rgba(0,0,0,0.65);' +
        'color:#fff;font-size:10px;padding:1px 5px;border-radius:3px;' +
        'white-space:nowrap;font-family:monospace;letter-spacing:1px;display:inline-block;">' +
          label +
        '</div>' +
      '</div>',
    className:  '',
    iconSize:   [60, 80],
    iconAnchor: [30, 60],   // Pin-Spitze auf die echte lat/lon-Position
  });
}

function updateHomeMapPlayer() {
  if (!_homeMapActive || !_homeMap || !S.lat) return;
  if (_homePlayerMarker) _homePlayerMarker.setLatLng([S.lat, S.lon]);
}
