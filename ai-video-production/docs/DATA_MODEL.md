# Datenmodell & Verknüpfungen

Alle Agenten arbeiten auf **einem** `project`-Objekt
([`schemas/project.schema.json`](../schemas/project.schema.json)). Die eindeutige
Verknüpfung entsteht über **IDs**.

## ID-Ketten (das Rückgrat)

```
scenes[].sceneId
   ├── shots[].sceneId          → welcher Shot zu welcher Szene
   │      └── shots[].shotId
   │             └── visuals[].shotId     → welches Bild/Video zu welchem Shot
   ├── voice[].sceneId          → welcher Voiceover-Text zu welcher Szene
   └── audio[].sceneId          → welche Musik/SFX zu welcher Szene

editing.timeline[] verbindet alles:
   { sceneId, shotId, visualRef → visuals[].visualId,
     voiceRefs → voice[].voiceId, audioRefs → audio[].audioId }

consistency.characters[].id  ← referenziert von scenes.characterRefs,
consistency.locations[].id   ← shots.characterRefs, visuals.consistencyRefs
```

Dadurch bleibt jederzeit eindeutig, **welcher Voiceover zu welchem Bild in
welcher Szene** gehört – die Basis für Sync und Konsistenz.

## Abschnitte des `project`-Objekts

| Feld | Erzeugt von | Schema |
|---|---|---|
| `creativeBrief` | **Du** (unveränderlich) | project.schema.json |
| `script` | Story Agent | script.schema.json |
| `scenes[]` | Director Agent | scenes.schema.json |
| `shots[]` | Cinematography Agent | shots.schema.json |
| `visuals[]` + `consistency` | Visual Agent | visuals.schema.json |
| `voice[]` + `audio[]` | Voice & Audio Agent | voice/audio.schema.json |
| `editing` | Editor Agent | editing.schema.json |
| `critique` | Critic Agent | critique.schema.json |
| `pipeline` | Engine (Status/Freigaben) | project.schema.json |

## Unveränderlichkeit des Inhalts
`creativeBrief` (topic, content, storyIdea, mustKeep) wird von **keinem** Agenten
überschrieben. Verbesserungen kommen immer als **Vorschlag** (z. B.
`script.suggestions[]`, `critique.issues[]`) mit `status` – du entscheidest.

## Konsistenz
`consistency` ist die zentrale Referenzbibliothek: feste `referencePrompt`-Bausteine
und `seed`s sorgen dafür, dass Charaktere/Locations über alle Shots identisch
aussehen. Der Visual Agent pflegt sie, alle anderen referenzieren nur.

## Validierung
Jeder Agenten-Output soll gegen sein Schema validiert werden. Lokal z. B.:
```bash
npx ajv-cli validate -s schemas/scenes.schema.json -d mein_scenes_output.json
```
