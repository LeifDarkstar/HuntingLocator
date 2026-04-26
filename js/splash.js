/* ══════════════════════════════════════════
   splash.js — Pin-Carousel beim Splash + Home-Rubrik
   ══════════════════════════════════════════ */

// Pin-Carousel: 6 Icon-Pfade (durchrotiert auf dem Splash-Screen)
const PIN_SRCS = [
  'assets/icons/pin-generic.png',
  'assets/icons/anschuss.png',
  'assets/icons/track.png',
  'assets/icons/hochsitz.png',
  'assets/icons/auto.png',
  'assets/icons/wolfpack.png',
];

let _pinIdx = 0;

// Home-Rubrik-Karte: 2 Pins (hochsitz + auto) die sich kreuzblenden
function startHomePinCrossfade() {
  let showingA = true;
  setInterval(() => {
    const a = document.getElementById('homePinA');
    const b = document.getElementById('homePinB');
    if (!a || !b) return;
    if (showingA) { a.style.opacity = '0'; b.style.opacity = '1'; }
    else          { a.style.opacity = '1'; b.style.opacity = '0'; }
    showingA = !showingA;
  }, 2200);
}

// Splash: einzelner Pin der alle 2.2s durch die 6 Icons rotiert
function startPinCarousel() {
  setInterval(() => {
    const img = document.getElementById('pinImg');
    if (!img) return;
    img.classList.add('fading');
    setTimeout(() => {
      _pinIdx = (_pinIdx + 1) % PIN_SRCS.length;
      img.src = PIN_SRCS[_pinIdx];
      img.classList.remove('fading');
    }, 500);
  }, 2200);
}
