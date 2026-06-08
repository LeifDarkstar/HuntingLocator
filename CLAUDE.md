# CLAUDE.md — Übergabe-Doku für Claude Code

Diese Datei ist die Erst-Lektüre für jeden Claude, der dieses Projekt übernimmt.
Sie ergänzt die ältere `hound_projektdoku.docx` mit dem aktuellen Stand.

---

## 1. Was ist h.o.u.n.d.?

**Hunt · Orientate · Understand · Navigate · Discover** — eine mobile Web-App
(PWA) für Jäger, die in unwegsamem Gelände (Wald, Gebirge) navigieren müssen.

Kernfunktion: Vor dem Schuss durch die Kamera visieren, Laser-Entfernung
eingeben, die App berechnet aus GPS + Kompass + Entfernung die exakte
Zielkoordinate. Im AR-Modus wird ein virtueller Pin am Anschussort eingeblendet,
der den Jäger zurückführt. Zusätzlich speicherbar: Hochsitz, Auto.

**Zielplattform:** primär iPhone/iOS Safari (Jäger nutzen iPhone in der Praxis).
Android funktioniert grundsätzlich, ist aber nicht priorisiert getestet.

---

## 2. Deployment

| | |
|---|---|
| **Live-URL** | https://leifdarkstar.github.io/HuntingLocator/ |
| **Repo** | https://github.com/LeifDarkstar/HuntingLocator (public) |
| **Hosting** | GitHub Pages (kostenlos, automatisches Deploy bei Upload) |
| **Deploy-Weg** | Der User lädt Dateien manuell via GitHub-Web-UI hoch — er nutzt **keine Git-CLI** |

**Wichtig:** der User bewegt Dateien per Drag-and-Drop in das GitHub-Webinterface.
Konsequenz: Änderungen müssen so klein wie möglich sein und der User muss klar
gesagt bekommen, **welche Datei(en)** hochzuladen sind.

---

## 3. Tech-Stack

- **Vanilla JavaScript** — keine Frameworks. Bewusste Entscheidung, weil eine
  Single-File / Few-File-PWA für die Zielgruppe (kein App-Store, einfaches
  Deployment) ideal ist.
- **Leaflet.js** + OpenStreetMap-Tiles für die Kartenansicht (Graustufen)
- **Service Worker** (`sw.js`) für Offline-Fähigkeit
- **PWA-Manifest** (`manifest.webmanifest`) — Add-to-Homescreen, Vollbild
- **Browser-APIs:**
  - `navigator.geolocation.watchPosition` — GPS
  - `DeviceOrientationEvent` (`webkitCompassHeading` auf iOS, `alpha`-Inversion
    auf Android) — Kompass
  - `DeviceMotionEvent` — Beta-Winkel für Tilt
  - `getUserMedia` — Kamera-Livebild für AR
  - `localStorage` — Persistenz Kompass-Offset

**Keine Build-Tools.** Dateien werden direkt vom Repo serviert. Keine
`package.json`, keine npm-Abhängigkeiten. Leaflet wird vom CDN (`unpkg.com`)
geladen und beim ersten Besuch vom Service Worker gecacht.

---

## 4. Datei-Struktur

