# h.o.u.n.d.

**Hunt · Orientate · Understand · Navigate · Discover**

Eine Navigations-PWA für Jäger. Zielort vor dem Schuss durch die Kamera
visieren, Laser-Entfernung eingeben — die App berechnet aus GPS, Kompass und
Entfernung die exakte Anschuss-Koordinate und führt per AR-Pin und Karte
dorthin zurück.

**Live:** https://leifdarkstar.github.io/HuntingLocator/

---

## Was die App kann

- **Anschuss markieren.** Kamera + Fadenkreuz, Laser-Distanz eingeben, ein Tap
  und der virtuelle Pin liegt auf der berechneten Zielkoordinate.
- **Zurückfinden.** AR-Modus blendet einen Pin in das Kamera-Livebild ein und
  zeigt Distanz, Richtung, Höhendifferenz. Kartenansicht parallel verfügbar.
- **Hochsitz und Auto speichern.** Mit einem Tap GPS-Standort merken und später
  per AR oder Karte zurücknavigieren.
- **Kompass kalibrieren.** Einmaliger Mess-Vorgang gegen den systematischen
  Kamera-Versatz des iPhones (Linse sitzt nicht in der optischen Achse).
  Bezugspunkt visieren → echte Position auf der Karte tippen → Offset wird in
  Grad gespeichert und auf jeden Anschuss angewendet.
- **GPS-Suchradius.** Pin und Karte zeigen die GPS-Genauigkeit beim Snap als
  Kreis um den Anschuss — man weiß, in welchem Bereich man wirklich suchen muss.
- **Offline-fähig.** Service Worker cached alles beim ersten Besuch. App
  startet im Revier auch ohne Empfang.
- **Installierbar.** Über Safari → „Zum Home-Bildschirm" liegt h.o.u.n.d. wie
  eine echte App auf dem iPhone.

---

## Geplant

- **Track** — Blutspur-Verfolgung mit Richtungsvorhersage und KI-Fotoanalyse
  der Schusslage
- **Wolfpack** — Echtzeit-Gruppenjagd via Firebase, Live-Positionen aller
  Jäger und geteilte Anschüsse
- **Barometer-Höhe** — präzise vertikale AR-Position im Gebirge
- **Heading-Up-Karte** — Karte dreht in Blickrichtung mit

Beide Module zeigen in der App bereits „Coming soon"-Karten. Roadmap siehe
`CLAUDE.md`.

---

## Installation auf dem iPhone

1. https://leifdarkstar.github.io/HuntingLocator/ in **Safari** öffnen
2. Beim ersten Start Kamera-, GPS- und Sensor-Zugriff erlauben
3. Teilen-Symbol (⬆) unten antippen → **„Zum Home-Bildschirm"** → Hinzufügen

Ab jetzt liegt h.o.u.n.d. als Icon auf dem Homescreen und startet im Vollbild.

> Funktioniert nur über `https://`. Sensor- und Kamera-APIs verlangen das.

---

## Technik

Vanilla JavaScript, keine Frameworks, kein Build-Step. Die App besteht aus
einer `index.html` und einer Handvoll kleiner `.js`/`.css`-Module. Hosting über
GitHub Pages.

- **Karte:** Leaflet.js + OpenStreetMap (Graustufen)
- **PWA:** Service Worker + Web-App-Manifest
- **Sensoren:** Geolocation API, DeviceOrientationEvent, DeviceMotionEvent,
  getUserMedia
- **Persistenz:** localStorage (Kompass-Offset)

```
hound/
├── index.html              ← alle Screens (Splash, Menü, Mark, Nav, Map, Kalibrierung)
├── manifest.webmanifest    ← PWA-Manifest
├── sw.js                   ← Service Worker
├── CLAUDE.md               ← Übergabe-Doku (für Entwickler)
│
├── css/                    ← 5 Stylesheets
├── js/                     ← 14 Module (state, sensors, ar, map, mark, …)
└── assets/icons/           ← Pin-PNGs
```

Details zur Architektur und den Konventionen stehen in `CLAUDE.md`.

---

## Mitarbeit

Bugs und Vorschläge gerne als
[GitHub Issue](https://github.com/LeifDarkstar/HuntingLocator/issues).

Für eine Code-Übergabe an einen weiteren Entwickler (oder an Claude Code als
KI-Assistenten) ist `CLAUDE.md` die Erst-Lektüre — sie enthält Architektur,
Konventionen, aktuellen Bug-Stand und Roadmap.

---

## Status

Aktive Entwicklung. Aktueller Stand: `hound-v23-13` (siehe `sw.js`).
Die App wird im Revier getestet und nach jedem Schritt nachjustiert — größere
Sprünge werden bewusst vermieden, weil das Zusammenspiel von GPS, Kompass und
AR im echten Gelände viele Stolperstellen hat.
