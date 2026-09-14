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
    // Continuous Autofocus anfordern, falls vom Browser unterstützt.
    // iOS Safari (neuere Versionen) und Android Chrome unterstützen das in der
    // Regel. Fällt still zurück, wenn nicht.
    try {
      const track = S.stream.getVideoTracks()[0];
      if (track && typeof track.applyConstraints === 'function') {
        await track.applyConstraints({
          advanced: [
            { focusMode: 'continuous' },
            { exposureMode: 'continuous' },
            { whiteBalanceMode: 'continuous' },
          ],
        });
      }
    } catch (e) { /* Browser unterstützt keine Fokus-Steuerung — egal */ }
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

/* ══════════════════════════════════════════
   Automatischer Kontrast für Overlay-Texte über dem Kamerabild.

   Problem: Die GPS-Anzeige ist laut Design schwarz. Über einem hellen
   Himmel ist das perfekt lesbar — über dunklem Wald aber unsichtbar.

   Lösung: Wir messen ~2×/Sekunde die Helligkeit des Kamerabild-Ausschnitts
   GENAU DORT, wo die Anzeige sitzt (oben rechts), und schalten die Schrift
   zwischen Schwarz (heller Grund) und Weiß (dunkler Grund) um.
   Hysterese (125/155) verhindert Flackern an der Schwelle.
   ══════════════════════════════════════════ */
let _acTimer    = null;
let _acCanvas   = null;
let _acIsDark   = null;
let _acSelector = null;

function startAutoContrast(videoId, selector) {
  stopAutoContrast();
  const video = document.getElementById(videoId);
  if (!video) return;
  _acSelector = selector;

  if (!_acCanvas) {
    _acCanvas = document.createElement('canvas');
    _acCanvas.width  = 8;
    _acCanvas.height = 8;
  }
  const ctx = _acCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  _acTimer = setInterval(() => {
    if (!video.videoWidth || video.readyState < 2) return;
    const vw = video.videoWidth, vh = video.videoHeight;

    // Ausschnitt oben rechts — dort sitzt die GPS-Anzeige.
    const sx = Math.floor(vw * 0.62);
    const sw = Math.max(1, Math.floor(vw * 0.38));
    const sh = Math.max(1, Math.floor(vh * 0.14));

    let lum;
    try {
      ctx.drawImage(video, sx, 0, sw, sh, 0, 0, 8, 8);
      const d = ctx.getImageData(0, 0, 8, 8).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) {
        sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      }
      lum = sum / (d.length / 4);
    } catch (e) {
      return;   // z.B. noch kein Frame — einfach nächsten Durchlauf abwarten
    }

    let dark = _acIsDark;
    if      (lum < 125) dark = true;    // dunkler Grund → weiße Schrift
    else if (lum > 155) dark = false;   // heller Grund  → schwarze Schrift
    if (dark === _acIsDark) return;

    _acIsDark = dark;
    document.querySelectorAll(selector).forEach(el => {
      el.classList.toggle('on-dark', !!dark);
    });
  }, 400);
}

function stopAutoContrast() {
  if (_acTimer) { clearInterval(_acTimer); _acTimer = null; }
  // Farbe sauber auf den Ausgangszustand (schwarz) zurücksetzen
  if (_acSelector) {
    document.querySelectorAll(_acSelector).forEach(el => el.classList.remove('on-dark'));
    _acSelector = null;
  }
  _acIsDark = null;
}
