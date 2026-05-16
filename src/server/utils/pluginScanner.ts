import fs from "fs";
import path from "path";

export function scanPlugins(experimentDir: string): Set<string> {
    const expDir = path.join(experimentDir, "exp");
    const found = new Set<string>();
    if (!fs.existsSync(expDir)) return found;

    for (const file of fs.readdirSync(expDir)) {
        if (!file.endsWith(".js")) continue;
        const src = fs.readFileSync(path.join(expDir, file), "utf8");
        for (const match of src.matchAll(/\bjsPsych[A-Z][a-zA-Z]+/g)) {
            found.add(match[0]);
        }
    }
    return found;
}

// Returns a map of jsPsych variable name → local path for plugins found in plugins/
export function scanLocalPlugins(experimentDir: string): Map<string, string> {
    const pluginsDir = path.join(experimentDir, "plugins");
    const found = new Map<string, string>();
    if (!fs.existsSync(pluginsDir)) return found;

    for (const file of fs.readdirSync(pluginsDir)) {
        if (!file.endsWith(".js")) continue;
        const src = fs.readFileSync(path.join(pluginsDir, file), "utf8");
        const match = src.match(/^var (jsPsych[A-Z][a-zA-Z]+)\s*=/m);
        if (match) found.set(match[1], `/plugins/${file}`);
    }
    return found;
}
