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

        // 4. Flag button_html — removed in v7
        if (/\bbutton_html\b/.test(src)) {
            manualFlags.push(`${file}: button_html removed in jsPsych 7 — use choices: [] for button labels`);
        }

        // 5. Flag jQuery keyCode / .which — switch to KeyboardEvent.key
        if (/\.keyCode\b|\.which\b/.test(src)) {
            manualFlags.push(`${file}: .keyCode/.which → update to KeyboardEvent.key string comparisons`);
        }

        if (src !== original) fs.writeFileSync(filePath, src);
    }

    return {
        typesMigrated: [...typesMigrated],
        keycodesFixed: [...keycodesFixed],
        initTransformed,
        manualFlags,
    };
}
