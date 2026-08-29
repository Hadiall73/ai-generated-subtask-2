# 🎬 AI Video Production System (n8n)

Ein **professionelles, modulares AI-Video-Produktionssystem** auf Basis von
[n8n](https://n8n.io) als Workflow-Engine. Es unterstützt dich als **Creative
Director** dabei, aus **deinem** Thema, Inhalt und deiner Story-Grundidee ein
hochwertiges, professionell wirkendes Video zu produzieren – für **YouTube,
Shorts, TikTok und Instagram**.

> **Leitprinzip:** Das System verändert deinen Inhalt **nicht eigenmächtig**.
> Die AI-Agenten machen **Vorschläge**. Du prüfst, bearbeitest und gibst frei.
> Erst nach deiner Freigabe läuft der nächste Produktionsschritt (**Human-in-the-loop**).

---

## Warum dieses System?

| Massen-KI-Content | Dieses System |
|---|---|
| Prompt rein, Video raus | Strukturierter Produktionsprozess mit Fach-Agenten |
| AI erfindet den Inhalt | **Du** lieferst Thema, Inhalt & Story – AI setzt professionell um |
| Keine Kontrolle | Freigabe-Gate nach jedem Schritt |
| Inkonsistente Charaktere/Locations | Konsistenz-Tracking über strukturierte JSON-Daten |
| Ein Blackbox-Modell | Jeder Agent hat einen austauschbaren API-/Modell-Slot |

---

## Die 7 spezialisierten Agenten

| # | Agent | Aufgabe | Output |
|---|---|---|---|
| 1 | **Story Agent** | Dramaturgie, Spannung, Hook, Storytelling verbessern – als Vorschläge | `script` |
| 2 | **Director Agent** | Skript in Szenen zerlegen: Handlung, Atmosphäre, Timing, Übergänge | `scenes` |
| 3 | **Cinematography Agent** | Professionelle Shotlist: Einstellung, Perspektive, Brennweite, Bewegung, Licht, Komposition | `shots` |
| 4 | **Visual Agent** | Detaillierte Prompts für Bild-/Video-Generatoren + visuelle Konsistenz | `visuals` |
| 5 | **Voice & Audio Agent** | Voiceover, Emotion, Sprechtempo, Pausen, Musik, SFX pro Szene | `voice` + `audio` |
| 6 | **Editor Agent** | Schnitt, Timing, Transitions, Untertitel, Bild-/Voice-/Audio-Sync | `editing` |
| 7 | **Critic / Quality Agent** | Bewertet das Gesamtkonzept, gibt konkrete Verbesserungen – vor dem Rendern | `critique` |

Alle Agenten teilen **ein** wachsendes JSON-Projektobjekt. IDs verknüpfen
Szenen → Shots → Visuals → Voice → Audio → Schnitt eindeutig miteinander.

---

## Repository-Struktur

```
ai-video-production/
├── README.md                  ← Diese Datei
├── docs/                      ← Ausführliche Doku (Deutsch)
│   ├── ARCHITECTURE.md        ← Gesamtarchitektur & Datenfluss
│   ├── AGENTS.md              ← Rollen, Verantwortungen, Guardrails
│   ├── DATA_MODEL.md          ← JSON-Datenmodell & Verknüpfungen
│   ├── HUMAN_IN_THE_LOOP.md   ← Freigabe-Konzept
│   ├── API_INTEGRATION.md     ← APIs später anbinden (LLM/TTS/Image/Video/FFmpeg/Social)
│   └── SETUP.md               ← Installation & erste Schritte
├── schemas/                   ← JSON-Schemas (Vertrag zwischen den Agenten)
│   ├── project.schema.json    ← Wurzel-Objekt
│   ├── script.schema.json
│   ├── scenes.schema.json
│   ├── shots.schema.json
│   ├── visuals.schema.json
│   ├── voice.schema.json
│   ├── audio.schema.json
│   ├── editing.schema.json
│   └── critique.schema.json
├── agents/                    ← System-Prompts je Agent (austauschbar)
│   ├── 1_story_agent.md
│   ├── 2_director_agent.md
│   ├── 3_cinematography_agent.md
│   ├── 4_visual_agent.md
│   ├── 5_voice_audio_agent.md
│   ├── 6_editor_agent.md
│   └── 7_critic_agent.md
├── config/                    ← Provider- & Agent-Konfiguration
│   ├── providers.example.json ← LLM/TTS/Image/Video/FFmpeg/Social (Platzhalter)
│   └── agents.config.json     ← Welcher Agent nutzt welches Modell/welche API
├── n8n/                       ← Workflow-Engine
│   ├── generate-workflow.js   ← Generator (erzeugt importierbare Workflows)
│   ├── workflows/             ← Fertige, in n8n importierbare .json-Workflows
│   └── README.md
└── examples/
    └── sample-project.json    ← Beispiel-Projekt (Creative-Director-Input)
```

---

## Schnellstart (Kurzfassung)

1. **n8n installieren** (Docker empfohlen) – siehe [`docs/SETUP.md`](docs/SETUP.md).
2. Workflow importieren: `n8n/workflows/ai_video_pipeline.json`.
3. `config/providers.example.json` → `config/providers.json` kopieren und
   **später** mit echten API-Keys füllen ([`docs/API_INTEGRATION.md`](docs/API_INTEGRATION.md)).
4. Pipeline starten, dein Brief (Thema/Inhalt/Story) eingeben. Im selben Formular
   wählst du **Video-Format** (Langes Video / Shorts / TikTok / Reels / Feed) und
   **Länge** – Seitenverhältnis, Plattform und Längen-Limit werden automatisch
   gesetzt und an alle Agenten weitergegeben.
5. Nach jedem Agenten erscheint ein **Review-Formular** → prüfen, bearbeiten, freigeben.

> **APIs kommen später.** Aktuell laufen die Agenten gegen konfigurierbare
> Platzhalter-Endpunkte. Jeder Agent- und der Voice-Slot ist bereits
> „API-ready" – du trägst später nur Endpoint + Key + Modell ein.

---

## Status / Roadmap

- [x] Datenmodell & JSON-Schemas
- [x] 7 Agenten-Rollen mit System-Prompts + Guardrails
- [x] n8n-Pipeline mit Human-in-the-loop-Freigaben
- [x] Provider-/Agent-Config-Layer (API-ready)
- [ ] **Echte LLM-APIs pro Agent anbinden** (danach)
- [ ] **Voice/TTS-Anbieter anbinden** (danach)
- [ ] Bild-/Video-Generatoren anbinden
- [ ] FFmpeg-Render-Stufe
- [ ] Social-Media-Auto-Publish (YouTube/TikTok/IG/Shorts)

Details: [`docs/API_INTEGRATION.md`](docs/API_INTEGRATION.md).
