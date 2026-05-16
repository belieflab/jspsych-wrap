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
    initTransformed: string[];
    manualFlags: string[];
}

export function migrateV6ToV7(expDir: string): MigrationResult {
    const typesMigrated = new Set<string>();
    const keycodesFixed = new Set<string>();
    const initTransformed: string[] = [];
    const manualFlags: string[] = [];

    const dir = path.join(expDir, "exp");
    if (!fs.existsSync(dir)) {
        return { typesMigrated: [], keycodesFixed: [], initTransformed, manualFlags };
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
            keycodesFixed.add(file);
        }
        if (/jsPsych\.ALL_KEYS\b/.test(src)) {
            src = src.replace(/\bjsPsych\.ALL_KEYS\b/g, '"ALL_KEYS"');
            keycodesFixed.add(file);
        }

        // 5. Flag button_html — removed in v7
        if (/\bbutton_html\b/.test(src)) {
            manualFlags.push(`${file}: button_html removed in jsPsych 7 — use choices: [] for button labels`);
        }

        // 6. Flag jQuery keyCode / .which — switch to KeyboardEvent.key
        if (/\.keyCode\b|\.which\b/.test(src)) {
            manualFlags.push(`${file}: .keyCode/.which → update to KeyboardEvent.key string comparisons`);
        }

        if (src !== original) fs.writeFileSync(filePath, src);
    }

    // Detect setup functions in fn.js that must run before var.js
    // Pattern: fn.js defines a function that sets globals used at the top level of var.js
    injectVarJsSetupCalls(dir, manualFlags);

    return {
        typesMigrated: [...typesMigrated],
        keycodesFixed: [...keycodesFixed],
        initTransformed,
        manualFlags,
    };
}

// Scan fn.js for functions that set globals (via assignment at top scope),
// then check if var.js uses those globals without first calling the function.
// If so, prepend the call to var.js.
function injectVarJsSetupCalls(dir: string, manualFlags: string[]): void {
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
        // Collect bare assignments (not object keys, not var/let/const declarations)
        const assignRe = /^[ \t]*([A-Z][a-zA-Z_]+)\s*=/mg;
        const globals: string[] = [];
        let aMatch: RegExpExecArray | null;
        while ((aMatch = assignRe.exec(body)) !== null) {
            globals.push(aMatch[1]);
        }
        if (globals.length) globalSetters.set(fnName, globals);
    }

    const injected: string[] = [];
    for (const [fnName, globals] of globalSetters) {
        // Check if var.js uses any of these globals at top level (not inside a function)
        const usedInVar = globals.some(g => new RegExp(`\\b${g}\\b`).test(varSrc));
        const alreadyCalled = new RegExp(`\\b${fnName}\\s*\\(`).test(varSrc);
        if (usedInVar && !alreadyCalled) {
            injected.push(fnName);
        }
    }

    if (injected.length) {
        const calls = injected.map(fn => `${fn}();`).join("\n");
        fs.writeFileSync(varPath, `// Setup calls injected by jspsych-wrap migration\n${calls}\n\n${varSrc}`);
        manualFlags.push(`var.js: prepended setup calls — verify these run correctly: ${injected.join(", ")}`);
    }
}
