# Setup & erste Schritte

## Voraussetzungen
- **n8n** (self-hosted per Docker empfohlen, oder n8n Cloud)
- Node.js ≥ 18 (nur zum Regenerieren des Workflows nötig)

## 1) n8n starten (Docker)
```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```
Öffne http://localhost:5678 und lege ein Konto an.

## 2) Workflow importieren
1. In n8n: **Workflows → Import from File**.
2. Wähle `n8n/workflows/ai_video_pipeline.json`.
3. Speichern.

## 3) (Optional) Workflow neu generieren
Wenn du Agenten in `config/agents.config.json` änderst/hinzufügst:
```bash
node n8n/generate-workflow.js
```
Danach die neue `ai_video_pipeline.json` erneut importieren.

## 4) Erststart ohne APIs (empfohlen zum Kennenlernen)
Die LLM-Nodes sind **disabled** — die Pipeline läuft mit Platzhalter-Outputs
komplett durch, sodass du den ganzen **Freigabe-Ablauf** siehst:
1. Workflow ausführen (**Execute Workflow**) bzw. den **Test-URL** des Form
   Triggers öffnen.
2. Brief ausfüllen (Thema, Inhalt, Story), **Video-Format** wählen (Langes Video /
   Shorts / TikTok / Reels / Feed) und **Länge** setzen → Absenden.
   - *Auto* nimmt die empfohlene Länge fürs Format (z. B. Shorts 45 Sek,
     langes YouTube 10 Min). Eigene Länge geht über das Zahlenfeld.
   - Zu lange Werte werden automatisch aufs Plattform-Limit begrenzt
     (Shorts 60 Sek, Reels 90 Sek, TikTok 180 Sek).
3. Nach jedem Agenten erscheint ein **Freigabe-Formular**: `approve` oder
   `request_changes` + Notizen → Absenden.
4. Am Ende steht `🏁 Approved for Render`.

## 5) APIs anbinden (später)
Siehe [`API_INTEGRATION.md`](API_INTEGRATION.md):
```bash
cp config/providers.json.example config/providers.json   # bzw. providers.example.json
```
Echte Endpunkte/Keys eintragen, `LLM · <agent>`-Nodes aktivieren, Env-Variablen
setzen.

## Projektstruktur verstehen
- **Schemas** = Datenvertrag (`schemas/`)
- **Agenten** = Verhalten (`agents/`)
- **Config** = Modelle/Provider (`config/`)
- **Workflow** = Ablauf (`n8n/workflows/`)

## Tipp: Beispielprojekt
`examples/sample-project.json` zeigt ein vollständig ausgefülltes `project`-Objekt
(mit verknüpften IDs) als Referenz für die erwarteten Agenten-Outputs.
