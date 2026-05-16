# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`jspsych-wrap` is an npm package (CLI + Express server) that replaces the PHP/Apache/XAMPP workflow for jsPsych psychological experiments. It provides two server modes:

- **Single-experiment** (`npm run dev` or `jspsych-wrap`): serves one experiment from `cwd`, used during development.
- **Multi-experiment** (`jspsych-wrap serve [dir]`): serves all experiment subdirectories from a parent folder with path-based routing (`/exp23/`, `/exp17/`), used in production.

## Commands

```bash
npm run build    # compile TypeScript (tsup → dist/)
npm run dev      # watch mode (rebuilds on change)
npm test         # Jest
npm run test:watch
```

To test the CLI locally without publishing:

```bash
node dist/cli/index.js init
node dist/cli/index.js serve /path/to/experiments
```

## Architecture

```
src/
  cli/
    index.ts        ← entry point; subcommands: init, serve, (default) dev
    migrateV6.ts    ← jsPsych 6→7 migration logic (called from init wizard)
  server/
    index.ts        ← Express server; branches on SERVE_MODE env var
    routes/
      data.ts       ← POST /data — saves CSV to disk
      redirect.ts   ← GET /redirect — routes platform participants
    utils/
      plugins.ts        ← PLUGIN_REGISTRY: global name → CDN URL
      pluginScanner.ts  ← scanPlugins(), scanLocalPlugins()
      injectPlugins.ts  ← injectPlugins(): adds missing <script> tags to HTML
      multiServe.ts     ← discoverExperiments(), watchExperiments(), buildExperimentHtml()
      gitHash.ts        ← gitCommitHash() for /api/version
client/
  lib/
    fn.js           ← browser utilities (saveData, fullscreen, etc.)
    validate.js     ← intake form validation
    redirect.js     ← getRedirectLink(), counterbalanceParticipants()
    style.css
  plugins/          ← local plugin overrides bundled with the package
templates/
  index.html        ← SPA template served when experiment has no index.html
  exp/              ← template exp/ files copied during init
```

Build output (`dist/`) mirrors `src/` for JS, then copies `templates/` and `client/` verbatim (via `tsup.config.ts` `onSuccess`).

## Key concepts

### Single vs multi-serve mode

`SERVE_MODE` env var controls the branch in `src/server/index.ts`:
- Unset → single-experiment: `EXPERIMENT_DIR` (cwd) served at `/`
- `"multi"` → multi-experiment: `EXPERIMENTS_DIR` scanned for subdirs with `exp/conf.js`

### Plugin auto-detection

At startup, `scanPlugins(dir)` greps `exp/*.js` for `jsPsych[A-Z]*` identifiers. `injectPlugins()` adds missing CDN `<script>` tags to the HTML in memory (files on disk are never modified). Local plugins in `plugins/` take priority over CDN.

### Multi-serve path rewriting

In multi-serve mode, `buildExperimentHtml()` (in `multiServe.ts`) rewrites the template HTML before caching it per experiment:
1. Replaces `/exp/` → `/${name}/exp/` in all quote/attribute contexts so `$.getScript` calls resolve correctly.
2. Injects `<script>window.__WRAP_BASE__ = '/${name}';</script>` before `</head>`.

`client/lib/fn.js` uses `(window.__WRAP_BASE__ || "") + "/data"` for the data POST endpoint, so it works in both modes: empty string in single-serve (→ `/data`), prefixed in multi-serve (→ `/exp23/data`).

### Migration wizard (`migrateV6.ts`)

Called from `runInit()` when a v6 experiment is detected. Key transforms:
- `type: "plugin-name"` → `type: jsPsychPluginName`
- Keycode integers → key strings
- `jsPsych.init()` → `initJsPsych()` + `jsPsych.run()`
- `liftInitJsPsychToTimeline()`: moves `initJsPsych({...})` from inside a wrapper function in `fn.js` to the top of `timeline.js` (v7 requires the instance before timeline vars are parsed)
- `injectVarJsSetupCalls()`: detects setup functions in `fn.js` that do bare global assignments, injects calls at top of `var.js`, converts `let X;` → `var X;` for those globals (prevents `let` from shadowing the window properties set by the setup functions)

### `conf.js` patching

`patchConfJs()` in `cli/index.ts` ensures all variables required by the wrap are declared. It handles both missing declarations (appends) and uninitialized declarations like `let version;` (replaces in-place, to avoid double-declaration).

## Important gotchas

- `let` vs `var` scoping: setup functions like `versionRandomization()` use bare assignments (e.g. `practiceOutcome = [...]`) which set `window.practiceOutcome`. If `var.js` re-declares with `let practiceOutcome;`, the `let` shadows the window property and the value is lost. The migrator converts these to `var`.
- `initJsPsych()` must run before `exp/timeline.js` is parsed if timeline.js uses `jsPsych.timelineVariable()`. The migrator lifts the call to the top of `timeline.js`.
- DOM-manipulating functions (those referencing `document.getElementById`, `.style`, `.innerHTML`) must not be injected as setup calls into `var.js` — they fail because the DOM isn't ready at that point.
- In multi-serve mode, Express strips the `/:expName` prefix from `req.path` inside `app.use("/:expName", ...)` middleware, so `express.static(entry.dir)` receives the correct sub-path.
