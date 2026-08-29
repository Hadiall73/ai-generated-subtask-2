# n8n Workflows

## `workflows/ai_video_pipeline.json`
Die komplette Produktions-Pipeline mit allen 7 Agenten und Human-in-the-loop-
Freigaben. In n8n über **Workflows → Import from File** importieren.

Aufbau je Agent (4–5 Nodes):
1. `Prepare · <agent>` — baut die LLM-Anfrage.
2. `LLM · <agent>` — HTTP-Call zum Provider (**disabled**, bis API steht).
3. `Assemble · <agent>` — parst Antwort / erzeugt Platzhalter, merged ins `project`.
4. `✅ Review · <agent>` — Freigabe-Formular (pausiert).
5. `Apply Review · <agent>` — übernimmt deine Entscheidung.

## Neu generieren
```bash
node generate-workflow.js
```
Liest `../config/agents.config.json` und schreibt `workflows/ai_video_pipeline.json`.
Nach Änderungen an Agenten also einfach neu generieren und in n8n re-importieren.

## Hinweise
- Die LLM-Nodes sind bewusst **disabled**, damit die Pipeline ohne API-Keys
  durchläuft (Platzhalter-Outputs). Zum Scharfschalten siehe
  [`../docs/API_INTEGRATION.md`](../docs/API_INTEGRATION.md).
- Env-Variablen (`LLM_ENDPOINT`, `LLM_API_KEY`, `LLM_MODEL`, …) in n8n unter
  *Settings* setzen — **keine Keys** in den Workflow schreiben.
