# PULSE · Running Dashboard 🏃

Ein Lauf- und Fitness-Dashboard als reine Web-App (kein Build-Schritt nötig).

## Features

- **Routenplaner** – Ziel-Distanz wählen (1–42 km), Startpunkt per Klick auf die
  Karte oder GPS setzen. PULSE generiert drei Rundkurse über den OSRM-Routing-
  Dienst und zeigt Distanz, Dauer (nach deinem Tempo) und Kalorienverbrauch.
  Ohne Internet-Routing wird eine gestrichelte Skizze als Orientierung gezeigt.
- **Dashboard** – Stat-Kacheln für Kalorien, Wochen-Distanz, Puls und Blutdruck
  mit Sparklines und Vergleich zum Vortag / zur Vorwoche.
- **Diagramme** – Distanz pro Tag (Balken), Ø Puls pro Lauf (Linie) und
  Blutdruck systolisch/diastolisch (zwei Linien mit Legende). Alle Diagramme
  haben Hover-Tooltips mit Fadenkreuz und eine barrierefreie Tabellen-Ansicht.
- **Zeitraum-Filter** – 7 / 30 / 90 Tage, wirkt auf alle Diagramme gleichzeitig.
- **Blutdruck-Tagebuch** – eigene Messungen erfassen; sie werden lokal im
  Browser gespeichert (`localStorage`) und fließen direkt in Kachel + Diagramm.
- **Profil** – Gewicht und Tempo (min/km) für Kalorien- und Zeitschätzung.

## Starten

Einfach `index.html` im Browser öffnen – oder lokal servieren:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

Für Karte und Routing wird eine Internetverbindung benötigt (OpenStreetMap/
CARTO-Kacheln, OSRM). Alles andere funktioniert offline mit Demo-Daten.

## Technik

- Vanilla HTML/CSS/JS, Charts als handgebautes SVG (keine Chart-Library)
- [Leaflet](https://leafletjs.com/) für die Karte, dunkle CARTO-Basemap
- [OSRM](http://project-osrm.org/) für die Rundkurs-Berechnung
- Farbpalette CVD-validiert (Farbenblind-sicher, Kontrast ≥ 3:1 auf dunkler Fläche)

> Hinweis: Blutdruck-Einordnung ist nur eine grobe Orientierung und ersetzt
> keine ärztliche Beratung.
