#!/usr/bin/env node
/**
 * Generator für den n8n-Workflow "AI Video Production Pipeline".
 *
 * Warum ein Generator statt handgeschriebenem JSON?
 *  - Erweiterbar: Agenten kommen aus config/agents.config.json. Neuer Agent =
 *    ein Eintrag dort, dann dieses Skript erneut ausführen.
 *  - Konsistent: Human-in-the-loop-Freigabe wird für jeden Agenten identisch
 *    erzeugt.
 *
 * Aufruf:
 *    node n8n/generate-workflow.js
 *  -> schreibt n8n/workflows/ai_video_pipeline.json
 *
 * Danach in n8n importieren (Workflows -> Import from File).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const agentsConfig = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config', 'agents.config.json'), 'utf8')
);

// ---- kleine Helfer -------------------------------------------------------
let idCounter = 0;
const uid = () => `node_${(++idCounter).toString().padStart(3, '0')}`;

const nodes = [];
const connections = {};
let cursorX = 0;
const COL = 320; // horizontaler Abstand
const ROW_Y = 300;

function addNode(node) {
  nodes.push(node);
  return node;
}
function connect(fromName, toName) {
  if (!connections[fromName]) connections[fromName] = { main: [[]] };
  connections[fromName].main[0].push({ node: toName, type: 'main', index: 0 });
}

function sticky(content, x, y, w = 300, h = 200, color = 7) {
  addNode({
    parameters: { content, height: h, width: w, color },
    id: uid(),
    name: `Note ${uid()}`,
    type: 'n8n-nodes-base.stickyNote',
    typeVersion: 1,
    position: [x, y],
  });
}

// ---- 1) Form Trigger: Creative Director Brief ---------------------------
const triggerName = '🎬 Brief (Creative Director)';
addNode({
  parameters: {
    formTitle: 'AI Video Production — Creative Brief',
    formDescription:
      'Du bist der Creative Director. Liefere Thema, Inhalt und Story-Grundidee. Das System verändert deinen Inhalt nicht eigenmächtig, sondern macht Vorschläge, die du danach freigibst.',
    formFields: {
      values: [
        { fieldLabel: 'Titel', fieldType: 'text', requiredField: true },
        { fieldLabel: 'Thema (topic)', fieldType: 'text', requiredField: true },
        { fieldLabel: 'Inhalt / Rohskript (content)', fieldType: 'textarea', requiredField: true },
        { fieldLabel: 'Story-Grundidee (storyIdea)', fieldType: 'textarea', requiredField: true },
        { fieldLabel: 'Ziel (goal)', fieldType: 'text' },
        { fieldLabel: 'Zielgruppe (audience)', fieldType: 'text' },
        { fieldLabel: 'Nicht verändern (mustKeep, kommagetrennt)', fieldType: 'textarea' },
        {
          fieldLabel: 'Video-Format',
          fieldType: 'dropdown',
          requiredField: true,
          fieldOptions: {
            values: [
              { option: 'Langes Video (YouTube 16:9)' },
              { option: 'YouTube Shorts (9:16)' },
              { option: 'TikTok (9:16)' },
              { option: 'Instagram Reels (9:16)' },
              { option: 'Instagram Feed (1:1)' },
            ],
          },
        },
        {
          fieldLabel: 'Videolänge',
          fieldType: 'dropdown',
          fieldOptions: {
            values: [
              { option: 'Auto (empfohlen fürs Format)' },
              { option: '15 Sek' }, { option: '30 Sek' }, { option: '45 Sek' },
              { option: '60 Sek' }, { option: '90 Sek' },
              { option: '3 Min' }, { option: '5 Min' }, { option: '10 Min' },
              { option: 'Eigene Länge (Feld unten)' },
            ],
          },
        },
        { fieldLabel: 'Eigene Länge in Sek. (optional)', fieldType: 'number' },
        {
          fieldLabel: 'Zusätzliche Export-Plattformen (optional)',
          fieldType: 'dropdown',
          multiselect: true,
          fieldOptions: {
            values: [
              { option: 'youtube' }, { option: 'shorts' }, { option: 'tiktok' },
              { option: 'instagram_reels' }, { option: 'instagram_feed' },
            ],
          },
        },
        { fieldLabel: 'Sprache (language)', fieldType: 'text' },
      ],
    },
  },
  id: uid(),
  name: triggerName,
  type: 'n8n-nodes-base.formTrigger',
  typeVersion: 2,
  position: [cursorX, ROW_Y],
});
sticky(
  '## 🎬 Start hier\nCreative-Director-Brief. Deine Eingaben (Thema, Inhalt, Story) sind für alle Agenten **unveränderlich**.\n\nHier wählst du auch **Video-Format** (Langes Video / Shorts / TikTok / Reels / Feed) und **Länge**. Daraus werden Seitenverhältnis, Plattform und Längen-Limit automatisch gesetzt und an alle Agenten weitergegeben.',
  cursorX - 20, ROW_Y - 300, 320, 260, 4
);
cursorX += COL;

// ---- 2) Init: Projekt-JSON aufbauen -------------------------------------
const initName = 'Init: Projekt-JSON';
addNode({
  parameters: {
    jsCode: `// Baut das Wurzel-Projektobjekt aus dem Brief (project.schema.json).
const f = $json;
const csv = (s) => (s ? String(s).split(',').map(x => x.trim()).filter(Boolean) : []);

// ---- Video-Format -> Plattform, Seitenverhältnis, Default-/Max-Länge ----
const FORMATS = {
  'Langes Video (YouTube 16:9)': { platform: 'youtube',         aspect: '16:9', defaultSec: 600, maxSec: null },
  'YouTube Shorts (9:16)':       { platform: 'shorts',          aspect: '9:16', defaultSec: 45,  maxSec: 60  },
  'TikTok (9:16)':               { platform: 'tiktok',          aspect: '9:16', defaultSec: 34,  maxSec: 180 },
  'Instagram Reels (9:16)':      { platform: 'instagram_reels', aspect: '9:16', defaultSec: 30,  maxSec: 90  },
  'Instagram Feed (1:1)':        { platform: 'instagram_feed',  aspect: '1:1',  defaultSec: 30,  maxSec: 60  },
};
const LENGTH_PRESETS = {
  'Auto (empfohlen fürs Format)': null,
  '15 Sek': 15, '30 Sek': 30, '45 Sek': 45, '60 Sek': 60, '90 Sek': 90,
  '3 Min': 180, '5 Min': 300, '10 Min': 600,
};

const fmtKey = f['Video-Format'] || 'YouTube Shorts (9:16)';
const fmt = FORMATS[fmtKey] || FORMATS['YouTube Shorts (9:16)'];

// Länge bestimmen: eigene Zahl > Preset-Auswahl > Format-Default
const custom = Number(f['Eigene Länge in Sek. (optional)']) || 0;
const preset = LENGTH_PRESETS[f['Videolänge']];
let duration = custom > 0 ? custom : (preset != null ? preset : fmt.defaultSec);
// Auf Plattform-Limit begrenzen (falls vorhanden)
let durationCapped = false;
if (fmt.maxSec && duration > fmt.maxSec) { duration = fmt.maxSec; durationCapped = true; }

// Plattformen: gewähltes Format zuerst, dann optionale Zusatz-Exporte (dedupe)
const extra = [].concat(f['Zusätzliche Export-Plattformen (optional)'] || []);
const platforms = [...new Set([fmt.platform, ...extra])];

const project = {
  projectId: 'proj-' + Date.now(),
  schemaVersion: '1.0.0',
  meta: {
    title: f['Titel'] || 'Untitled',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    creativeDirector: 'me',
    videoFormat: fmtKey,
    platforms,
    aspectRatios: [fmt.aspect],
    language: f['Sprache (language)'] || 'de',
    targetDurationSec: duration,
    durationCappedToPlatformLimit: durationCapped,
  },
  creativeBrief: {
    topic: f['Thema (topic)'] || '',
    content: f['Inhalt / Rohskript (content)'] || '',
    storyIdea: f['Story-Grundidee (storyIdea)'] || '',
    goal: f['Ziel (goal)'] || '',
    audience: f['Zielgruppe (audience)'] || '',
    mustKeep: csv(f['Nicht verändern (mustKeep, kommagetrennt)']),
  },
  consistency: { characters: [], locations: [], styleGuide: {} },
  pipeline: { currentStage: 'brief', stages: [] },
};
return [{ json: { project } }];`,
  },
  id: uid(),
  name: initName,
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [cursorX, ROW_Y],
});
connect(triggerName, initName);
cursorX += COL;

let prevName = initName;

// ---- 3) Pro Agent: Prepare -> LLM (HTTP) -> Assemble -> Review-Form -----
const agents = Object.entries(agentsConfig.agents).sort(
  (a, b) => a[1].order - b[1].order
);

for (const [key, cfg] of agents) {
  const label = key.replace(/_/g, ' ');

  // 3a) Prepare-Request (baut messages aus System-Prompt + Projekt-JSON)
  const prepName = `Prepare · ${label}`;
  addNode({
    parameters: {
      jsCode: `// Baut die LLM-Anfrage für den ${key}-Agenten.
// System-Prompt-Datei: ${cfg.systemPromptFile}
// Provider (aus providers.json -> llm.providers): "${cfg.provider}"
const project = $json.project;
const systemPromptRef = ${JSON.stringify(cfg.systemPromptFile)};
const outputKey = ${JSON.stringify(cfg.outputKey)};

// Der eigentliche System-Prompt-Text wird beim Anbinden der API geladen
// (Datei einlesen ODER hier direkt hineinkopieren).
const messages = [
  { role: 'system', content: 'SYSTEM_PROMPT_HIER_EINSETZEN (' + systemPromptRef + ')' },
  { role: 'user', content: JSON.stringify(project) },
];

return [{ json: {
  project,
  _agent: ${JSON.stringify(key)},
  _outputKey: outputKey,
  _provider: ${JSON.stringify(cfg.provider)},
  llmRequest: { messages, options: ${JSON.stringify(cfg.options || {})} },
} }];`,
    },
    id: uid(),
    name: prepName,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [cursorX, ROW_Y],
  });
  connect(prevName, prepName);
  cursorX += COL;

  // 3b) LLM-Call via HTTP Request — DISABLED bis API konfiguriert ist.
  const llmName = `LLM · ${label}`;
  addNode({
    parameters: {
      method: 'POST',
      url: '={{ $env.LLM_ENDPOINT || "https://PLATZHALTER/v1/chat/completions" }}',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: '=Bearer {{ $env.LLM_API_KEY }}' },
          { name: 'Content-Type', value: 'application/json' },
        ],
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify({ model: $env.LLM_MODEL, messages: $json.llmRequest.messages }) }}',
      options: {},
    },
    id: uid(),
    name: llmName,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4,
    position: [cursorX, ROW_Y],
    disabled: true, // <-- Aktivieren, sobald providers.json/API steht.
  });
  connect(prepName, llmName);
  cursorX += COL;

  // 3c) Assemble-Output — merged Agent-Ergebnis in project[outputKey].
  //      Solange LLM disabled ist, wird ein schema-konformer Platzhalter erzeugt,
  //      damit die komplette Human-in-the-loop-Pipeline schon jetzt durchläuft.
  const asmName = `Assemble · ${label}`;
  addNode({
    parameters: {
      jsCode: `// Übernimmt LLM-Antwort (falls vorhanden) ODER erzeugt Platzhalter.
const inItems = $input.all();
const base = inItems[0].json;
const project = base.project;
const outputKey = ${JSON.stringify(cfg.outputKey)};
const stage = ${JSON.stringify(cfg.stage)};

let agentOutput = null;
// Echte LLM-Antwort (OpenAI-kompatibel) parsen, wenn der HTTP-Node lief:
try {
  const raw = base.choices?.[0]?.message?.content ?? base.content ?? null;
  if (raw) agentOutput = typeof raw === 'string' ? JSON.parse(raw) : raw;
} catch (e) { /* fällt auf Platzhalter zurück */ }