```
hound/
├── index.html              ← DOM für alle Screens (Splash, Menü, Mark, Nav, Map, Kalibrierung)
├── manifest.webmanifest    ← PWA-Manifest
├── sw.js                   ← Service Worker — VERSION-Konstante MUSS bei jeder Änderung hochgezählt werden
├── README.md               ← veraltet (v21-Stand) — diese Datei (CLAUDE.md) ist aktueller
│
├── css/
│   ├── base.css            ← Farbvariablen, Typographie, Toast
│   ├── splash.css          ← Splash-Screen
│   ├── menu.css            ← 4-Rubrik-Hauptmenü
│   ├── home.css            ← Home-Submenü, AR-Pins, .ar-circle, .ar-home-label
│   └── cam.css             ← Kamera-Screens (mark + nav), #ar-dot, #edge-arrow
│
├── js/
│   ├── state.js            ← Zentraler Store: TARGETS-Array + S-Sensor-State + Kompass-Offset
│   ├── util.js             ← toast, haversine, calcBearing, circularMeanHeading, loadValue/saveValue
│   ├── alarm.js            ← WebAudio-Piepen bei Ankunft
│   ├── sensors.js          ← GPS + Kompass + Tilt + Ampel-Status (getGpsStatus, getCompassStatus)
│   ├── camera.js           ← getUserMedia + Pinch-Zoom (nur Mark-Screen, NICHT Kalibrier-Screen)
│   ├── ar.js               ← Mark-Nav-AR (renderAR) + Home-Nav-AR (renderHomeAR) + Boden-Disc
│   ├── map.js              ← Leaflet-Karte, Pin + Suchradius-Kreis + Player-Marker
│   ├── navigation.js       ← Screen-Wechsel zwischen Rubriken, Global-Nav-Button
│   ├── mark.js             ← Anschuss-Markierung (snapAim → doMark), Compass-Offset wird hier angewendet
│   ├── home.js             ← Hochsitz/Auto speichern, Home-Menü-Sync
│   ├── calibration.js      ← Kompass-Kalibrier-Flow (Snap → Map-Tap → Offset speichern)
│   ├── splash.js           ← Pin-Carousel Animation
│   └── app.js              ← Boot, Event-Listener
│
└── assets/icons/           ← 7 Pin-PNGs (Anschuss, Hochsitz, Auto, …)
```

---

## 5. Kern-Architektur

### 5.1 Zentraler Store (state.js)

`TARGETS[]` ist die Single Source of Truth für alle gespeicherten Ziele.
Jedes Target hat: `id, type, label, lat, lon, alt, createdAt, updatedAt, owner,
wolfpackId, color, meta`.

**API für Targets** (alle in `state.js`):

- `addTarget(props)` — neuen Eintrag anlegen
- `setSingletonTarget(type, props)` — alle des Typs löschen, einen neuen anlegen
  (für Singletons wie hochsitz/auto/anschuss)
- `getFirstByType(type)`, `getLatestByType(type)`, `getActiveAnschuss()`
- `updateTarget(id, patch)`, `deleteTarget(id)`, `deleteTargetsByType(type)`

**Legacy-Kompat-Layer:** `GLOBAL_TARGETS[type]`, `HOME_TARGETS[type]`, `S.target`
sind Proxies/Getter, die ältere Aufrufe auf die neue API umleiten. Neuer Code
soll direkt die Helfer verwenden.

**S-Objekt** (in `state.js`): aktueller Sensor-Zustand — `S.lat, S.lon, S.alt,
S.acc, S.heading, S.headingAcc, S.tilt, S.snap, S.pinchZoom, S.headingBuf`.

### 5.2 Sensor-Erfassung (sensors.js)

- **GPS:** `watchPosition` mit `enableHighAccuracy:true`. Ein Buffer von max. 12
  Messungen aus den letzten 8 s wird per `1/acc²`-Gewichtung gemittelt. Outlier
  (Sprünge > 25 m mit schlechterer Genauigkeit) werden ignoriert.
  `getBestRecentGPS()` liefert die genaueste Einzelmessung — wird beim Snap und
  beim Kalibrieren genutzt.
- **Kompass:** `webkitCompassHeading` (iOS) bzw. `360 - alpha` (Android).
  Heading-Buffer mit den letzten 10 Roh-Werten für `circularMeanHeading()` —
  glättet einzelne Magnetometer-Glitches beim Snap weg.
- **Tilt:** `Math.round(90 - beta)`, geclampt auf ±85 °.

**Ampel-Status:** `getGpsStatus()` und `getCompassStatus()` liefern
`'ready'/'wait'/'bad'`. Daraus baut `getSnapReadiness()` einen kombinierten
Status, der den Snap-Knopf blockiert wenn GPS oder Kompass nicht gut genug sind.

### 5.3 Anschuss-Berechnung (mark.js)

