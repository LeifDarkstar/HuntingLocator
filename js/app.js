/* ══════════════════════════════════════════
   app.js — Entry Point / Boot
   Wird als letztes geladen; alle Module sind bereits initialisiert.
   ══════════════════════════════════════════ */

window.addEventListener('load', () => {
  // Versions-Badge auf dem Splash aus der zentralen Konstante setzen
  // (AR_HUD_VERSION lebt in ar.js → eine Stelle zum Hochzählen).
  const verEl = document.getElementById('splashVersion');
  if (verEl && typeof AR_HUD_VERSION === 'string') verEl.textContent = AR_HUD_VERSION;

  // Gespeicherte Ziele (Hochsitz, Auto, Anschuss) aus localStorage laden
  restoreTargets();

  // Nav-Button direkt beim Start initialisieren
  updateNavButton();

  // Sensoren starten
  startGPS();

  // Pin-Animationen
  startPinCarousel();
  startHomePinCrossfade();

  // DeviceOrientation-Listener: auf Android sofort starten.
  // Auf iOS erst nach Nutzer-Geste (requestOri) → geschieht bei goMark / goNav.
  if (!(typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function')) {
    listenOri();
  }

  // Service Worker registrieren für Offline-Support (nur wenn unterstützt)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Silent fail – ohne SW funktioniert die App trotzdem online
    });
  }
});
