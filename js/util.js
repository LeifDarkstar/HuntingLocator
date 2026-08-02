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

// ── EHRLICHER SUCH-RADIUS ───────────────────
// Der berechnete Zielpunkt streut umso stärker, je weiter der Schuss war:
// GPS-Fehler am Schützenstand + Kompass-Fehler (±10°) wirken sich bei 200 m
// viel heftiger aus als bei 40 m. Statt eine falsch-genaue Meter-Zahl vorzugaukeln,
// leiten wir aus der Schussdistanz (meta.snapDist = Laser) einen realistischen
// Suchradius ab: ~12 % der Schussdistanz, gedeckelt auf [6, 30] m.
//   40 m Schuss  → ~6 m
//   100 m Schuss → ~12 m
//   210 m Schuss → ~25 m   (Leifs Gams-Fall)
// Für direkt gespeicherte Ziele (Hochsitz/Auto, ohne Laser) bleibt es der
// kleine GPS-Radius aus shooterAcc.
function searchRadiusFor(t) {
  const shot = (t && t.meta && t.meta.snapDist != null) ? t.meta.snapDist : null;
  if (shot != null && shot > 0) {
    return Math.round(Math.max(6, Math.min(30, 0.12 * shot)));
  }
  const acc = (t && t.meta && t.meta.shooterAcc) ? t.meta.shooterAcc : null;
  if (acc != null && acc > 0) return Math.round(Math.max(2, Math.min(25, acc)));
  return 6;
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