1. `snapAim()` — friert `S.snap` mit `{lat, lon, alt, acc, heading,
   headingRaw, headingAcc, tilt, compassOffset}` ein. Heading wird mit
   `applyCompassOffset()` korrigiert.
2. `doMark()` — der User gibt die Laser-Entfernung ein. Daraus wird die
   Zielkoordinate berechnet und mit `setSingletonTarget('anschuss', …)` in
   den TARGETS-Store geschrieben.

In `meta` werden gespeichert: `snapDist, snapHeading, snapHeadingRaw,
snapHeadingAcc, compassOffset, snapTilt, shooterLat, shooterLon, shooterAlt,
shooterAcc, position` — alles für Nachvollziehbarkeit und spätere Korrekturen.

### 5.4 Kompass-Kalibrierung (calibration.js)

Behebt den systematischen Kamera-Versatz des iPhones (Linse sitzt nicht in der
optischen Achse → Anschuss landet konsistent zu weit links). Flow:

1. User markiert via Fadenkreuz einen festen Bezugspunkt (Snap)
2. Auf der Karte tippt er die **echte** Position des Bezugspunkts an
3. Aus Snap-Heading und wahrer Bearing wird der Offset berechnet:
   `offset = snapHeading_roh - trueBearing` (signiert, modulo 360)
4. Offset wird in `localStorage` unter `hound.compassOffset` gespeichert
   (überlebt App-Schließen, Reload, Neustart)
5. Bei jedem `snapAim()` wird `rawSnapHeading - offset` als korrigierter Heading
   verwendet

**Wichtig:** der Offset wird beim Snap nur EINMAL angewendet. Der gespeicherte
`t.lat/t.lon` ist die bereits korrigierte Anschuss-Koordinate.

### 5.5 AR-Rendering (ar.js)

Zwei separate Render-Loops:

- `renderAR()` (Mark-Nav) — nur der aktive Anschuss, mit `S.pinchZoom`-Support
- `renderHomeAR()` (Home-Nav) — alle Targets gleichzeitig, je Type ein Pin
  + ein optionaler Suchradius-Kreis

**Projektion:** linear via `(hDiff / (HFOV/2)) * (sw/2)` — keine echte
Perspektiv-Mathematik. Für moderate Sichtwinkel (HFOV 65 °) reicht das.

**Vertikale Position:** aktuell `vDiff = -tilt`. Höhenunterschied (`altDiff`)
wird **nicht** verwendet (GPS-Höhe ist zu ungenau, ±20–50 m Fehler). Geplant:
Barometer-basierte Höhennavigation im Gebirge.

**Boden-Disc** (Suchradius-Kreis im AR): zentriert auf Pin-Spitze, Höhe =
`Breite × sin(max(arctan(1.6m/dist), |tilt|))` als perspektivische
Approximation. Bei näherer Distanz oder steilerem Tilt wird die Ellipse
rundlicher.

### 5.6 Map (map.js)

Leaflet-Karte mit:

- Player-Marker (blauer Punkt) an `S.lat, S.lon`
- Pin pro Target an `t.lat, t.lon` mit Custom-`L.divIcon`
- Suchradius-Kreis `L.circle([t.lat, t.lon], { radius: clamp(2..25, shooterAcc) })`
  — wird bei jedem Update **force-recreated** (nicht setLatLng), um
  stale-state nach Service-Worker-Updates zu vermeiden
- Debug-Log `[map-circle]` in Konsole bei jedem Circle-Update

---

## 6. Kritische Konventionen

### 6.1 Service-Worker-Cache **immer** invalidieren

iOS Safari hält den SW-Cache hartnäckig. **Bei jeder JS/CSS/HTML-Änderung MUSS
die VERSION-Konstante oben in `sw.js` hochgezählt werden**, sonst sieht der
User auf dem iPhone weiterhin die alte Version.

```js
const VERSION = 'hound-v23-13';   // ⬅ hier inkrementieren!
```

Zusätzlich braucht der User u. U. einen manuellen Cache-Reset (Safari →
Einstellungen → Erweitert → Website-Daten → leifdarkstar.github.io → löschen),
bevor er die neueste Version sieht.

