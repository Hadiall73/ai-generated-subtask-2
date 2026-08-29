# Die Agenten im Überblick

Jeder Agent ist eine **austauschbare Rolle** mit eigenem System-Prompt
(`agents/*.md`), eigenem konfigurierbaren Modell (`config/agents.config.json`) und
einem klar definierten **JSON-Output** (Schema).

| # | Agent | Prompt | Output-Schema | Kernaufgabe |
|---|---|---|---|---|
| 1 | Story | `agents/1_story_agent.md` | `script.schema.json` | Dramaturgie, Hook, Spannung – als Vorschläge |
| 2 | Director | `agents/2_director_agent.md` | `scenes.schema.json` | Skript → Szenen (Handlung, Atmosphäre, Timing, Übergänge) |
| 3 | Cinematography | `agents/3_cinematography_agent.md` | `shots.schema.json` | Shotlist (Einstellung, Brennweite, Bewegung, Licht, Komposition) |
| 4 | Visual | `agents/4_visual_agent.md` | `visuals.schema.json` | Generierungs-Prompts + visuelle Konsistenz |
| 5 | Voice & Audio | `agents/5_voice_audio_agent.md` | `voice`/`audio.schema.json` | Voiceover, Emotion, Tempo, Pausen, Musik, SFX |
| 6 | Editor | `agents/6_editor_agent.md` | `editing.schema.json` | Schnitt, Timing, Transitions, Untertitel, Sync |
| 7 | Critic/Quality | `agents/7_critic_agent.md` | `critique.schema.json` | Gesamtbewertung + konkrete Verbesserungen vor dem Rendern |

## Gemeinsame Guardrails (alle Agenten)
1. **Inhalt gehört dem Creative Director.** `creativeBrief` wird nie überschrieben.
2. Verbesserungen sind **Vorschläge** mit `status` – du entscheidest.
3. `creativeBrief.mustKeep` ist tabu.
4. Sprache aus `meta.language`.
5. Output ist **striktes JSON** nach Schema (kein Fließtext).

## Einen Agenten anpassen
- **Verhalten** ändern → die `.md`-Datei bearbeiten.
- **Modell/API** ändern → `config/agents.config.json → agents.<name>.provider`.
- **Neuen Agenten** hinzufügen → Eintrag in `agents.config.json` + Prompt-Datei +
  ggf. Schema, dann `node n8n/generate-workflow.js`.

## Erweiterungsideen (kompatibel mit der Architektur)
- **Research Agent** vor Story (Faktencheck, Quellen).
- **Thumbnail/Cover Agent** nach Visual (Klick-optimiertes Cover).
- **Localization Agent** nach Editor (mehrsprachige Untertitel/Voice).
- **SEO/Caption Agent** für Titel, Beschreibung, Hashtags je Plattform.
