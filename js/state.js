/* ══════════════════════════════════════════
   state.js — Zentraler App-State
   - S          : aktueller Sensor-Zustand (GPS, Heading, Tilt, Snap…)
   - GLOBAL_TARGETS : Alle gespeicherten Ziele
   - HOME_TARGETS   : Live-Proxy auf GLOBAL_TARGETS (Legacy-Kompat)
   - Konstanten: CAM_HFOV, CAM_VFOV, GPS_BUF
   ══════════════════════════════════════════ */

// ── STATE ─────────────────────────────────
const S = {
  lat: null, lon: null, alt: null, acc: null,
  tilt: 0, heading: 0,
  snap: null,
  target: null,        // mark navigator target (kept for compatibility)
  stream: null,
  oriListening: false,
  pinchZoom: 1,
  wasArrived: false,
  headingReady: false,
  headingBuf: [],      // last 5 raw headings (reserviert für AR-Neuaufbau)
};

// ── GLOBAL TARGETS ────────────────────────
// Struktur: GLOBAL_TARGETS[type] = { lat, lon, alt, type, label }
const GLOBAL_TARGETS = {};

// HOME_TARGETS ist ein Live-Proxy in GLOBAL_TARGETS
// (Kompatibilität mit altem Code, der HOME_TARGETS nutzt)
const HOME_TARGETS = {
  get hochsitz() { return GLOBAL_TARGETS['hochsitz'] || null; },
  get auto()     { return GLOBAL_TARGETS['auto']     || null; },
  set hochsitz(v) { if (v) GLOBAL_TARGETS['hochsitz'] = v; else delete GLOBAL_TARGETS['hochsitz']; },
  set auto(v)     { if (v) GLOBAL_TARGETS['auto']     = v; else delete GLOBAL_TARGETS['auto']; },
};

function saveGlobalTarget(type, label, lat, lon, alt) {
  GLOBAL_TARGETS[type] = { lat, lon, alt: alt ?? 0, type, label };
  if (type === 'anschuss') {
    S.target = GLOBAL_TARGETS[type];
  }
  updateAllMapMarkers();
  updateNavButton();
}

function deleteGlobalTarget(type) {
  delete GLOBAL_TARGETS[type];
  if (type === 'anschuss') S.target = null;
  updateAllMapMarkers();
  updateNavButton();
}

function updateAllMapMarkers() {
  if (_homeMap) updateHomeMapMarkers();
}

// ── Kamera FOV (grob geschätzt — für AR-Rechnung) ──
const CAM_HFOV = 65;
const CAM_VFOV = 50;

// ── GPS rolling buffer ────────────────────
const GPS_BUF = [];
