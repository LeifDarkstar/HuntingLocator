/* ══════════════════════════════════════════
   alarm.js — Audio-Piepen für "Ziel erreicht"
   WebAudio-Pipe für Mark-Nav und Home-Nav
   ══════════════════════════════════════════ */

let _audioCtx = null;
let _alarmInterval = null;
let _alarmActive = false;

let _homeAlarmActive = false;
let _homeAlarmInterval = null;

function getAudioCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

// Audio auf iOS muss beim ersten Touch „freigeschaltet" werden
document.addEventListener('touchstart', () => {
  try { getAudioCtx(); } catch (e) {}
}, { once: true });

// 3 aufsteigende Töne (880 / 1100 / 1320 Hz)
function playBeepSequence() {
  try {
    const ctx = getAudioCtx();
    [0, 0.22, 0.44].forEach((t, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880 + i * 220;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.001, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.55,  ctx.currentTime + t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.32);
      osc.start(ctx.currentTime + t);
      osc.stop( ctx.currentTime + t + 0.38);
    });
  } catch (e) {}
}

// ── MARK-NAV ALARM ──────────────────────
function startAlarm() {
  if (_alarmActive) return;
  _alarmActive = true;
  document.getElementById('btn-stop-alarm').style.display = 'block';
  playBeepSequence();
  _alarmInterval = setInterval(playBeepSequence, 3000);
}
function stopAlarm() {
  _alarmActive = false;
  clearInterval(_alarmInterval);
  _alarmInterval = null;
  const btn = document.getElementById('btn-stop-alarm');
  if (btn) btn.style.display = 'none';
}
function playArrivalSound() { startAlarm(); }

// ── HOME-NAV ALARM ──────────────────────
function startHomeAlarm() {
  if (_homeAlarmActive) return;
  _homeAlarmActive = true;
  document.getElementById('btn-stop-home-alarm').style.display = 'block';
  playBeepSequence();
  _homeAlarmInterval = setInterval(playBeepSequence, 3000);
}
function stopHomeAlarm() {
  _homeAlarmActive = false;
  clearInterval(_homeAlarmInterval);
  _homeAlarmInterval = null;
  const btn = document.getElementById('btn-stop-home-alarm');
  if (btn) btn.style.display = 'none';
}
