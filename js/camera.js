/* ══════════════════════════════════════════
   camera.js — getUserMedia + Pinch-Zoom (Mark-Screen)
   ══════════════════════════════════════════ */

async function getCamStream() {
  if (S.stream) return S.stream;
  try {
    S.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:      { ideal: 1280 },
        height:     { ideal: 720 },
      },
      audio: false,
    });
    return S.stream;
  } catch (e) {
    toast('Kamera verweigert – Einstellungen → Safari → Kamera → Erlauben', true);
    return null;
  }
}

async function attachCam(id) {
  const s = await getCamStream();
  if (!s) return;
  const v = document.getElementById(id);
  v.srcObject = s;
  try { await v.play(); }
  catch (e) { setTimeout(() => v.play().catch(() => {}), 200); }
}

function detachCam(id) {
  const v = document.getElementById(id);
  if (v) { v.pause(); v.srcObject = null; }
}

// ── PINCH ZOOM (nur auf Mark-Screen aktiv) ──
function initPinch(videoId) {
  const el = document.getElementById('s-mark');
  let startDist = 0;
  let startZoom = 1;

  el.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      startDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      startZoom = S.pinchZoom;
    }
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      S.pinchZoom = Math.min(5, Math.max(1, startZoom * (d / startDist)));
      const vid = document.getElementById(videoId);
      // Nur das Video skalieren – Overlays bleiben
      vid.style.transform = 'scale(' + S.pinchZoom + ')';
    }
  }, { passive: false });
}
