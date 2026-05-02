/* ══════════════════════════════════════════
   home.js — Home-Rubrik (Standort speichern + Nav)
   Nutzt neue Helfer aus state.js (TARGETS-Store).
   ══════════════════════════════════════════ */

let _homeTarget = null;   // aktuell ausgewähltes Ziel beim Home-Nav

function markStandort() {
  if (!S.lat || !S.lon) { toast('Warte auf GPS…', true); return; }
  const picker = document.getElementById('s-type-picker');
  picker.style.display = 'flex';
}

function closeTypePicker() {
  document.getElementById('s-type-picker').style.display = 'none';
}

function saveStandort(type) {
  const label = type === 'hochsitz' ? 'Hochsitz' : 'Auto';
  setSingletonTarget(type, {
    label: label,
    lat:   S.lat,
    lon:   S.lon,
    alt:   S.alt != null ? S.alt : 0,
  });

  closeTypePicker();
  document.getElementById('saved' + (type === 'hochsitz' ? 'Hochsitz' : 'Auto')).style.display = 'flex';

  const navBtn = document.getElementById('cardHomeNav');
  if (navBtn) navBtn.style.opacity = '1';

  updateSavedDistances();
  updateHomeMapPlayer();
  updateNavButton();
  toast('\u2713 ' + label + ' gespeichert!');
}

function deleteStandort(type) {
  deleteTargetsByType(type);
  document.getElementById('saved' + (type === 'hochsitz' ? 'Hochsitz' : 'Auto')).style.display = 'none';
  if (!getFirstByType('hochsitz') && !getFirstByType('auto')) {
    const navBtn = document.getElementById('cardHomeNav');
    if (navBtn) navBtn.style.opacity = '0.4';
  }
}

function refreshHomeMenu() {
  // Sync saved-items mit dem aktuellen TARGETS-Stand
  const hochEl = document.getElementById('savedHochsitz');
  const autoEl = document.getElementById('savedAuto');
  const navBtn = document.getElementById('cardHomeNav');
  const hasHoch = !!getFirstByType('hochsitz');
  const hasAuto = !!getFirstByType('auto');
  if (hochEl) hochEl.style.display = hasHoch ? 'flex' : 'none';
  if (autoEl) autoEl.style.display = hasAuto ? 'flex' : 'none';
  if (navBtn) navBtn.style.opacity = (hasHoch || hasAuto) ? '1' : '0.4';
}

function updateSavedDistances() {
  if (!S.lat) return;
  ['hochsitz', 'auto'].forEach(type => {
    const t  = getFirstByType(type);
    const el = document.getElementById('dist' + (type === 'hochsitz' ? 'Hochsitz' : 'Auto'));
    if (t && el) {
      const d = haversine(S.lat, S.lon, t.lat, t.lon);
      el.textContent = d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(2) + ' km';
    }
  });
}

async function goHomeNav() {
  if (!getFirstByType('hochsitz') && !getFirstByType('auto')) {
    toast('Erst Standort markieren!', true);
    return;
  }
  await requestOri();
  document.getElementById('s-home').classList.remove('on');
  const nav = document.getElementById('s-home-nav');
  nav.classList.add('on');
  await attachCam('vid-home-nav');

  _homeTarget = null;
  document.getElementById('homeNavStats').style.display = 'none';
  document.getElementById('homeNavTitle').textContent = 'Ziel wählen';
  startHomeARLoop();
}

function goHomeBack() {
  const nav = document.getElementById('s-home-nav');
  nav.classList.remove('on');
  detachCam('vid-home-nav');
  stopHomeAlarm();
  stopHomeARLoop();

  _homeMapActive = false;
  const mapDiv = document.getElementById('home-map');
  if (mapDiv) mapDiv.style.display = 'none';
  const vid = document.getElementById('vid-home-nav');
  if (vid) vid.style.opacity = '1';
  const btn = document.getElementById('btnToggleMap');
  if (btn) { btn.textContent = '🗺 Karte'; btn.style.borderColor = 'rgba(255,255,255,0.2)'; }

  document.getElementById('s-main').classList.add('on');
  S.headingReady = false;
  updateNavButton();
}

function selectHomeTarget(type) {
  _homeTarget = type;
  const labels = { hochsitz: 'Hochsitz', auto: 'Auto', anschuss: 'Anschuss' };
  document.getElementById('homeNavTitle').textContent = labels[type] || type;
  document.getElementById('homeNavStats').style.display = 'flex';
}
