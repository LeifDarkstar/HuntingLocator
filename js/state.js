/* ══════════════════════════════════════════
   state.js — Zentraler App-State
   - S         : aktueller Sensor-Zustand (GPS, Heading, Tilt, Snap…)
   - TARGETS   : Liste aller gespeicherten Ziele (Single Source of Truth)
   - Helfer-API um Ziele zu lesen/schreiben
   - Konstanten: CAM_HFOV, CAM_VFOV, GPS_BUF
   - Kompat-Layer: GLOBAL_TARGETS / HOME_TARGETS / S.target als Proxy
                   (alter Code funktioniert weiter, liest aber aus TARGETS)
   ══════════════════════════════════════════ */

// ── STATE ─────────────────────────────────
const S = {
  lat: null, lon: null, alt: null, acc: null,
  tilt: 0, heading: 0,
  headingAcc: null,    // Kompass-Genauigkeit in Grad (iOS), null = unbekannt/Android
  snap: null,
  // target: weggefallen → siehe Getter weiter unten (S.target = getActiveAnschuss())
  stream: null,
  oriListening: false,
  pinchZoom: 1,
  wasArrived: false,
  headingReady: false,
  headingBuf: [],      // last 5 raw headings (reserviert für AR-Neuaufbau)
};

// ══════════════════════════════════════════
// TARGETS — Single Source of Truth
// ══════════════════════════════════════════
//
// Jedes Ziel ist ein Objekt:
//
//   id          string         // eindeutig (auto-generiert)
//   type        string         // 'hochsitz' | 'auto' | 'anschuss' | 'blut' | 'jaeger' | 'drohne' | …
//   label       string         // Anzeigename
//   lat, lon    number         // Position
//   alt         number         // Höhe in m (kann ungenau sein)
//
//   createdAt   number         // unix-ms — für Sortierung & Sync
//   updatedAt   number         // unix-ms — für Live-Updates (Wolfpack)
//
//   owner       string|null    // Jäger-ID (Wolfpack), null = lokal
//   wolfpackId  string|null    // null = nicht geteilt
//   color       string|null    // hex-Farbe (Wolfpack-Identifikation)
//
//   meta        object         // typ-spezifisch:
//                               //   anschuss : { snapDist, snapHeading, snapTilt, position }
//                               //   blut     : { sequenz, fotoUrl, schussLage }
//                               //   jaeger   : { heading, speed, batterie }
//                               //   drohne   : { isLive, batterie, hoehe }

const TARGETS = [];

// ── ID-Generator ──────────────────────────
let _targetIdSeed = 0;
function _newTargetId(type) {
  _targetIdSeed++;
  return type + '-' + Date.now().toString(36) + '-' + _targetIdSeed;
}

// ── Helfer: LESEN ─────────────────────────
function getAllTargets()         { return TARGETS.slice(); }
function getTarget(id)           { return TARGETS.find(t => t.id === id) || null; }
function getTargetsByType(type)  { return TARGETS.filter(t => t.type === type); }
function getFirstByType(type)    { const l = getTargetsByType(type); return l.length ? l[0] : null; }
function getLatestByType(type)   { const l = getTargetsByType(type); return l.length ? l[l.length - 1] : null; }
function getActiveAnschuss()     { return getLatestByType('anschuss'); }
function targetCount()           { return TARGETS.length; }
function hasTargets()            { return TARGETS.length > 0; }

function getTypesPresent() {
  const set = new Set();
  TARGETS.forEach(t => set.add(t.type));
  return Array.from(set);
}

// ── Helfer: SCHREIBEN ─────────────────────
function addTarget(props) {
  const p = props || {};
  if (!p.type || p.lat == null || p.lon == null) {
    console.warn('addTarget: type/lat/lon required', p);
    return null;
  }
  const now = Date.now();
  const target = {
    id:         _newTargetId(p.type),
    type:       p.type,
    label:      p.label || p.type,
    lat:        p.lat,
    lon:        p.lon,
    alt:        p.alt != null ? p.alt : 0,
    createdAt:  now,
    updatedAt:  now,
    owner:      p.owner      != null ? p.owner      : null,
    wolfpackId: p.wolfpackId != null ? p.wolfpackId : null,
    color:      p.color      != null ? p.color      : null,
    meta:       p.meta || {},
  };
  TARGETS.push(target);
  _afterTargetChange();
  return target;
}

