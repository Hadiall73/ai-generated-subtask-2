# Human-in-the-loop — Dein Freigabe-Prozess

Das System läuft **nie** komplett automatisch durch. Nach **jedem** wichtigen
Produktionsschritt hältst **du** als Creative Director an.

## Der Freigabe-Zyklus je Schritt

```
Agent erzeugt Vorschlag
        │
        ▼
  Review-Formular (n8n pausiert)
        │
   ┌────┴─────────────────────────┐
   │ Entscheidung: approve         │ ── approve ──▶ nächster Agent
   │ Entscheidung: request_changes │
   │ + directorNotes (Änderungen)  │
   │ + optional bearbeitetes JSON  │
   └───────────────────────────────┘
```

## Was du im Review-Formular tun kannst
- **approve** → Freigabe, der nächste Agent startet.
- **request_changes** → deine `directorNotes` werden gespeichert
  (`pipeline.stages[].directorNotes`). Du kannst den Schritt in n8n erneut
  ausführen, damit der Agent mit deinem Feedback nachbessert.
- **Bearbeitetes JSON** → du überschreibst den Vorschlag direkt mit deiner
  eigenen Fassung (z. B. Skript feinjustiert). Das System nutzt **deine** Version.

## Wo der Status lebt
Im `project.pipeline`:
- `currentStage` – wo die Produktion gerade steht.
- `stages[]` – Historie: `status` (`generated`/`approved`/`changes_requested`),
  `directorNotes`, `approvedAt`, `revision`.

## Technisch (n8n)
Die Review-Schritte sind **Form-Nodes**. Ein Form-Node **pausiert die
Ausführung** und zeigt dir eine Web-Seite mit dem Formular. Erst wenn du
absendest, läuft der Workflow weiter. Die Formular-URL erhältst du beim Start
über den **Form Trigger**; die Folge-Seiten erscheinen automatisch nach jedem
Agenten.

> So bleibt garantiert: **kein Schritt ohne deine Freigabe.**