### 6.2 JS-Syntax-Check nach jeder Änderung

```bash
node --check js/state.js   # für jede geänderte JS-Datei
```

GitHub Pages erlaubt keine Build-Errors zu erkennen — defekte JS-Files führen
zu stiller weißer Bildschirm beim User.

### 6.3 Nicht mehr als einen Schritt auf einmal ändern

Die Komplexität (Sensoren, Browser-Quirks, GPS-Variabilität) lässt sich nur
beherrschen, wenn nach jeder Änderung im Revier getestet wird. Die alte
Projektdoku (`hound_projektdoku.docx`) hat dafür eine 8-Schritte-Roadmap für
den AR-Neuaufbau definiert.

### 6.4 iOS-Quirks, die wichtig sind

- `webkitCompassHeading` hat eine spürbare Verzögerung beim Snap → Raw-Heading
  zusätzlich speichern, nicht nur den EMA-geglätteten
- `webkitCompassAccuracy` gibt Grad-Wert (-1 = unbekannt) — Android hat das nicht
- `DeviceOrientationEvent.requestPermission()` muss in einem User-Gesture
  aufgerufen werden
- `classList` und `style.display` niemals mischen — immer nur classList
- `position:fixed` innerhalb von `position:fixed` Parent verhält sich auf iOS
  relativ zum Viewport (das wollen wir)
- Pinch-Zoom auf der Kamera: `video.style.transform = 'scale(N)'`, NICHT auf
  den Body — sonst zoomen die AR-Overlays mit (Bug: aktuell im Kalibrier-Screen!)

---

## 7. Aktueller Stand (Mai 2026)

### 7.1 Was fertig ist ✓

- v21-Migration: Single-HTML → modularisierte Struktur ist abgeschlossen
- PWA mit Service Worker (Offline-Cache, Add-to-Homescreen)
- TARGETS-Store mit voller API (AR-Neuaufbau Schritt 1)
- Sauberer GPS-Snap (Outlier-Filter, Best-Recent-Buffer, Ampel-Status)
- Robuster Snap-Heading (Circular-Mean + Raw-Fallback + iOS-Accuracy)
- Kompass-Kalibrierungs-Flow (Snap → Map-Tap → Offset → localStorage)
- AR Boden-Disc mit perspektivischer Ellipse (Pin-Spitze = Disc-Mitte)
- Map: Pin + Suchradius-Kreis force-recreated bei jedem Update

### 7.2 Konkrete offene Bugs

| # | Bug | Datei | Status |
|---|---|---|---|
| 5 | **Map-Kreis lag im letzten Foto-Test ~50m vom Pin entfernt** | `map.js` | Force-Recreate + Radius-Clamp + Debug-Log in v23-13 eingebaut, wartet auf User-Test |
| 4 | **Pinch-Zoom im Kalibrier-Screen** zoomt nicht nur das Video sondern den ganzen Screen | `camera.js` + `calibration.js` | Vermutlich Listener bindet auf falsches Element |
| - | **vertikale AR-Position** ignoriert Höhenunterschiede komplett (`vDiff = -tilt`, kein `altDiff`) | `ar.js` | Geplant für AR-Neuaufbau Schritt 4–6 (Barometer-Integration) |
| - | **Tilt-Vorzeichen** zeigt beim Hochschauen negativ statt positiv | `sensors.js` | Aus alter Doku, Status unklar — testen |
| - | **Edge-Pfeile** kleben gelegentlich oben-links statt am korrekten Bildschirmrand | `ar.js` | Reproduktion unklar, niedrige Prio |

### 7.3 Roadmap aus der alten Projektdoku (Stand vor Mai 2026)

Die 8-Schritte-Roadmap für den AR-Neuaufbau:

