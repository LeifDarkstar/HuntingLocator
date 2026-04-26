# h.o.u.n.d. — v21

**Hunt · Orientate · Understand · Navigate · Discover**

Dies ist die neu strukturierte Version deiner App (v21).
Funktional identisch zu v20 — nur sauber in Dateien aufgeteilt, Icons extrahiert, und mit Offline-Unterstützung.

---

## Was ist neu in v21?

- **Ordnerstruktur statt Single-File.** Aus einer 2,1 MB HTML sind ~25 kleine Dateien geworden. Änderungen in der Zukunft werden viel einfacher.
- **Icons als echte PNGs.** Die 24 eingebetteten Base64-Bilder wurden in 7 echte PNG-Dateien extrahiert. Browser können sie jetzt einzeln cachen.
- **Offline-fähig (PWA).** Service Worker (`sw.js`) cached alles beim ersten Besuch. Die App startet auch im Revier ohne Netz.
- **Installierbar.** Über Safari → "Zum Homescreen" liegt h.o.u.n.d. als Icon auf dem iPhone, ohne Adressleiste, wie eine echte App.
- **Keine Funktionsänderungen.** Nichts am Verhalten wurde angepasst. Alle bekannten Bugs aus der Doku sind noch da und werden gezielt im AR-Neuaufbau adressiert.

---

## Ordnerstruktur

```
hound/
├── index.html              ← Einstiegspunkt, DOM-Struktur
├── manifest.webmanifest    ← PWA-Metadaten (Name, Farbe, Icon)
├── sw.js                   ← Service Worker für Offline
├── README.md               ← diese Datei
│
├── css/
│   ├── base.css            ← Farbvariablen, Typography, Toast
│   ├── splash.css          ← Splash-Screen
│   ├── menu.css            ← Hauptmenü mit 4 Rubriken
│   ├── home.css            ← Home-Submenü + AR-Labels
│   └── cam.css             ← Kamera-Screens (mark + nav)
│
├── js/
│   ├── state.js            ← GLOBAL_TARGETS Store + S (Sensor-State)
│   ├── util.js             ← toast, haversine, calcBearing
│   ├── alarm.js            ← WebAudio-Piepen bei "Ziel erreicht"
│   ├── sensors.js          ← GPS + Kompass + Tilt
│   ├── camera.js           ← getUserMedia + Pinch-Zoom
│   ├── ar.js               ← AR-Rendering (Mark-Nav + Home-Nav)
│   ├── map.js              ← Leaflet-Karte
│   ├── navigation.js       ← Bildschirm-Wechsel zwischen Rubriken
│   ├── mark.js             ← Anschuss-Markierung (2-Schritt)
│   ├── home.js             ← Standort speichern (Hochsitz/Auto)
│   ├── splash.js           ← Pin-Carousel Animation
│   └── app.js              ← Boot-Script (Entry Point)
│
└── assets/
    └── icons/
        ├── pin-generic.png
        ├── anschuss.png
        ├── hochsitz.png
        ├── auto.png
        ├── track.png
        ├── wolfpack.png
        └── splash-dog.png
```

---

## So bekommst du das auf GitHub Pages

Du hast zwei Wege — wähle den, der dir leichter fällt.

### Weg A: Parallel zu v20 (empfohlen)

v20 bleibt unter der alten URL erreichbar, v21 testen wir daneben.

1. Gehe auf https://github.com/LeifDarkstar/HuntingLocator
2. Klick oben rechts auf "Add file" → "Upload files"
3. Ziehe den kompletten `hound/` Ordner hinein (nicht den Inhalt — den Ordner als Ganzes)
4. Scrolle runter, gib als Commit-Nachricht ein: `v21: Ordnerstruktur + PWA`
5. Klick "Commit changes"

Ab diesem Moment ist die neue Version unter
**`https://leifdarkstar.github.io/HuntingLocator/hound/`**
erreichbar. Die alte v20 bleibt unter der ursprünglichen URL unverändert.

### Weg B: Ersetzt v20 direkt

Wenn du v20 ablösen willst:

