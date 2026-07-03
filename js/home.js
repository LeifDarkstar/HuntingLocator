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
    meta: {
      shooterAcc: S.acc,   // GPS-Genauigkeit beim Speichern, für den Suchradius-Kreis
    },
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

  // Alle anderen Screens sauber ausblenden (defensiv gegen Überlagerungen)
  ['s-main', 's-home', 's-mark', 's-nav', 's-mark-menu'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('on');
  });
  detachCam('vid-mark');
  detachCam('vid-nav');
  stopAlarm();
  if (typeof stopARLoop === 'function') stopARLoop();

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

  // Zurück zur Ziel-Liste (nicht ins Hauptmenü) → der Nutzer kann direkt ein
  // anderes Ziel wählen. Wenn keine Ziele mehr existieren, ins Hauptmenü.
  S.headingReady = false;
  _homeTarget = null;
  updateNavButton();
  if (hasTargets()) {
    document.getElementById('s-target-list').classList.add('on');
    renderTargetList();
  } else {
    document.getElementById('s-main').classList.add('on');
  }
}

// ── Ziel-Übersichtsliste (zentrales Zielsuchmenü) ──
function targetDistText(t) {
  if (!S.lat || t.lat == null) return '—';
  const d = haversine(S.lat, S.lon, t.lat, t.lon);
  return d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(2) + ' km';
}

// Nur die Distanz-Texte aktualisieren (kein Rebuild → keine verlorenen Taps).
function updateTargetListDistances() {
  document.querySelectorAll('#targetListBody .saved-dist[data-dist-type]').forEach(el => {
    const t = getFirstByType(el.getAttribute('data-dist-type'));
    if (t) el.textContent = targetDistText(t);
  });
}

function renderTargetList() {
  const body  = document.getElementById('targetListBody');
  const empty = document.getElementById('targetListEmpty');
  if (!body) return;

  const defs = [
    { type: 'anschuss', icon: 'assets/icons/anschuss.png', label: 'Anschuss' },
    { type: 'hochsitz', icon: 'assets/icons/hochsitz.png', label: 'Hochsitz' },
    { type: 'auto',     icon: 'assets/icons/auto.png',     label: 'Auto' },
  ];

  body.innerHTML = '';
  let count = 0;
  defs.forEach(({ type, icon, label }) => {
    const t = getFirstByType(type);
    if (!t) return;
    count++;

    const item = document.createElement('div');
    item.className = 'saved-item';
    item.innerHTML =
      '<img src="' + icon + '" style="width:36px;height:auto;">' +
      '<div class="saved-info">' +
        '<div class="saved-name">' + label + '</div>' +
        '<div class="saved-dist" data-dist-type="' + type + '">' + targetDistText(t) + '</div>' +
      '</div>' +
      '<button class="saved-go" type="button">Hinführen</button>' +
      '<button class="saved-del" type="button">✕</button>';
    item.querySelector('.saved-go').onclick  = () => navToTarget(type);
    item.querySelector('.saved-del').onclick = () => deleteTargetFromList(type);
    body.appendChild(item);
  });

  if (empty) empty.style.display = count === 0 ? 'block' : 'none';
}

function deleteTargetFromList(type) {
  deleteTargetsByType(type);
  // Home-Submenü-Einträge (Hochsitz/Auto) mit synchronisieren
  if (type === 'hochsitz' || type === 'auto') {
    const el = document.getElementById('saved' + (type === 'hochsitz' ? 'Hochsitz' : 'Auto'));
    if (el) el.style.display = 'none';
  }
  updateNavButton();
  renderTargetList();
  toast('Ziel gelöscht.');
}

function selectHomeTarget(type) {
  _homeTarget = type;
  const labels = { hochsitz: 'Hochsitz', auto: 'Auto', anschuss: 'Anschuss' };
  document.getElementById('homeNavTitle').textContent = labels[type] || type;
  document.getElementById('homeNavStats').style.display = 'flex';
}