if (!agentOutput) {
  agentOutput = { _placeholder: true, _note: 'API noch nicht angebunden — Platzhalter für ' + outputKey };
}

// In das Projektobjekt einhängen (voice_audio liefert zwei Arrays):
if (outputKey === 'voice_audio') {
  project.voice = agentOutput.voice || project.voice || [];
  project.audio = agentOutput.audio || project.audio || [];
} else if (outputKey === 'visuals') {
  project.visuals = agentOutput.visuals || (Array.isArray(agentOutput) ? agentOutput : []);
  if (agentOutput.consistency) project.consistency = agentOutput.consistency;
} else {
  project[outputKey] = agentOutput;
}

project.meta.updatedAt = new Date().toISOString();
project.pipeline.currentStage = stage;
project.pipeline.stages.push({ stage, status: 'generated', agent: ${JSON.stringify(key)}, generatedAt: new Date().toISOString(), revision: 0 });

return [{ json: { project, _review: { stage, outputKey } } }];`,
    },
    id: uid(),
    name: asmName,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [cursorX, ROW_Y],
  });
  connect(llmName, asmName);
  cursorX += COL;

  // 3d) Human-in-the-loop Review-Form (pausiert, bis du freigibst).
  const reviewName = `✅ Review · ${label}`;
  addNode({
    parameters: {
      operation: 'page',
      formTitle: `Freigabe: ${label}`,
      formDescription:
        `Prüfe den Vorschlag des ${label}-Agenten. Du kannst Änderungswünsche notieren und dann freigeben. Erst nach 'approve' läuft der nächste Schritt.`,
      formFields: {
        values: [
          {
            fieldLabel: 'Entscheidung',
            fieldType: 'dropdown',
            requiredField: true,
            fieldOptions: {
              values: [
                { option: 'approve' },
                { option: 'request_changes' },
              ],
            },
          },
          { fieldLabel: 'Änderungswünsche / Notizen (directorNotes)', fieldType: 'textarea' },
          { fieldLabel: 'Bearbeitetes JSON (optional, überschreibt Vorschlag)', fieldType: 'textarea' },
        ],
      },
    },
    id: uid(),
    name: reviewName,
    type: 'n8n-nodes-base.form',
    typeVersion: 1,
    position: [cursorX, ROW_Y],
  });
  connect(asmName, reviewName);

  sticky(
    `### Schritt ${cfg.order}: ${label}\n**Prompt:** ${cfg.systemPromptFile}\n**Output:** \`${cfg.outputKey}\`\n\nLLM-Node ist **disabled** bis API steht.\nReview-Form = deine Freigabe.`,
    cursorX - (COL * 3) + 10, ROW_Y + 220, COL * 3 - 40, 150, 6
  );
  cursorX += COL;

  // 3e) Apply-Review — Notizen übernehmen, ggf. bearbeitetes JSON einsetzen.
  const applyName = `Apply Review · ${label}`;
  addNode({
    parameters: {
      jsCode: `// Übernimmt deine Freigabe-Entscheidung in das Projekt.
const form = $json;
const prevNode = $('${asmName}').first().json;
const project = prevNode.project;
const stage = ${JSON.stringify(cfg.stage)};

const decision = form['Entscheidung'] || 'approve';
const notes = form['Änderungswünsche / Notizen (directorNotes)'] || '';
const editedJson = form['Bearbeitetes JSON (optional, überschreibt Vorschlag)'];

if (editedJson) {
  try {
    const edited = JSON.parse(editedJson);
    const outputKey = ${JSON.stringify(cfg.outputKey)};
    if (outputKey === 'voice_audio') { project.voice = edited.voice ?? project.voice; project.audio = edited.audio ?? project.audio; }
    else if (outputKey === 'visuals') { project.visuals = edited.visuals ?? edited; if (edited.consistency) project.consistency = edited.consistency; }
    else { project[outputKey] = edited; }
  } catch (e) { /* ungültiges JSON ignorieren */ }
}

const st = project.pipeline.stages.find(s => s.stage === stage && s.status !== 'approved');
if (st) {
  st.status = decision === 'approve' ? 'approved' : 'changes_requested';
  st.directorNotes = notes;
  if (decision === 'approve') { st.approvedAt = new Date().toISOString(); st.approvedBy = 'creative_director'; }
}
project.meta.updatedAt = new Date().toISOString();
return [{ json: { project } }];`,
    },
    id: uid(),
    name: applyName,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [cursorX, ROW_Y],
  });
  connect(reviewName, applyName);
  cursorX += COL;

  prevName = applyName;
}