function updateTarget(id, patch) {
  const t = getTarget(id);
  if (!t) return null;
  Object.assign(t, patch, { updatedAt: Date.now() });
  _afterTargetChange();
  return t;
}

function deleteTarget(id) {
  const idx = TARGETS.findIndex(t => t.id === id);
  if (idx < 0) return false;
  TARGETS.splice(idx, 1);
  _afterTargetChange();
  return true;
}

function deleteTargetsByType(type) {
  let removed = 0;
  for (let i = TARGETS.length - 1; i >= 0; i--) {
    if (TARGETS[i].type === type) {
      TARGETS.splice(i, 1);
      removed++;
    }
  }
  if (removed > 0) _afterTargetChange();
  return removed;
}

// "Setze einziges Ziel dieses Typs" – ersetzt vorhandenes oder fügt hinzu.
// Praktisch für hochsitz/auto/anschuss, von denen es (heute) immer nur eines gibt.
function setSingletonTarget(type, props) {
  deleteTargetsByType(type);
  return addTarget(Object.assign({}, props, { type: type }));
}

// ── Hook nach jeder Änderung ──────────────
function _afterTargetChange() {
  if (typeof updateAllMapMarkers === 'function') updateAllMapMarkers();
  if (typeof updateNavButton    === 'function') updateNavButton();
  if (typeof refreshHomeMenu    === 'function') refreshHomeMenu();
}

// ══════════════════════════════════════════
// KOMPATIBILITÄTS-LAYER (Legacy)
// Alter Code, der GLOBAL_TARGETS['hochsitz'] o.ä. liest oder S.target nutzt,
// funktioniert weiter — die Werte kommen jetzt aber aus TARGETS.
// Wird beim AR-Neuaufbau Schritt 2+ schrittweise zurückgebaut.
// ══════════════════════════════════════════

// GLOBAL_TARGETS[type] → liefert das Singleton-Ziel des Typs (oder null)
const GLOBAL_TARGETS = new Proxy({}, {
  get(_, type) {
    if (typeof type !== 'string') return undefined;
    return getFirstByType(type);
  },
  has(_, type) {
    return typeof type === 'string' && getTargetsByType(type).length > 0;
  },
  ownKeys() {
    return getTypesPresent();
  },
  getOwnPropertyDescriptor(_, type) {
    if (typeof type === 'string' && getTargetsByType(type).length > 0) {
      return { enumerable: true, configurable: true, writable: true, value: getFirstByType(type) };
    }
    return undefined;
  },
});

// HOME_TARGETS[type] = {…}    → setSingletonTarget
// HOME_TARGETS[type] = null   → deleteTargetsByType
const HOME_TARGETS = new Proxy({}, {
  get(_, type) {
    if (typeof type !== 'string') return undefined;
    return getFirstByType(type);
  },
  set(_, type, value) {
    if (typeof type !== 'string') return false;
    if (value == null) {
      deleteTargetsByType(type);
    } else {
      setSingletonTarget(type, value);
    }
    return true;
  },
  deleteProperty(_, type) {
    if (typeof type !== 'string') return false;
    deleteTargetsByType(type);
    return true;
  },
  has(_, type) {
    return typeof type === 'string' && getTargetsByType(type).length > 0;
  },
});

// S.target → Live-Getter auf den aktiven Anschuss
Object.defineProperty(S, 'target', {
  configurable: true,
  enumerable:   true,
  get() { return getActiveAnschuss(); },
  set(_v) {
    // Direktes Setzen wird ignoriert — bitte addTarget() / setSingletonTarget() benutzen.
    console.warn('[state] S.target = ... ist veraltet. Bitte setSingletonTarget(\'anschuss\', …) verwenden.');
  },
});

// Legacy-Funktionen — leiten auf die neuen Helfer um
function saveGlobalTarget(type, label, lat, lon, alt) {
  return setSingletonTarget(type, { label: label, lat: lat, lon: lon, alt: alt != null ? alt : 0 });
}

function deleteGlobalTarget(type) {
  deleteTargetsByType(type);
}

function updateAllMapMarkers() {
  if (typeof _homeMap !== 'undefined' && _homeMap && typeof updateHomeMapMarkers === 'function') {
    updateHomeMapMarkers();
  }
}

// ── Kamera FOV (grob geschätzt — für AR-Rechnung) ──
const CAM_HFOV = 65;
const CAM_VFOV = 50;

// ── GPS rolling buffer ────────────────────
const GPS_BUF = [];
