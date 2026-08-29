# APIs anbinden (der „später"-Teil)

> Aktuell laufen die Agenten gegen **Platzhalter**. Die Pipeline funktioniert
> schon jetzt end-to-end (mit Platzhalter-Outputs), damit du den kompletten
> Human-in-the-loop-Ablauf siehst. Hier ist beschrieben, wie du **jeden Agenten
> und Voice verstärkst**, indem du echte APIs einträgst.

## 0) Grundprinzip: provider-agnostisch
Nichts im System ist an einen bestimmten Anbieter gebunden. Alle Anbieter werden
zentral in `config/providers.json` beschrieben (Kopie von
`providers.example.json`). Keys stehen **nicht** im Repo, sondern in
Umgebungsvariablen (in n8n unter *Settings → Variables/Env*).

```bash
cp config/providers.example.json config/providers.json   # danach echte Werte eintragen
```

## 1) LLM-APIs pro Agent (Agenten „verstärken")
Jeder Agent kann sein **eigenes** Modell bekommen.

1. In `config/providers.json → llm.providers` einen Anbieter eintragen
   (`endpoint`, `model`, `apiKeyEnv`).
2. In `config/agents.config.json` pro Agent `provider` auf diesen Eintrag setzen –
   z. B. dem Critic ein stärkeres Modell geben als dem Editor.
3. Im n8n-Workflow beim jeweiligen **`LLM · <agent>`**-Node:
   - Node **aktivieren** (Rechtsklick → *Enable*; ist standardmäßig *disabled*).
   - `system`-Prompt einsetzen: Inhalt der Datei aus `systemPromptFile`
     in den `Prepare`-Node kopieren (Stelle `SYSTEM_PROMPT_HIER_EINSETZEN`).
   - Env-Variablen setzen: `LLM_ENDPOINT`, `LLM_API_KEY`, `LLM_MODEL`.

Der `Assemble`-Node erwartet eine OpenAI-kompatible Antwort
(`choices[0].message.content` als JSON-String). Für andere Formate den Parser dort
minimal anpassen.

## 2) Voice / TTS (Voice „verstärken")
Der Voice & Audio Agent **plant** Prosodie provider-neutral (`voice[].prosody`).
Die **Sprachausgabe** erzeugt ein TTS-Anbieter:

1. `providers.json → tts` ausfüllen (`endpoint`, `apiKeyEnv`, `voiceMap`).
2. Nach `🏁 Approved for Render` eine **TTS-Stufe** ergänzen: HTTP-Node, der pro
   `voice[]`-Eintrag `text` + `prosody`/`ssml` an den TTS-Endpoint schickt und
   `voice[].output.audioUrl` füllt.
3. `voiceMap` bildet `speaker.voiceProfile` (z. B. `narrator`) auf die konkrete
   Stimme des Anbieters ab – dadurch bleibt der Agent anbieterunabhängig.

## 3) Bild-/Video-Generatoren
Pro `visuals[]`-Eintrag `prompt.positive/negative`, `consistencyRefs.seed` und
`params` an `providers.json → image` bzw. `video` schicken; Ergebnis in
`visuals[].output.assetUrl` schreiben. Fester `seed` = visuelle Konsistenz.

## 4) Musik / SFX
`audio[]` → `providers.json → music` (oder eine lizenzierte Bibliothek).
`mix.ducking` respektieren, damit Musik die Stimme nicht übertönt.

## 5) FFmpeg-Render
`editing.timeline[]` ist bewusst maschinenlesbar. Eine Render-Stufe baut daraus
FFmpeg-Kommandos (Clips schneiden, Transitions, Untertitel `subtitles.cues`,
Audio mischen) – je `platformVariants[]` ein Export (9:16, 16:9, 1:1).

## 6) Social-Publishing
Ganz am Ende, **nach finaler Freigabe**: `providers.json → social`
(YouTube/TikTok/Instagram) aktivieren und Upload-Nodes ergänzen.

## Reihenfolge der Anbindung (Empfehlung)
1. **LLM pro Agent** (macht die Agenten „echt").
2. **TTS/Voice**.
3. Bild-/Video-Generatoren.
4. Musik/SFX.
5. FFmpeg-Render.
6. Social-Publish.

Jeder Schritt ist unabhängig – du kannst sofort mit den LLMs starten und den Rest
später ergänzen, ohne die Architektur zu ändern.
