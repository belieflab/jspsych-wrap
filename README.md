# jspsych-wrap

Node.js CLI and Express server for [jsPsych](https://www.jspsych.org/) experiments. Replaces the PHP/git-submodule wrapper with an npm package.

## What it does

- Serves your experiment files with zero configuration
- Auto-detects jsPsych plugins from your `exp/` files and injects the CDN `<script>` tags automatically — no manual `index.html` editing
- Forwards browser errors to your terminal
- Saves CSV data to `data/` (replaces `data.php`)
- Handles participant routing and counterbalancing (replaces `redirect.php`)
- Scaffolds new experiments with an interactive `init` wizard
- Migrates jsPsych 6 experiments to jsPsych 7 during import

## Requirements

- Node.js 18+

## Getting started

### New experiment

```bash
mkdir myExperiment && cd myExperiment
npx jspsych-wrap init
npm run dev
```

The wizard scaffolds `index.html`, `exp/`, `css/`, `plugins/`, `stim/`, and `data/` and installs dependencies. Open `http://localhost:3000` to start.

### Import an existing experiment

```bash
mkdir myExperiment && cd myExperiment
npx jspsych-wrap init
# → "Would you like to import an existing experiment?" Yes
# → Path: /Applications/MAMP/htdocs/myExperiment
```

The wizard copies your files, rewrites `$.getScript(...)` calls to `loadScript(...)`, and reports which jsPsych plugins were found.

## Experiment structure

```
myExperiment/
├── index.html          ← entry point (auto-served with injected plugins)
├── exp/
│   ├── conf.js         ← experiment config (version, intake, counterbalance)
│   ├── lang.js         ← instructions and translations
│   ├── timeline.js     ← jsPsych trial definitions
│   ├── main.js         ← pushes to timeline[], calls jsPsych.run()
│   └── var.js          ← variables derived from intake (optional)
├── plugins/            ← local plugin overrides (optional)
├── css/
│   └── exp.css
├── stim/               ← stimuli
└── data/               ← CSV output (created automatically)
```

## Plugin auto-detection

At startup, the server scans `exp/*.js` for `jsPsych*` identifiers and injects any missing `<script>` tags into the HTML it serves (in-memory — your files are not modified).

Resolution order for each plugin:
1. Local `plugins/` directory in your experiment
2. `/wrap/plugins/` bundled with the package
3. CDN (unpkg)

Unknown plugins (not in the registry and not found locally) are printed as a warning — add the `<script>` tag to `index.html` manually.

## jsPsych 6 → 7 migration

When importing an experiment, the wizard detects jsPsych 6 and offers to upgrade automatically.

**What gets migrated automatically:**

| Before (v6) | After (v7) |
|---|---|
| `type: "html-keyboard-response"` | `type: jsPsychHtmlKeyboardResponse` |
| `choices: [32]` | `choices: [" "]` |
| `choices: [9, 13]` | `choices: ["Tab", "Enter"]` |
| `jsPsych.init({ timeline: tl, ...opts })` | `window.jsPsych = initJsPsych({...opts}); jsPsych.run(tl);` |

**What gets flagged for manual review:**

- `button_html` — removed in v7; use `choices: []` for button labels
- `.keyCode` / `.which` in jQuery event handlers — switch to `KeyboardEvent.key` string comparisons
- Any `jsPsych.init()` call where the timeline variable couldn't be extracted

**Monolithic experiments** (all logic inline in a PHP file, no `exp/` structure) cannot be auto-migrated. The wizard will detect this and print a restructuring checklist:

1. Extract trial definitions into `exp/timeline.js`
2. Extract config into `exp/conf.js`
3. Extract helper functions into `exp/fn.js`
4. Replace custom `saveData()` with jspsych-wrap's built-in version
5. Re-run `jspsych-wrap init` — the v6→v7 upgrade will run on the second pass

## Configuration (`exp/conf.js`)

```js
const experimentName = "My Experiment";
const experimentAlias = "myExp_v1";
const language = "english";
const theme = "light"; // "light" | "dark" | "gray" | "white"

const repetitions = { production: 3, debug: 1 };

const playwright = false; // set true to disable fullscreen for automated testing

const intake = {
    subject: { length: 5 },
    sites: {
        // SiteName: {}                           — no validation
        // SiteName: { prefix: "XXXX", length: 8 } — prefix + length validation
    },
    phenotypes: ["hc"],
};
```

## CLI options

```bash
jspsych-wrap              # start server (default port 3000)
jspsych-wrap --port=8080  # custom port
jspsych-wrap init         # interactive setup wizard
```

## Development

```bash
npm run build      # compile TypeScript
npm run dev        # watch mode
npm test           # Jest test suite
```

To test the CLI locally without publishing:

```bash
node /path/to/jspsych-wrap/dist/cli/index.js init
```

## License

MIT