// ---- 4) Abschluss: bereit zum Rendern -----------------------------------
const doneName = '🏁 Approved for Render';
addNode({
  parameters: {
    jsCode: `const project = $json.project;
project.pipeline.currentStage = 'approved_for_render';
project.meta.updatedAt = new Date().toISOString();
// Ab hier (SPÄTER): Bild-/Video-Generatoren -> TTS -> Musik/SFX -> FFmpeg-Render -> Social-Publish.
return [{ json: { project } }];`,
  },
  id: uid(),
  name: doneName,
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [cursorX, ROW_Y],
});
connect(prevName, doneName);
sticky(
  '## 🏁 Freigegeben\nProjekt-JSON ist vollständig & geprüft.\n\n**Nächste Stufen (später):**\n1. Visuals generieren (Image/Video-API)\n2. Voiceover (TTS-API)\n3. Musik/SFX\n4. FFmpeg-Render\n5. Social-Publish',
  cursorX - 20, ROW_Y - 260, 320, 230, 5
);

// ---- 5) Workflow zusammenbauen & schreiben ------------------------------
const workflow = {
  name: 'AI Video Production Pipeline',
  nodes,
  connections,
  active: false,
  settings: { executionOrder: 'v1' },
  pinData: {},
  meta: { generatedBy: 'generate-workflow.js', schemaVersion: '1.0.0' },
};

const outDir = path.join(__dirname, 'workflows');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'ai_video_pipeline.json');
fs.writeFileSync(outFile, JSON.stringify(workflow, null, 2));
console.log(`✅ Workflow geschrieben: ${path.relative(ROOT, outFile)}`);
console.log(`   Nodes: ${nodes.length}, Agenten: ${agents.length}`);