1. ✓ GLOBAL_TARGETS Store sauberer machen
2. ✓ Sensor-Erfassung sauber (Kompass, Tilt — Barometer noch nicht)
3. 🔜 Markieren mit dem neuen Stack durchtesten
4. 🔜 Canvas-basiertes AR mit korrekter vertikaler Position
5. 🔜 (Canvas-AR Fortsetzung)
6. 🔜 (Canvas-AR Fortsetzung)
7. 🔜 Karte in Blickrichtung (Heading Up)
8. 🔜 Integration aller Module

**Track-Rubrik** (Blutspur-Verfolgung) und **Wolfpack-Rubrik** (Echtzeit-Gruppen-
Koordination via Firebase) sind in der Doku spezifiziert, aber noch nicht
gebaut — beide zeigen aktuell nur "Coming soon"-Karten.

### 7.4 Persistenz / Backup

Kompass-Offset wird in `localStorage` (`hound.compassOffset`) gespeichert.
Überlebt: App-Schließen, Reload, iPhone-Neustart. **Überlebt NICHT:**
"Website-Daten löschen", App vom Homescreen entfernen + neu installieren,
Gerätewechsel.

User hat Backup-Wunsch geäußert. Optionen:

- Export/Import als Text-Code (z. B. Base64 vom JSON-Blob), copy-paste in Notizen
- IndexedDB-Spiegelung (robuster, aber genauso bei Cache-Wipe weg)
- Server-Backup via Firebase (kommt später ohnehin für Wolfpack)

---

## 8. Lessons Learned

- **GPS-Höhe ist für AR unbrauchbar** (±20–50 m Fehler). Lösung: Laser×sin(Tilt)
  + Barometer (Differenzmessung auf ±1 m).
- **iOS-Kompass hat Verzögerung beim Snap** — Raw-Heading aus zirkulärem Puffer
  nutzen, nicht den geglätteten EMA-Wert.
- **classList und style.display nie mischen** — sonst Race-Conditions beim
  Screen-Wechsel.
- **Canvas-basiertes AR > div-basiertes AR** — z-index-Chaos vermeiden,
  Performance besser. Aktuell ist alles div-basiert.
- **Nie mehr als einen Schritt auf einmal ändern.** Im Revier testen,
  bestätigen, dann erst weiter.
- **`node --check` für jede geänderte JS-Datei** — defekte Syntax = weiße App
  beim User.
- **`sw.js` VERSION hochzählen, sonst sieht der User die Änderung nicht.**

---

## 9. Wie testen

**Lokal am Mac:** funktioniert nur eingeschränkt. `getUserMedia` braucht HTTPS
oder localhost. Sensoren (Geo/Compass) sind im Desktop-Safari nicht verfügbar
oder stark eingeschränkt.

**Im Browser-Inspector am iPhone:** Lightning-Kabel an Mac, Safari (Mac) →
Entwickler-Menü → "iPhone" → leifdarkstar.github.io → Web-Inspector mit
Konsole, Netzwerk-Tab, DOM. **So sieht man die `console.log`-Outputs der App.**

**Im Revier:** der Goldstandard. App auf iPhone öffnen, Anschuss markieren,
laufen, Wege beobachten. Foto vom Verhalten = beste Bug-Report-Quelle.

---

## 10. Wie mit dem User arbeiten

Der User (Leif) ist nicht-Entwickler. Er kann:

- Dateien per Drag-Drop in GitHub-Web-UI hochladen
- iPhone-Safari bedienen, Web-Inspector öffnen wenn nötig
- Fotos vom App-Verhalten machen
- Bugs in eigenen Worten beschreiben

Er kann **nicht**:

- Git-CLI bedienen
- Code direkt lesen / debuggen
- npm/build-Tools nutzen

**Konsequenz für Claude Code:**

- Änderungen als kleinste-mögliche Einheiten ausliefern
- Pro Änderung klar sagen: *welche Dateien* hochladen, *welche Version* `sw.js`
- Nach jeder Änderung den User explizit auffordern, im Revier zu testen und
  Foto zu schicken
- Bei Tests: Erst die `sw.js` VERSION hochzählen, dann die Code-Files. Sonst
  sieht der User die Änderung nicht.
- Debug-Logs in der Konsole liberal einbauen — wenn der User per Lightning an
  Mac geht, kann er die Logs schicken

