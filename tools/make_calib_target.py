#!/usr/bin/env python3
"""
make_calib_target.py — erzeugt die h.o.u.n.d. Kalibrier-Zielscheibe (A4 PDF, 2 Seiten).
Für iPhone 13 Pro Max, Aufstell-Abstand 2 m.

Seite 1 — die reine Zielscheibe (sauber, ohne Textgewirr):
  - Konzentrische Ringe + feines Fadenkreuz mit rotem Mittelpunkt (Antipp-Ziel)
  - Senkrechte Mittellinie (randlos) → über die Klebeband-Bodenlinie ausrichten
  - Waagrechte Mittellinie (randlos)  → auf Linsenhöhe ausrichten

Seite 2 — Anleitung + Druck-Kontrolle:
  - 5-Schritt-Aufbauanleitung
  - Druck-Kontrollbalken (genau 100 mm) zum Prüfen des Druck-Maßstabs
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import Color, black, white
from reportlab.pdfgen import canvas

OUT = "/Users/Leif.Geuder/Documents/IT_Projekte/hound/kalibrier-zielscheibe.pdf"

PAGE_W, PAGE_H = A4                      # 210 x 297 mm (in Punkten)
CX = PAGE_W / 2                          # horizontale Seitenmitte
CY = PAGE_H / 2                          # vertikale Seitenmitte (= Scheiben-Mitte)

RED   = Color(0.80, 0.12, 0.12)
GREY  = Color(0.55, 0.55, 0.55)
LGRY  = Color(0.78, 0.78, 0.78)
OLIVE = Color(0.29, 0.37, 0.10)

c = canvas.Canvas(OUT, pagesize=A4)
c.setTitle("h.o.u.n.d. Kalibrier-Zielscheibe — iPhone 13 Pro Max — 2 m")

# ════════════════════════════════════════════════════════════════
#  SEITE 1 — die reine Zielscheibe
# ════════════════════════════════════════════════════════════════

# ── Randlose Alignment-Linien (über die ganze Seite) ────────────
# Senkrechte Mittellinie (für Bodenlinie / Flucht) — so lang wie möglich
c.setStrokeColor(LGRY)
c.setLineWidth(0.6)
c.line(CX, 8 * mm, CX, PAGE_H - 8 * mm)
# Waagrechte Mittellinie (für Linsenhöhe)
c.line(8 * mm, CY, PAGE_W - 8 * mm, CY)

# ── Konzentrische Ringe ─────────────────────────────────────────
rings = [10, 25, 45, 65, 85]             # Radien in mm
for i, r in enumerate(rings):
    c.setStrokeColor(black if i % 2 == 0 else GREY)
    c.setLineWidth(1.1 if i % 2 == 0 else 0.7)
    c.circle(CX, CY, r * mm, stroke=1, fill=0)

# ── Feines Fadenkreuz im Zentrum (mit kleiner Lücke um die Mitte) ─
c.setStrokeColor(black)
c.setLineWidth(1.0)
gap = 3 * mm
arm = 95 * mm
# horizontal
c.line(CX - arm, CY, CX - gap, CY)
c.line(CX + gap, CY, CX + arm, CY)
# vertikal
c.line(CX, CY - arm, CX, CY - gap)
c.line(CX, CY + gap, CX, CY + arm)

# ── Mittelpunkt: roter Ring + Punkt = exakter Ziel-/Antipp-Punkt ─
c.setStrokeColor(RED)
c.setLineWidth(1.2)
c.circle(CX, CY, 2.6 * mm, stroke=1, fill=0)
c.setFillColor(RED)
c.circle(CX, CY, 0.9 * mm, stroke=0, fill=1)

# ── Knappe Linien-Labels (klein, neben den Linien, ohne Titel-Kollision) ─
c.setFillColor(GREY)
c.setFont("Helvetica-Oblique", 8)
# senkrechte Linie — unten links neben der Linie, aufrecht
c.saveState()
c.translate(CX - 2.0 * mm, 12 * mm)
c.rotate(90)
c.drawString(0, 0, "senkrechte Linie  →  über die Boden-/Klebebandlinie")
c.restoreState()
# waagrechte Linie — ganz rechts, knapp über der Linie
c.drawRightString(PAGE_W - 10 * mm, CY + 1.5 * mm, "waagrechte Linie  →  auf Linsenhöhe")

# ── Roter Mittelpunkt-Hinweis (im weißen Spalt zwischen den Ringen) ─
c.setFillColor(RED)
c.setFont("Helvetica-Bold", 8)
c.drawCentredString(CX, CY + 34 * mm, "MITTE  —  diesen Punkt in der App antippen")

c.showPage()

# ════════════════════════════════════════════════════════════════
#  SEITE 2 — Anleitung + Druck-Kontrolle
# ════════════════════════════════════════════════════════════════

# ── Titelblock ──────────────────────────────────────────────────
c.setFillColor(OLIVE)
c.setFont("Helvetica-Bold", 20)
c.drawCentredString(CX, PAGE_H - 30 * mm, "h.o.u.n.d. — Kalibrier-Zielscheibe")
c.setFillColor(black)
c.setFont("Helvetica", 12)
c.drawCentredString(CX, PAGE_H - 38 * mm, "iPhone 13 Pro Max  ·  Aufstell-Abstand 2 m")

# ── Aufbau-Anleitung ────────────────────────────────────────────
c.setFillColor(black)
c.setFont("Helvetica-Bold", 13)
y = PAGE_H - 60 * mm
c.drawString(22 * mm, y, "So baust du auf:")

c.setFont("Helvetica", 11)
steps = [
    "1.  Seite 1 in ORIGINALGRÖSSE drucken (100 %, NICHT 'an Seite anpassen').",
    "2.  Klebeband-Linie auf den Boden. Handy hochkant ans eine Ende,",
    "      exakt mittig entlang der Linie.",
    "3.  Scheibe in 2 m auf die Linie stellen. Die senkrechte Linie der",
    "      Scheibe genau über die Bodenlinie ausrichten (in Flucht).",
    "4.  Mittelpunkt auf Linsenhöhe bringen (Höhe der Kamera mit Lineal",
    "      messen, ± 1–2 cm genau).",
    "5.  In der App: Wasserwaage auf 0°, dann den roten Mittelpunkt",
    "      auf dem Screen antippen. Fertig — Offset ist gespeichert.",
]
for i, s in enumerate(steps):
    c.drawString(22 * mm, y - 12 * mm - i * 7.0 * mm, s)

# ── Hinweis-Kasten zur Genauigkeit ──────────────────────────────
c.setFillColor(GREY)
c.setFont("Helvetica-Oblique", 9.5)
note_y = y - 12 * mm - len(steps) * 7.0 * mm - 8 * mm
c.drawString(22 * mm, note_y,
             "Tipp: Je genauer Linsenhöhe und Flucht stimmen, desto präziser der Offset.")
c.drawString(22 * mm, note_y - 6 * mm,
             "10 cm Höhenfehler auf 2 m sind bereits ~3° — also sauber messen.")

# ── Druck-Kontrollbalken (genau 100 mm) ─────────────────────────
bar_y = 40 * mm
bar_x0 = CX - 50 * mm
bar_x1 = CX + 50 * mm
c.setStrokeColor(black)
c.setLineWidth(1.0)
c.line(bar_x0, bar_y, bar_x1, bar_y)
for x in (bar_x0, bar_x1):
    c.line(x, bar_y - 3 * mm, x, bar_y + 3 * mm)
c.setFont("Helvetica-Bold", 10)
c.setFillColor(black)
c.drawCentredString(CX, bar_y + 6 * mm, "Druck-Kontrolle")
c.setFont("Helvetica", 9)
c.setFillColor(GREY)
c.drawCentredString(CX, bar_y - 9 * mm,
                    "Dieser Balken muss mit dem Lineal exakt 100 mm sein.")
c.drawCentredString(CX, bar_y - 15 * mm,
                    "Stimmt er nicht → Druck-Skalierung korrigieren und neu drucken.")

c.showPage()
c.save()
print("written:", OUT)
