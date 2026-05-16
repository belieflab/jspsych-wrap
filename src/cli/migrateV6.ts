import fs from "fs";
import path from "path";

// jsPsych v6 plugin type string → v7 class name
const V6_PLUGIN_MAP: Record<string, string> = {
    "html-keyboard-response":        "jsPsychHtmlKeyboardResponse",
    "html-button-response":          "jsPsychHtmlButtonResponse",
    "image-keyboard-response":       "jsPsychImageKeyboardResponse",
    "image-button-response":         "jsPsychImageButtonResponse",
    "audio-keyboard-response":       "jsPsychAudioKeyboardResponse",
    "audio-button-response":         "jsPsychAudioButtonResponse",
    "instructions":                  "jsPsychInstructions",
    "survey-multi-choice":           "jsPsychSurveyMultiChoice",
    "survey-likert":                 "jsPsychSurveyLikert",
    "survey-text":                   "jsPsychSurveyText",
    "survey-multi-select":           "jsPsychSurveyMultiSelect",
    "survey-html-form":              "jsPsychSurveyHtmlForm",
    "preload":                       "jsPsychPreload",
    "fullscreen":                    "jsPsychFullscreen",
    "html-slider-response":          "jsPsychHtmlSliderResponse",
    "image-slider-response":         "jsPsychImageSliderResponse",
    "video-keyboard-response":       "jsPsychVideoKeyboardResponse",
    "video-button-response":         "jsPsychVideoButtonResponse",
    "animation":                     "jsPsychAnimation",
    "free-sort":                     "jsPsychFreeSort",
    "resize":                        "jsPsychResize",
    "serial-reaction-time":          "jsPsychSerialReactionTime",
    "serial-reaction-time-mouse":    "jsPsychSerialReactionTimeMouse",
    "same-different-html":           "jsPsychSameDifferentHtml",
    "same-different-image":          "jsPsychSameDifferentImage",
    "external-html":                 "jsPsychExternalHtml",
    "cloze":                         "jsPsychCloze",
    "categorize-html":               "jsPsychCategorizeHtml",
    "categorize-image":              "jsPsychCategorizeImage",
};

// v6 integer keyCode → KeyboardEvent.key string
const KEYCODE_MAP: Record<number, string> = {
    8:  "Backspace",
    9:  "Tab",
    13: "Enter",
    27: "Escape",
    32: " ",
    37: "ArrowLeft",
    38: "ArrowUp",
    39: "ArrowRight",
    40: "ArrowDown",
};
for (let i = 65; i <= 90; i++) KEYCODE_MAP[i] = String.fromCharCode(i + 32); // A–Z → a–z
for (let i = 48; i <= 57; i++) KEYCODE_MAP[i] = String(i - 48);              // 0–9

