# Architektur & Datenfluss

## Grundidee
Ein **einziges, wachsendes JSON-Projektobjekt** (`project`) wandert durch die
Pipeline. Jeder Agent liest den aktuellen Stand, ergänzt **seinen** Abschnitt und
gibt das erweiterte Objekt weiter. Zwischen den Agenten sitzt jeweils ein
**Human-in-the-loop-Gate** (Review-Formular in n8n).

```
Creative Brief (DU)
      │  creativeBrief  (unveränderlich)
      ▼
┌──────────────┐   ✅ Freigabe   ┌──────────────┐   ✅   ┌───────────────────┐   ✅
│ Story Agent  │ ─── script ──▶  │ Director     │ ─ scenes ▶ │ Cinematography    │ ─ shots ─┐
└──────────────┘                 └──────────────┘            └───────────────────┘          │
                                                                                             ▼
┌──────────────┐   ✅   ┌──────────────────┐   ✅   ┌──────────────┐   ✅   ┌──────────────┐
│ Visual Agent │◀ shots │ (weiter unten)   │        │ Voice&Audio  │        │ Editor       │
│  visuals +   │        │                  │        │ voice+audio  │        │ editing      │
│  consistency │ ─────────────────────────────────▶ └──────────────┘ ─────▶ └──────────────┘
└──────────────┘                                                                     │
                                                                                     ▼
                                                                          ┌──────────────┐   ✅
                                                                          │ Critic/Quality│ ─▶ 🏁 Approved for Render
                                                                          │ critique      │
                                                                          └──────────────┘
```

Tatsächliche lineare Reihenfolge in n8n:
**Brief → Story → Director → Cinematography → Visual → Voice&Audio → Editor → Critic → Approved for Render.**

## Schichten (modular & erweiterbar)

| Schicht | Ort | Zweck |
|---|---|---|
| **Datenvertrag** | `schemas/*.json` | JSON-Schemas – der verbindliche Vertrag zwischen den Agenten |
| **Agenten-Logik** | `agents/*.md` | Austauschbare System-Prompts (Rolle + Guardrails + I/O) |
| **Konfiguration** | `config/*.json` | Welcher Agent nutzt welches Modell/welche API; Provider-Endpunkte |
| **Orchestrierung** | `n8n/workflows/*.json` | Ablauf, Freigaben, Datenfluss (die Engine) |
| **Ausgabe (später)** | `providers.json` | TTS, Image/Video, Musik, FFmpeg, Social |

Jede Schicht ist unabhängig austauschbar:
- Modell wechseln → nur `config/agents.config.json`.
- Agenten-Verhalten ändern → nur die `.md`-Datei.
- Neue Ausgabestufe → neuer Node am Ende, Schema bleibt gleich.

## Pro-Agent-Baustein (im n8n-Workflow)
Für jeden Agenten erzeugt der Generator vier Nodes:

1. **Prepare** (Code) – baut die LLM-Anfrage aus System-Prompt + `project`.
2. **LLM** (HTTP Request, *disabled bis API steht*) – ruft den Provider auf.
3. **Assemble** (Code) – parst die Antwort und hängt sie ins `project` (oder erzeugt
   einen Schema-Platzhalter, damit die Pipeline schon jetzt durchläuft).
4. **Review** (Form) – **pausiert**, bis du prüfst, ggf. editierst und freigibst,
   danach **Apply Review** (Code), das deine Entscheidung ins `project` schreibt.

## Warum n8n?
- Visueller Ablauf, jeder Schritt einzeln ausführ- und debugbar.
- Native **Form-/Wait-Nodes** für Human-in-the-loop.
- HTTP-Nodes = provider-agnostische API-Anbindung.
- Alles als **importierbares JSON** versionierbar.
