/* ══════════════════════════════════════════
   navigation.js — Bildschirm-Wechsel zwischen Rubriken
   + zentraler Nav-Button (goGlobalNav)
   + leaveSplash (Splash → Hauptmenü)
   ══════════════════════════════════════════ */

function leaveSplash() {
  const splash = document.getElementById('s-splash');
  // Sofort ausblenden – keine Animation die blockieren könnte
  splash.style.display = 'none';
  splash.classList.remove('on');

  const main = document.getElementById('s-main');
  main.classList.add('on');
  main.style.display = 'flex';

  const btn = document.getElementById('btn-central-nav');
  if (btn) btn.classList.add('visible');
  if (typeof updateNavButton === 'function') updateNavButton();
}

async function goMark() {
  await requestOri();
  document.getElementById('s-home').classList.remove('on');
  document.getElementById('s-nav').classList.remove('on');
  detachCam('vid-nav');
  S.pinchZoom = 1;
  showMarkStep(1);
  document.getElementById('s-mark').classList.add('on');
  await attachCam('vid-mark');
  initPinch('vid-mark');
}

async function goNav() {
  if (!getActiveAnschuss()) { toast('Zuerst einen Anschuss markieren!', true); return; }
  await requestOri();
  document.getElementById('s-home').classList.remove('on');
  document.getElementById('s-mark').classList.remove('on');
  detachCam('vid-mark');

  // Arrived-State zurücksetzen damit Alarm + Pin + Meldung frisch triggern
  S.wasArrived = false;
  stopAlarm();
  document.getElementById('arrivedMsg').classList.remove('show');
  document.getElementById('btn-stop-alarm').style.display = 'none';
  document.getElementById('ar-dot').style.display = 'none';

  document.getElementById('s-nav').classList.add('on');
  await attachCam('vid-nav');
  renderAR();
  startARLoop();
}

// goHome = zurück ins Hauptmenü (resettet Target-Markierung + stoppt Alarm/Loop)
function goHome() {
  document.getElementById('s-mark').classList.remove('on');
  document.getElementById('s-nav').classList.remove('on');
  document.getElementById('s-mark-menu').classList.remove('on');
  detachCam('vid-mark');
  detachCam('vid-nav');

  const vm = document.getElementById('vid-mark');
  if (vm) vm.style.transform = 'scale(1)';
  S.pinchZoom = 1;

  stopAlarm();
  stopARLoop();

  document.getElementById('s-main').classList.add('on');
  updateNavButton();
}

function goMainMenu() {
  // Nur classList – niemals mit style.display auf Screen-Elementen mischen
  ['s-home', 's-mark', 's-nav', 's-mark-menu', 's-home-nav'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('on');
  });

  // Type-Picker ist ein Modal – hier style.display ok
  const picker = document.getElementById('s-type-picker');
  if (picker) picker.style.display = 'none';

  // Kamera-Streams stoppen
  detachCam('vid-mark');
  detachCam('vid-nav');
  detachCam('vid-home-nav');

  // Alarme + Loops stoppen
  stopAlarm();
  stopHomeAlarm();
  stopARLoop();
  stopHomeARLoop();

  // Karten-State zurücksetzen
  _homeMapActive = false;
  const mapDiv = document.getElementById('home-map');
  if (mapDiv) mapDiv.style.display = 'none';
  const vid = document.getElementById('vid-home-nav');
  if (vid) vid.style.opacity = '1';
  const btn = document.getElementById('btnToggleMap');
  if (btn) { btn.textContent = '🗺 Karte'; btn.style.borderColor = 'rgba(255,255,255,0.2)'; }

  document.getElementById('s-main').classList.add('on');
  updateNavButton();
}

function goRubrik(name) {
  document.getElementById('s-main').classList.remove('on');
  if (name === 'home') {
    document.getElementById('s-home').classList.add('on');
    updateSavedDistances();
    updateHomeMapPlayer();
  } else if (name === 'mark') {
    document.getElementById('s-mark-menu').classList.add('on');
  } else {
    document.getElementById('s-main').classList.add('on');
    toast('Coming soon – wird in einer späteren Version verfügbar sein.');
  }
}

function showMarkStep(n) {
  document.getElementById('mark-step1').style.display = n === 1 ? 'flex' : 'none';
  document.getElementById('mark-step2').style.display = n === 2 ? 'flex' : 'none';
  document.getElementById('markTitle').textContent = n === 1 ? 'Ziel einrahmen' : 'Entfernung eingeben';
}

// ── Zentraler Navigations-Button ──────────
function updateNavButton() {
  const btn = document.getElementById('btn-central-nav');
  const cnt = document.getElementById('navBtnCount');
  if (!btn) return;
  const n = targetCount();
  if (n > 0) {
    btn.classList.add('visible', 'has-targets');
    if (cnt) cnt.textContent = n + ' Ziel' + (n > 1 ? 'e' : '');
  } else {
    btn.classList.add('visible');
    btn.classList.remove('has-targets');
    if (cnt) cnt.textContent = '—';
  }
}

async function goGlobalNav() {
  if (!hasTargets()) {
    toast('Noch keine Ziele gespeichert!', true);
    return;
  }
  await requestOri();
  document.getElementById('s-main').classList.remove('on');
  const nav = document.getElementById('s-home-nav');
  nav.classList.add('on');
  await attachCam('vid-home-nav');

  _homeTarget = null;
  document.getElementById('homeNavStats').style.display = 'none';

  const n = targetCount();
  document.getElementById('homeNavTitle').textContent =
    n + ' Ziel' + (n > 1 ? 'e' : '') + ' – antippen zum Navigieren';

  // Karten-Modus zurück auf AR
  _homeMapActive = false;
  S.headingReady = true;
  const mapDiv2 = document.getElementById('home-map');
  if (mapDiv2) mapDiv2.style.display = 'none';
  const vid2 = document.getElementById('vid-home-nav');
  if (vid2) vid2.style.opacity = '1';
  const btnMap = document.getElementById('btnToggleMap');
  if (btnMap) { btnMap.textContent = '🗺 Karte'; btnMap.style.borderColor = 'rgba(255,255,255,0.2)'; }

  // Alle AR-Pins sauber zurücksetzen
  ['ar-hochsitz', 'ar-auto', 'ar-anschuss',
   'edge-hochsitz', 'edge-auto', 'edge-anschuss'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.style.visibility = ''; el.style.opacity = '1'; }
  });

  setTimeout(() => startHomeARLoop(), 150);
}