---

## 12. Track — Feature-Design (Brainstorming Mai 2026)

### 12.1 Ziel

Wenn ein Tier verwundet wurde und kein Hund dabei ist: die App hilft die Blutspur
zu verfolgen und vorherzusagen wo das Tier als nächstes sein könnte.

Primärer Use Case: tödlicher Treffer, Tier läuft noch 0–100m. Darüber hinaus
braucht man einen Hund — das ist eine bewusste Grenze.

### 12.2 Kernkonzept

- Erster **real gefundener Bluttropfen** = Startpunkt (nicht der Anschuss — zu
  Beginn fließt oft noch kein Blut durch Schock und Adrenalin)
- Jeden weiteren Blutpunkt per Tap markieren
- GPS pro Punkt (±10m Fehler ist ok — die Richtung über mehrere Punkte stimmt)
- Lineare Regression / gewichteter Richtungsmittelwert über alle Punkte → stabile
  Vorhersage-Richtung auch bei verrauschten Einzelpunkten
- Neuere Punkte werden stärker gewichtet (Tier kann die Richtung ändern)

### 12.3 Die zwei Kernelemente

**Richtungskegel (Karten-Ansicht):**
- Zeigt Blutspur als rote Tropfen auf der Karte
- Kegel ab 3 Punkten: Richtung + Öffnungswinkel
- Öffnungswinkel wird enger je mehr Punkte vorhanden sind → man sieht sofort
  wie sicher die Vorhersage ist
- 3 Punkte = breiter Kegel (hohe Unsicherheit), 8+ Punkte = enger Kegel (hohes
  Vertrauen)

**Vorhergesagter nächster Punkt (AR-Ansicht):**
- AR-Kreis im Kamerabild zeigt wo der nächste Blutpunkt sein könnte
- Kreis wird kleiner je mehr Punkte gesammelt wurden
- Tier nicht gefunden → zurück zum letzten Punkt, kreisen → AR-Kreis bleibt als
  Orientierung sichtbar
- Neuer Punkt außerhalb des Kreises → Vorhersage korrigiert sich automatisch

### 12.4 UX-Prinzipien

- iPhone bleibt in der Hand, eine Hand, langsames Bewegen durch Gelände
- **Tap-Button nimmt halben Screen ein** — blind bedienbar während man auf den
  Boden schaut
- Toggle AR ↔ Karte (wie in Home-Nav)
- **Undo-Button**: letzten Punkt löschen (Fehltap passiert)
- Keine Texteingaben, kein Scrollen, keine Ablenkung
- Bei Wildschweinen: man geht zu zweit mit Waffe → App muss auch einhändig mit
  Waffe in der anderen Hand funktionieren

### 12.5 Technik-Skizze

```
Punkte:       GPS-Koordinaten array (lat, lon, timestamp)
Richtung:     gewichteter Durchschnitt der Vektoren zwischen Punkten,
              neuere Punkte 2× gewichtet
Vorhersage:   letzter Punkt + Richtung × durchschnittlicher Punktabstand
Kreis-Radius: Streuung der letzten Peilungen × Vorhersage-Distanz
Kegel:        Öffnungswinkel = arctan(Streuung), min ~10°, max ~60°
```

### 12.6 Offen / noch zu klären

- Fotoanalyse der Schusslage (KI) war in alter Projektdoku erwähnt — Priorität?
- Spur wird nach Fund des Tieres gespeichert (Lerneffekt, später Wolfpack-Teilen)
- Wolfpack-Integration: Spur mit anderen Jägern teilen?

---

## 11. Zugehörige Dokumente

- `hound_projektdoku.docx` — die alte, ausführliche Projektdoku (April 2026).
  Strategische Roadmap, Wolfpack-Design, Monetarisierung. Manches überholt
  (vor allem der Stand der Implementierung), aber das große Bild stimmt.
- `README.md` — beschreibt v21-Stand (April 2026), inzwischen überholt. Sollte
  bei Gelegenheit auf v23-Stand aktualisiert werden.