export function isV6Experiment(expDir: string): boolean {
    const dir = path.join(expDir, "exp");
    if (!fs.existsSync(dir)) return false;
    for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith(".js")) continue;
        const src = fs.readFileSync(path.join(dir, file), "utf8");
        if (/jsPsych\.init\(/.test(src) || /type:\s*["'][a-z][a-z-]+["']/.test(src)) return true;
    }
    return false;
}

// Transforms jsPsych.init({ timeline: tl, ...opts }) →
//   window.jsPsych = initJsPsych({ ...opts });
//   jsPsych.run(tl);
// Uses brace counting so nested on_finish functions are handled correctly.
function transformInit(src: string): { src: string; timelineVar: string | null } {
    const lines = src.split("\n");
    let initIdx = -1;
    let closeIdx = -1;
    let timelineIdx = -1;
    let timelineVar: string | null = null;
    let depth = 0;
    let inBlock = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!inBlock && /jsPsych\.init\(\{/.test(line)) {
            initIdx = i;
            inBlock = true;
            depth = (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
            continue;
        }
        if (inBlock) {
            depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
            const m = line.match(/^\s*timeline:\s*(\w+),?\s*$/);
            if (m) { timelineVar = m[1]; timelineIdx = i; }
            if (depth <= 0) { closeIdx = i; inBlock = false; }
        }
    }

    if (initIdx === -1) return { src, timelineVar: null };

    const out = [...lines];
    out[initIdx] = out[initIdx].replace("jsPsych.init({", "window.jsPsych = initJsPsych({");

    if (timelineIdx !== -1) {
        out.splice(timelineIdx, 1);
        if (closeIdx > timelineIdx) closeIdx--;
    }

    if (closeIdx !== -1) {
        const run = timelineVar
            ? `jsPsych.run(${timelineVar});`
            : `// TODO: jsPsych.run(timeline);`;
        out.splice(closeIdx + 1, 0, run);
    }

    return { src: out.join("\n"), timelineVar };
}

export interface MigrationResult {
    typesMigrated: string[];
    keycodesFixed: string[];
    noKeysMigrated: string[];
    initTransformed: string[];
    initLifted: string[];       // initJsPsych() moved from fn.js wrapper → top of timeline.js
    setupCallsInjected: string[]; // functions prepended to var.js
    timelineVarFiles: string[];
    manualFlags: string[];
}

export function migrateV6ToV7(expDir: string): MigrationResult {
    const typesMigrated = new Set<string>();
    const keycodesFixed = new Set<string>();
    const noKeysMigrated = new Set<string>();
    const initTransformed: string[] = [];
    const initLifted: string[] = [];
    const setupCallsInjected: string[] = [];
    const timelineVarFiles: string[] = [];
    const manualFlags: string[] = [];

    const dir = path.join(expDir, "exp");
    if (!fs.existsSync(dir)) {
        return { typesMigrated: [], keycodesFixed: [], noKeysMigrated: [], initTransformed, initLifted, setupCallsInjected, timelineVarFiles, manualFlags };
    }

    for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith(".js")) continue;
        const filePath = path.join(dir, file);
        let src = fs.readFileSync(filePath, "utf8");
        const original = src;

        // 1. Plugin type strings: type: "html-keyboard-response" → type: jsPsychHtmlKeyboardResponse
        src = src.replace(/type:\s*(["'])([^"']+)\1/g, (_m, _q, name) => {
            const v7 = V6_PLUGIN_MAP[name];
            if (!v7) return _m;
            typesMigrated.add(name);
            return `type: ${v7}`;
        });

        // 2. Integer keycodes in choices arrays: choices: [32] → choices: [" "]
        src = src.replace(/choices:\s*\[([^\]]+)\]/g, (match, inner) => {
            const parts = (inner as string).split(",").map((p: string) => p.trim());
            let changed = false;
            const newParts = parts.map((p: string) => {
                const n = parseInt(p, 10);
                if (!isNaN(n) && KEYCODE_MAP[n] !== undefined) {
                    changed = true;
                    const key = KEYCODE_MAP[n];
                    return key === " " ? '" "' : `"${key}"`;
                }
                return p;
            });
            if (!changed) return match;
            keycodesFixed.add(file);
            return `choices: [${newParts.join(", ")}]`;
        });

        // 3. jsPsych.init() → window.jsPsych = initJsPsych() + jsPsych.run()
        if (/jsPsych\.init\(/.test(src)) {
            const result = transformInit(src);
            src = result.src;
            if (result.timelineVar) {
                initTransformed.push(file);
            } else {
                manualFlags.push(
                    `${file}: jsPsych.init() — could not extract timeline variable; update manually:\n` +
                    `  window.jsPsych = initJsPsych({ ...options });\n` +
                    `  jsPsych.run(timeline);`
                );
            }
        }

        // 4. jsPsych.NO_KEYS / jsPsych.ALL_KEYS → string literals
        if (/jsPsych\.NO_KEYS\b/.test(src)) {
            src = src.replace(/\bjsPsych\.NO_KEYS\b/g, '"NO_KEYS"');
            noKeysMigrated.add(file);
        }
        if (/jsPsych\.ALL_KEYS\b/.test(src)) {
            src = src.replace(/\bjsPsych\.ALL_KEYS\b/g, '"ALL_KEYS"');
            noKeysMigrated.add(file);
        }

        // 5. Flag button_html — removed in v7
        if (/\bbutton_html\b/.test(src)) {
            manualFlags.push(`${file}: button_html removed in jsPsych 7 — use choices: [] for button labels`);
        }

        // 6. Flag jQuery keyCode / .which — switch to KeyboardEvent.key
        if (/\.keyCode\b|\.which\b/.test(src)) {
            manualFlags.push(`${file}: .keyCode/.which → update to KeyboardEvent.key string comparisons`);
        }

        // 7. Detect jsPsych.timelineVariable() usage — in v7 this is an instance method
        if (/\bjsPsych\.timelineVariable\s*\(/.test(src)) {
            timelineVarFiles.push(file);
        }

        if (src !== original) fs.writeFileSync(filePath, src);
    }

    // Detect setup functions in fn.js that must run before var.js
    injectVarJsSetupCalls(dir, setupCallsInjected, manualFlags);

    // If timelineVariable is used AND initJsPsych ended up inside a wrapper function,
    // auto-fix: extract initJsPsych({...}) config and inject it at the top of timeline.js.
    if (timelineVarFiles.length) {
        const fnPath       = path.join(dir, "fn.js");
        const timelinePath = path.join(dir, "timeline.js");
        if (fs.existsSync(fnPath) && fs.existsSync(timelinePath)) {
            const fnSrc = fs.readFileSync(fnPath, "utf8");
            if (isInitInsideFunction(fnSrc)) {
                const fixed = liftInitJsPsychToTimeline(fnSrc, timelinePath, initLifted, manualFlags);
                if (fixed) fs.writeFileSync(fnPath, fixed);
            }
        }
    }

    return {
        typesMigrated: [...typesMigrated],
        keycodesFixed: [...keycodesFixed],
        noKeysMigrated: [...noKeysMigrated],
        initTransformed,
        initLifted,
        setupCallsInjected,
        timelineVarFiles,
        manualFlags,
    };
}

// Returns true if the file's initJsPsych() call is inside a function body (not top-level).
function isInitInsideFunction(src: string): boolean {
    const idx = src.indexOf("initJsPsych(");
    if (idx === -1) return false;
    // Count unmatched { before this position — if > 0, we're inside a function body
    let depth = 0;
    for (let i = 0; i < idx; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") depth--;
    }
    return depth > 0;
}

// Extracts initJsPsych({...}) config from inside a wrapper function in fn.js,
// injects "const jsPsych = initJsPsych({...config...});" at the top of timeline.js,
// and replaces the initJsPsych call in fn.js with just jsPsych.run() (leaving run in place).
// Returns the modified fn.js source, or null if extraction failed.
function liftInitJsPsychToTimeline(
    fnSrc: string,
    timelinePath: string,
    initLifted: string[],
    manualFlags: string[]
): string | null {
    const initIdx = fnSrc.indexOf("initJsPsych(");
    if (initIdx === -1) return null;

    // Extract the full initJsPsych({...}) call by brace-depth counting
    let i = initIdx + "initJsPsych(".length - 1; // points to '('
    let depth = 0, started = false;
    const callStart = initIdx;
    let callEnd = -1;
    while (i < fnSrc.length) {
        if (fnSrc[i] === "(") { depth++; started = true; }
        else if (fnSrc[i] === ")") {
            depth--;
            if (started && depth === 0) { callEnd = i; break; }
        }
        i++;
    }
    if (callEnd === -1) return null;

    const initCall = fnSrc.slice(callStart, callEnd + 1); // e.g. initJsPsych({ show_progress_bar: true })

    // Inject at the top of timeline.js
    const timelineSrc = fs.readFileSync(timelinePath, "utf8");
    if (!/\binitJsPsych\s*\(/.test(timelineSrc)) {
        const injected = `const jsPsych = ${initCall};\n\n${timelineSrc}`;
        fs.writeFileSync(timelinePath, injected);
        initLifted.push("fn.js → timeline.js");
    }

    // Strip the window.jsPsych = initJsPsych({...}); line from fn.js
    // Find the line containing the initJsPsych call and remove it
    const lineStart = fnSrc.lastIndexOf("\n", callStart) + 1;
    const lineEnd   = fnSrc.indexOf("\n", callEnd);
    const newFnSrc  = fnSrc.slice(0, lineStart) + fnSrc.slice(lineEnd === -1 ? fnSrc.length : lineEnd + 1);

    return newFnSrc;
}

// Scan fn.js for functions that set globals (via assignment at top scope),
// then check if var.js uses those globals without first calling the function.
// If so, prepend the call to var.js.
function injectVarJsSetupCalls(dir: string, setupCallsInjected: string[], manualFlags: string[]): void {
    const fnPath  = path.join(dir, "fn.js");
    const varPath = path.join(dir, "var.js");
    if (!fs.existsSync(fnPath) || !fs.existsSync(varPath)) return;

    const fnSrc  = fs.readFileSync(fnPath,  "utf8");
    const varSrc = fs.readFileSync(varPath, "utf8");

    // Find function names in fn.js that assign to bare globals (e.g. EasyKey_uCase = ...)
    const globalSetters = new Map<string, string[]>(); // fnName → [globals it sets]
    const fnDeclRe = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\())/g;
    let fnMatch: RegExpExecArray | null;
    while ((fnMatch = fnDeclRe.exec(fnSrc)) !== null) {
        const fnName = fnMatch[1] ?? fnMatch[2];
        if (!fnName) continue;
        // Find the function body using brace depth
        let i = fnMatch.index, depth = 0, started = false;
        let body = "";
        while (i < fnSrc.length) {
            if (fnSrc[i] === "{") { depth++; started = true; }
            else if (fnSrc[i] === "}") { depth--; if (started && depth === 0) { body = fnSrc.slice(fnMatch.index, i + 1); break; } }
            i++;
        }
        // Skip DOM-manipulating functions — they're trial-time handlers, not setup functions
        if (/document\.\w+\s*\(|getElementById|querySelector|\.style\b|\.innerHTML\b/.test(body)) continue;

        // Collect bare assignments (not object keys, not var/let/const declarations)
        // Match any identifier (upper or lower case) immediately followed by =,
        // excluding keyword-led lines (let/const/var/if/for/return)
        const assignRe = /^[ \t]*(?!(?:let|const|var|if|for|while|return|function|\/\/)\s)([a-zA-Z_][a-zA-Z_0-9]+)\s*=/mg;
        const globals: string[] = [];
        let aMatch: RegExpExecArray | null;
        while ((aMatch = assignRe.exec(body)) !== null) {
            globals.push(aMatch[1]);
        }
        if (globals.length) globalSetters.set(fnName, globals);
    }

    const injected: string[] = [];
    const preexisting: string[] = [];
    for (const [fnName, globals] of globalSetters) {
        // Check if var.js uses any of these globals at top level (not inside a function)
        const usedInVar = globals.some(g => new RegExp(`\\b${g}\\b`).test(varSrc));
        const alreadyCalled = new RegExp(`\\b${fnName}\\s*\\(`).test(varSrc);
        if (usedInVar && !alreadyCalled) {
            injected.push(fnName);
        } else if (usedInVar && alreadyCalled) {
            // Call already present but let→var conversion may still be needed
            preexisting.push(fnName);
        }
    }

    if (injected.length || preexisting.length) {
        const calls = injected.map(fn => `${fn}();`).join("\n");

        // The setup functions set globals via bare assignment (e.g. practiceHardRewardValue = [...]).
        // If var.js redeclares those same names with `let`, the let binding shadows the global.
        // Convert `let X;` / `let X = []` / `let X = value` to `var` for all globals those
        // functions set — including pre-existing calls that the migration tool didn't inject.
        const globalsToVar = new Set<string>();
        for (const fnName of [...injected, ...preexisting]) {
            const globals = globalSetters.get(fnName);
            if (globals) globals.forEach(g => globalsToVar.add(g));
        }
        let patchedVarSrc = varSrc;
        for (const g of globalsToVar) {
            patchedVarSrc = patchedVarSrc.replace(
                new RegExp(`\\blet\\s+(${g})\\b`, "g"),
                "var $1"
            );
        }

        const newSrc = injected.length ? `${calls}\n\n${patchedVarSrc}` : patchedVarSrc;
        if (newSrc !== varSrc) {
            fs.writeFileSync(varPath, newSrc);
            setupCallsInjected.push(...injected);
            if (injected.length) manualFlags.push(`var.js: verify setup calls run correctly: ${injected.join(", ")}`);
            if (preexisting.length) manualFlags.push(`var.js: converted let→var for pre-existing setup globals: ${preexisting.join(", ")}`);
        }
    }
}
