/* ══════════════════════════════════════════
   util.js — Kleine Helfer
   - toast(msg, err)   : schwebende Statusmeldung
   - haversine(a,b,c,d): Entfernung zweier GPS-Punkte in Metern
   - calcBearing(...)  : Peilung (Kompass-Winkel) zum Zielpunkt
   ══════════════════════════════════════════ */

// ── TOAST ────────────────────────────────
let _tt;
function toast(msg, err = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'show' + (err ? ' err' : '');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.className = '', 3500);
}

// ── GEO MATH ─────────────────────────────
function haversine(a, b, c, d) {
  const R  = 6371000;
  const dL = (c - a) * Math.PI / 180;
  const dl = (d - b) * Math.PI / 180;
  const x  = Math.sin(dL / 2) ** 2
           + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180)
           * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function calcBearing(a, b, c, d) {
  const dl = (d - b) * Math.PI / 180;
  const y  = Math.sin(dl) * Math.cos(c * Math.PI / 180);
  const x  = Math.cos(a * Math.PI / 180) * Math.sin(c * Math.PI / 180)
           - Math.sin(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// ── PERSISTENTER SPEICHER (localStorage) ────
// Speichert kleine Werte (z.B. Kompass-Offset) lokal im Browser.
// Überlebt App-Schließen, App-Updates, iPhone-Neustart.
// Wird gelöscht: bei "Websitedaten löschen" oder iOS-Cleanup nach Wochen Nichtnutzung.
const STORAGE_PREFIX = 'hound.';

function loadValue(key, fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed != null ? parsed : fallback;
  } catch (e) { return fallback; }
}

function saveValue(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) { return false; }
}

function deleteValue(key) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
    return true;
  } catch (e) { return false; }
}

// ── HEADING MITTELWERT ────────────────────
// Zirkulärer Mittelwert von Heading-Werten (in Grad) — wraparound-sicher.
// Beispiel: avg([359°, 1°]) = 0°, NICHT 180°.
// Per Vektor-Trick: Werte in (cos, sin) umrechnen, mitteln, zurück in Grad.
// Nutzen: glättet einzelne Glitch-Frames im Magnetometer ohne den Mittelwert
// auf "die andere Seite des Kreises" zu reißen.
function circularMeanHeading(buf, fallback) {
  if (!buf || buf.length === 0) return fallback != null ? fallback : 0;
  let sumX = 0, sumY = 0;
  for (let i = 0; i < buf.length; i++) {
    const r = buf[i] * Math.PI / 180;
    sumX += Math.cos(r);
    sumY += Math.sin(r);
  }
  const avg = Math.atan2(sumY, sumX) * 180 / Math.PI;
  return (avg + 360) % 360;
}
