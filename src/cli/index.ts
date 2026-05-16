#!/usr/bin/env node
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import * as p from "@clack/prompts";
import { scanPlugins, scanLocalPlugins } from "../server/utils/pluginScanner";
import { PLUGIN_REGISTRY } from "../server/utils/plugins";
import { isV6Experiment, migrateV6ToV7 } from "./migrateV6";

const args = process.argv.slice(2);
const command = args[0];

if (command === "init") {
    runInit();
} else {
    runServer();
}

function runServer() {
    if (args.includes("--bundle")) {
        console.log("Bundle mode (webpack) — coming soon.");
        process.exit(0);
    }

    const port = args.find(a => a.startsWith("--port="))?.split("=")[1] ?? "3000";
    const experimentDir = process.cwd();
    const dataDir = path.join(experimentDir, "data");
    const serverEntry = path.join(__dirname, "../server/index.js");

    console.log("Mode: no-bundle");
    spawnSync("node", [serverEntry], {
        stdio: "inherit",
        env: {
            ...process.env,
            PORT: port,
            EXPERIMENT_DIR: experimentDir,
            DATA_DIR: dataDir,
        },
    });
}

async function runInit() {
    const experimentDir = process.cwd();
    const pkgPath = path.join(experimentDir, "package.json");

    if (fs.existsSync(pkgPath)) {
        p.log.error("package.json already exists. Run 'npm run dev' to start the server.");
        process.exit(1);
    }

    p.intro("jspsych-wrap");

    const importExisting = await p.confirm({
        message: "Would you like to import an existing experiment?",
        initialValue: false,
    });

    if (p.isCancel(importExisting)) { p.cancel("Cancelled."); process.exit(0); }

    let sourcePath: string | undefined;

    if (importExisting) {
        const input = await p.text({
            message: "Path to existing experiment:",
            placeholder: "/Applications/MAMP/htdocs/myExperiment",
            validate(value) {
                const resolved = path.resolve(experimentDir, value);
                if (!fs.existsSync(resolved)) return `Directory not found: ${resolved}`;
                if (!fs.statSync(resolved).isDirectory()) return "Path must be a directory";
            },
        });
        if (p.isCancel(input)) { p.cancel("Cancelled."); process.exit(0); }
        sourcePath = path.resolve(experimentDir, input as string);
    }

    const experimentName = path.basename(experimentDir);
    const s = p.spinner();

    // package.json
    s.start("Creating package.json");
    const pkg = {
        name: experimentName,
        private: true,
        scripts: {
            dev: "jspsych-wrap",
            "dev:port": "jspsych-wrap --port=8080",
        },
        dependencies: { "jspsych-wrap": "^1.0.0" },
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    s.stop("Created package.json");

    // Directories to scaffold
    const templatesDir  = path.join(__dirname, "../../templates/exp");
    const cssTemplatesDir = path.join(__dirname, "../../templates/css");
    const pluginSrcDir  = path.join(__dirname, "../../client/plugins");
    const templateIndex = path.join(__dirname, "../../templates/index.html");

    const dirs: Array<{ name: string; dest: string; src?: string; templateSrc?: string; isFile?: boolean }> = [
        { name: "index.html", dest: path.join(experimentDir, "index.html"), src: sourcePath ? path.join(sourcePath, "index.html") : undefined, templateSrc: templateIndex, isFile: true },
        { name: "exp/",       dest: path.join(experimentDir, "exp"),        src: sourcePath ? path.join(sourcePath, "exp") : undefined,       templateSrc: templatesDir },
        { name: "css/",       dest: path.join(experimentDir, "css"),        src: sourcePath ? path.join(sourcePath, "css") : undefined,       templateSrc: cssTemplatesDir },
        { name: "plugins/",   dest: path.join(experimentDir, "plugins"),    src: sourcePath ? path.join(sourcePath, "plugins") : undefined,   templateSrc: pluginSrcDir },
        { name: "stim/",      dest: path.join(experimentDir, "stim"),       src: sourcePath ? path.join(sourcePath, "stim") : undefined },
        { name: "data/",      dest: path.join(experimentDir, "data") },
    ];

    for (const dir of dirs) {
        if (fs.existsSync(dir.dest)) continue;

        if (dir.isFile) {
            const from = dir.src && fs.existsSync(dir.src) ? dir.src : dir.templateSrc!;
            fs.copyFileSync(from, dir.dest);
            p.log.success(`${dir.src && fs.existsSync(dir.src) ? "Imported" : "Created"} ${dir.name}`);
            continue;
        }

        fs.mkdirSync(dir.dest);

        if (dir.src && fs.existsSync(dir.src)) {
            copyDir(dir.src, dir.dest);
            p.log.success(`Imported ${dir.name}`);
        } else if (dir.templateSrc && fs.existsSync(dir.templateSrc)) {
            copyDir(dir.templateSrc, dir.dest);
            p.log.success(`Created ${dir.name}`);
        } else {
            fs.writeFileSync(path.join(dir.dest, ".gitkeep"), "");
            p.log.success(`Created ${dir.name}`);
        }
    }

    // jQuery remediation — rewrite $.getScript calls to loadScript
    if (importExisting) {
        const expDir = path.join(experimentDir, "exp");
        const remediatedFiles: string[] = [];
        const manualFiles: string[] = [];

        for (const file of fs.readdirSync(expDir)) {
            if (!file.endsWith(".js")) continue;
            const filePath = path.join(expDir, file);
            const original = fs.readFileSync(filePath, "utf8");

            // Simple: $.getScript("path") or $.getScript('path')
            let updated = original.replace(/\$\.getScript\((['"][^'"]+['"])\)/g, "loadScript($1)");

            // Chained: $.getScript("path").done(...).fail(...) — flag for manual review
            if (/\$\.getScript\(/.test(updated)) {
                manualFiles.push(file);
            } else if (updated !== original) {
                fs.writeFileSync(filePath, updated);
                remediatedFiles.push(file);
            }
        }

        if (remediatedFiles.length) p.log.success(`jQuery remediated: ${remediatedFiles.join(", ")}`);
        if (manualFiles.length)     p.log.warn(`Manual jQuery removal needed (chained calls): ${manualFiles.join(", ")}`);
    }

    // CSS consolidation — merge all imported CSS files into exp.css, strip wrap duplicates
    if (importExisting) {
        s.start("Consolidating CSS");
        const { files, pruned } = consolidateCss(path.join(experimentDir, "css"));
        if (files.length) {
            const pruneNote = pruned > 0 ? `, ${pruned} wrap duplicate${pruned !== 1 ? "s" : ""} removed` : "";
            s.stop(`CSS consolidated into exp.css: ${files.join(", ")}${pruneNote}`);
        } else {
            s.stop("CSS: nothing to consolidate");
        }
    }

    // conf.js — inject missing variables required by the wrap
    if (importExisting) {
        const patched = patchConfJs(experimentDir);
        if (patched.length) p.log.success(`conf.js patched: added ${patched.join(", ")}`);
    }

    // fn.js — remove functions already provided by the wrap to prevent duplicate declarations
    if (importExisting) {
        const dupes = removeDuplicateFunctions(experimentDir);
        for (const { file, removed } of dupes) {
            p.log.success(`${file} deduplicated: removed ${removed.join(", ")} (provided by wrap)`);
        }
    }

    // jsPsych v6 → v7 migration
    if (importExisting && isV6Experiment(experimentDir)) {
        const upgrade = await p.confirm({
            message: "jsPsych 6 detected — upgrade to jsPsych 7?",
            initialValue: true,
        });
        if (!p.isCancel(upgrade) && upgrade) {
            const { typesMigrated, keycodesFixed, initTransformed, manualFlags } = migrateV6ToV7(experimentDir);
            if (typesMigrated.length)   p.log.success(`Plugin types upgraded: ${typesMigrated.join(", ")}`);
            if (keycodesFixed.length)   p.log.success(`Keycode choices updated: ${keycodesFixed.join(", ")}`);
            if (initTransformed.length) p.log.success(`jsPsych.init() migrated: ${initTransformed.join(", ")}`);
            for (const flag of manualFlags) p.log.warn(flag);
        }
    }

    // Install dependencies
    s.start("Installing dependencies");
    const result = spawnSync("npm", ["install", path.join(__dirname, "../../")], {
        cwd: experimentDir,
        stdio: "pipe",
    });
    if (result.status !== 0) {
        s.stop("Install failed");
        p.log.error("Run 'npm install' manually.");
        process.exit(1);
    }
    s.stop("Installed dependencies");

    // Verify jsPsych plugins
    const found = scanPlugins(experimentDir);
    if (found.size > 0) {
        const localPlugins = scanLocalPlugins(experimentDir);
        const known: string[] = [];
        const local: string[] = [];
        const unknown: string[] = [];
        for (const name of found) {
            if (PLUGIN_REGISTRY[name])    known.push(name);
            else if (localPlugins.has(name)) local.push(name);
            else                          unknown.push(name);
        }
        if (known.length)   p.log.success(`Plugins (registry): ${known.join(", ")}`);
        if (local.length)   p.log.success(`Plugins (local):    ${local.join(", ")}`);
        if (unknown.length) p.log.warn(`Unknown plugins — add CDN tags to index.html: ${unknown.join(", ")}`);
    }

    p.outro(`Ready! Start your experiment with: npm run dev`);
}

// Append missing wrap-required variables to exp/conf.js
function patchConfJs(experimentDir: string): string[] {
    const confPath = path.join(experimentDir, "exp", "conf.js");
    if (!fs.existsSync(confPath)) return [];
    const src = fs.readFileSync(confPath, "utf8");
    const additions: string[] = [];
    const patched: string[] = [];
    if (!/\brepetitions\b/.test(src)) { additions.push("const repetitions = null;"); patched.push("repetitions"); }
    if (!/\bphase\b/.test(src))       { additions.push("let phase = undefined;");    patched.push("phase"); }
    if (!/\bplaywright\b/.test(src))  { additions.push("const playwright = false;"); patched.push("playwright"); }
    if (additions.length) fs.writeFileSync(confPath, src.trimEnd() + "\n\n" + additions.join("\n") + "\n");
    return patched;
}

// Remove a single named function/const/let/var declaration using brace-depth tracking
function removeFunctionDecl(src: string, name: string): { src: string; removed: boolean } {
    const pattern = new RegExp(
        `(^|\\n)((?:(?:async\\s+)?function\\s+${name}\\s*\\(|(?:const|let|var)\\s+${name}\\s*=)[\\s\\S]*?)(?=\\n(?:function|const|let|var|async\\s+function|$)|$)`,
    );
    // Simpler: find start position, then track braces to find end
    const re = new RegExp(`(?:^|\\n)(?:(?:async\\s+)?function\\s+${name}\\b|(?:const|let|var)\\s+${name}\\s*=)`, "m");
    const match = re.exec(src);
    if (!match) return { src, removed: false };

    const start = match.index === 0 ? 0 : match.index + 1;
    let depth = 0, i = start, foundOpen = false;
    while (i < src.length) {
        if (src[i] === "{") { depth++; foundOpen = true; }
        else if (src[i] === "}") {
            depth--;
            if (foundOpen && depth === 0) {
                let end = i + 1;
                // consume optional semicolon
                if (src[end] === ";") end++;
                return { src: src.slice(0, start) + src.slice(end), removed: true };
            }
        }
        i++;
    }
    return { src, removed: false };
}

// Functions defined in wrap's fn.js and validate.js — remove from exp/fn.js if duplicated
const WRAP_FN_NAMES = [
    "saveData", "saveDataPromise", "testDataSave", "writeCsvRedirect",
    "areYouSure", "dataSaveAnimation", "loadScript",
    "openFullscreen", "closeFullscreen", "handleFullscreen",
    "getRepetitions", "shuffleArray", "translate",
    "generateTimestamp", "buildBaseFilename",
];

function removeDuplicateFunctions(experimentDir: string): { file: string; removed: string[] }[] {
    const results: { file: string; removed: string[] }[] = [];
    for (const filename of ["fn.js"]) {
        const filePath = path.join(experimentDir, "exp", filename);
        if (!fs.existsSync(filePath)) continue;
        let src = fs.readFileSync(filePath, "utf8");
        const original = src;
        const removed: string[] = [];
        for (const name of WRAP_FN_NAMES) {
            const result = removeFunctionDecl(src, name);
            if (result.removed) { src = result.src; removed.push(name); }
        }
        if (src !== original) { fs.writeFileSync(filePath, src); results.push({ file: filename, removed }); }
    }
    return results;
}

// Parse CSS into top-level rules using brace-depth tracking.
// Handles regular rules, @keyframes, @media, etc.
function parseCssRules(css: string): Array<{ selector: string; raw: string }> {
    const rules: Array<{ selector: string; raw: string }> = [];
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    let i = 0;
    while (i < stripped.length) {
        while (i < stripped.length && /\s/.test(stripped[i])) i++;
        if (i >= stripped.length) break;
        let j = i;
        while (j < stripped.length && stripped[j] !== "{") j++;
        if (j >= stripped.length) break;
        const selector = stripped.slice(i, j).trim();
        let depth = 0, k = j;
        while (k < stripped.length) {
            if (stripped[k] === "{") depth++;
            else if (stripped[k] === "}") { depth--; if (depth === 0) { k++; break; } }
            k++;
        }
        rules.push({ selector, raw: stripped.slice(i, k).trim() });
        i = k;
    }
    return rules;
}

function normSel(sel: string): string {
    return sel.split(",").map(s => s.trim().replace(/\s+/g, " ")).sort().join(",");
}

function consolidateCss(cssDir: string): { files: string[]; pruned: number } {
    if (!fs.existsSync(cssDir)) return { files: [], pruned: 0 };

    const importFiles = fs.readdirSync(cssDir).filter(f => f.endsWith(".css") && f !== "exp.css");
    if (!importFiles.length) return { files: [], pruned: 0 };

    // Build wrap-owned selector set from the bundled style.css
    const wrapStylePath = path.join(__dirname, "../../client/lib/style.css");
    const wrapCss = fs.existsSync(wrapStylePath) ? fs.readFileSync(wrapStylePath, "utf8") : "";
    const wrapSelectors = new Set(parseCssRules(wrapCss).map(r => normSel(r.selector)));

    const parts: string[] = [];
    let totalPruned = 0;

    for (const file of importFiles) {
        const content = fs.readFileSync(path.join(cssDir, file), "utf8");
        const rules = parseCssRules(content);
        const kept = rules.filter(r => !wrapSelectors.has(normSel(r.selector)));
        totalPruned += rules.length - kept.length;
        const body = kept.map(r => r.raw).join("\n\n").trim();
        if (body) parts.push(`/* --- ${file} --- */\n${body}`);
        fs.unlinkSync(path.join(cssDir, file));
    }

    const expCssPath = path.join(cssDir, "exp.css");
    const existing = fs.existsSync(expCssPath) ? fs.readFileSync(expCssPath, "utf8").trim() : "";
    const combined = [...parts, ...(existing ? [`/* --- exp.css --- */\n${existing}`] : [])].join("\n\n");
    fs.writeFileSync(expCssPath, combined + "\n");

    return { files: importFiles, pruned: totalPruned };
}

function copyDir(src: string, dest: string) {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
