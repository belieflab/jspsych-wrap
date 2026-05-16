import fs from "fs";
import path from "path";
import { scanPlugins, scanLocalPlugins } from "./pluginScanner";
import { injectPlugins } from "./injectPlugins";

export interface ExperimentEntry {
    name: string;
    dir: string;
    dataDir: string;
    html: string;
}

function isValidExperiment(dir: string): boolean {
    return fs.existsSync(path.join(dir, "exp", "conf.js"));
}

export function buildExperimentHtml(
    name: string,
    dir: string,
    templateHtml: string
): string {
    const indexPath = path.join(dir, "index.html");
    const rawHtml = fs.existsSync(indexPath)
        ? fs.readFileSync(indexPath, "utf8")
        : templateHtml;

    const neededPlugins = scanPlugins(dir);
    const localPlugins  = scanLocalPlugins(dir);
    const { html: withPlugins, injected, unknown } = injectPlugins(rawHtml, neededPlugins, localPlugins, dir);

    if (injected.length) console.log(`[${name}] Plugins auto-loaded: ${injected.join(", ")}`);
    if (unknown.length)  console.warn(`[${name}] Unknown plugins: ${unknown.join(", ")}`);

    // Rewrite absolute /exp/ paths → /${name}/exp/ ($.getScript calls and src/href attributes)
    let html = withPlugins.replace(/(['"\s=])\/exp\//g, `$1/${name}/exp/`);

    // Inject window.__WRAP_BASE__ so fn.js can resolve the /data endpoint per experiment
    html = html.replace("</head>", `  <script>window.__WRAP_BASE__ = '/${name}';</script>\n</head>`);

    return html;
}

export function discoverExperiments(
    experimentsDir: string,
    templateHtml: string
): Map<string, ExperimentEntry> {
    const cache = new Map<string, ExperimentEntry>();
    if (!fs.existsSync(experimentsDir)) return cache;

    for (const entry of fs.readdirSync(experimentsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const dir = path.join(experimentsDir, entry.name);
        if (!isValidExperiment(dir)) continue;

        const name = entry.name;
        try {
            const html = buildExperimentHtml(name, dir, templateHtml);
            cache.set(name, { name, dir, dataDir: path.join(dir, "data"), html });
            console.log(`[jspsych-wrap] discovered: ${name}`);
        } catch (err) {
            console.warn(`[jspsych-wrap] Could not load experiment "${name}": ${err}`);
        }
    }
    return cache;
}

export function watchExperiments(
    experimentsDir: string,
    cache: Map<string, ExperimentEntry>,
    templateHtml: string
): void {
    try {
        fs.watch(experimentsDir, (event, filename) => {
            if (!filename || cache.has(filename)) return;
            const dir = path.join(experimentsDir, filename);
            // Delay to let git clone finish writing files before scanning
            setTimeout(() => {
                try {
                    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
                    if (!isValidExperiment(dir)) return;
                    const html = buildExperimentHtml(filename, dir, templateHtml);
                    cache.set(filename, { name: filename, dir, dataDir: path.join(dir, "data"), html });
                    console.log(`[jspsych-wrap] new experiment detected: ${filename}`);
                } catch { /* ignore transient errors during clone */ }
            }, 2000);
        });
    } catch (err) {
        console.warn("[jspsych-wrap] Could not watch experiments directory:", err);
    }
}