1. Gehe in dein Repo auf https://github.com/LeifDarkstar/HuntingLocator
2. Öffne `wildnav.html` und benenne sie um in `wildnav-20-backup.html` (so bleibt sie als Referenz erhalten)
3. Dann "Add file" → "Upload files" und ziehe den **Inhalt** des `hound/` Ordners (nicht den Ordner selbst) in den Repo-Root
4. Commit-Nachricht: `v21: Komplette Neustrukturierung`
5. Commit

Die App läuft danach wieder unter `https://leifdarkstar.github.io/HuntingLocator/` — jetzt als v21.

---

## Zum Homescreen hinzufügen (Nutzer-Anleitung)

So kann jeder — auch zukünftige zahlende Kunden — h.o.u.n.d. als App auf dem iPhone installieren, ohne App Store:

1. App-URL in Safari öffnen
2. Teilen-Symbol (⬆) unten antippen
3. "Zum Home-Bildschirm" wählen
4. Name bestätigen, "Hinzufügen" tippen

Ab sofort liegt h.o.u.n.d. als Icon auf dem Homescreen und startet im Vollbild.

---

## Was jetzt kommt (nächste Session)

Laut deiner Projektdoku ist der nächste Schritt der **AR-Neuaufbau Schritt 1**: sauberer `GLOBAL_TARGETS` Store. Der liegt jetzt in `js/state.js` und ist bereits der Ankerpunkt — beim AR-Neuaufbau bauen wir darauf eine sauberere API.

Reihenfolge aus der Doku, Abschnitt 10:
1. ✅ Migration auf Ordnerstruktur + PWA (v21 — diese Version)
2. 🔜 AR-Neuaufbau Schritt 1: GLOBAL_TARGETS sauberer machen
3. Schritt 2: Sensor-Erfassung (Kompass, Tilt, **Barometer**)
4. Schritt 3: Markieren neu testen
5. Schritte 4–6: Canvas-basiertes AR mit korrekter vertikaler Position
6. Schritt 7: Karte in Blickrichtung (Heading Up)
7. Schritt 8: Integration aller Module

---

## Was wurde bewusst NICHT geändert

Aus der Lesson "nie mehr als einen Schritt auf einmal ändern":

- **Alle Bugs aus Abschnitt 6 der Doku sind noch da.** Vertikale AR-Position ignoriert weiterhin Höhenunterschiede (`vDiff = -3` in `js/ar.js`). Das fixen wir gezielt im AR-Neuaufbau.
- **Keine State-Persistenz.** Markierungen sind beim Neuladen weg — genau wie bei v20. Persistenz kommt später (LocalStorage / Firebase).
- **Kein neues Feature.** track und wolfpack haben weiterhin nur "Coming soon"-Karten.

Wir haben nur die **Verpackung** verändert, nicht den Inhalt.

---

## Optional später: Leaflet offline

Leaflet wird derzeit vom CDN (`unpkg.com`) geladen. Der Service Worker cached es beim ersten Aufruf, d.h. nach einem einzigen Online-Besuch funktioniert die Karte auch offline.

Wenn du komplett unabhängig vom CDN sein willst:

1. Lade von https://leafletjs.com/download.html die Version 1.9.4 herunter
2. Entpacke, kopiere `leaflet.css`, `leaflet.js` und den `images/` Ordner nach `vendor/leaflet/`
3. In `index.html` ersetze die zwei unpkg-Links durch:
   ```html
   <link rel="stylesheet" href="vendor/leaflet/leaflet.css">
   <script src="vendor/leaflet/leaflet.js"></script>
   ```
4. In `sw.js` die vendor-Pfade zur `APP_SHELL` Liste hinzufügen

Für jetzt ist das nicht nötig.

---

## Fragen / Probleme?

Falls etwas nicht wie erwartet funktioniert:

- **App zeigt alte Version nach Update** → Safari → Einstellungen → Safari → Verlauf und Website-Daten löschen → App neu laden. Der Service Worker hält alte Versionen sonst hartnäckig im Cache. Oder: VERSION in `sw.js` oben hochzählen (`hound-v21-2`) bevor du hochlädst.
- **Icons nicht sichtbar** → Prüfe ob alle PNGs in `assets/icons/` hochgeladen wurden.
- **Karte lädt nicht** → Einmal mit Netz öffnen, damit Leaflet gecacht wird.
