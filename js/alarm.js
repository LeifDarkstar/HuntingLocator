/* ══════════════════════════════════════════
   alarm.js — Audio-Piepen für "Ziel erreicht"
   WebAudio-Pipe für Mark-Nav und Home-Nav
   ══════════════════════════════════════════ */

let _audioCtx = null;
let _alarmInterval = null;
let _alarmActive = false;

let _homeAlarmActive = false;
let _homeAlarmInterval = null;

// "Quittiert"-Flags: wenn der Nutzer am Ziel auf OK tippt, schweigt der Alarm,
// solange er im 8-m-Radius bleibt. Erst wenn er das Ziel verlässt und neu
// ankommt, darf der Alarm wieder auslösen. Behebt das "Alarm klebt"-Problem,
// bei dem der Render-Loop den Alarm sofort wieder anschaltete.
let _alarmDismissed = false;
let _homeAlarmDismissed = false;

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

// ── Vibrations-Backup ───────────────────
// Funktioniert auf Android & einigen Browsern.
// iOS Safari ignoriert die Vibration API komplett (Apple-Limit, kein Bug der App).
function triggerArrivalVibration() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      // 200 ms an, 80 ms Pause, 200 ms an, 80 ms Pause, 400 ms an
      navigator.vibrate([200, 80, 200, 80, 400]);
    }
  } catch (e) {}
}

// ── MARK-NAV ALARM ──────────────────────
function startAlarm() {
  if (_alarmActive) return;
  _alarmActive = true;
  const btn = document.getElementById('btn-ack');
  if (btn) btn.style.display = 'block';
  triggerArrivalVibration();
  playBeepSequence();
  _alarmInterval = setInterval(playBeepSequence, 3000);
}
function stopAlarm() {
  _alarmActive = false;
  clearInterval(_alarmInterval);
  _alarmInterval = null;
  const btn = document.getElementById('btn-ack');
  if (btn) btn.style.display = 'none';
  try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) {}
}
function playArrivalSound() { startAlarm(); }

// Nutzer tippt am Ziel auf "OK" → Ton + Button weg, "Ziel gefunden"-Text bleibt.
// Schweigt bis er den Radius verlässt (Flag wird im Render-Loop zurückgesetzt).
function acknowledgeArrival() {
  _alarmDismissed = true;
  stopAlarm();
}

// ── HOME-NAV ALARM ──────────────────────
function startHomeAlarm() {
  if (_homeAlarmActive) return;
  _homeAlarmActive = true;
  const btn = document.getElementById('btn-ack-home');
  if (btn) btn.style.display = 'block';
  triggerArrivalVibration();
  playBeepSequence();
  _homeAlarmInterval = setInterval(playBeepSequence, 3000);
}
function stopHomeAlarm() {
  _homeAlarmActive = false;
  clearInterval(_homeAlarmInterval);
  _homeAlarmInterval = null;
  const btn = document.getElementById('btn-ack-home');
  if (btn) btn.style.display = 'none';
  try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) {}
}
function acknowledgeHomeArrival() {
  _homeAlarmDismissed = true;
  stopHomeAlarm();
}
