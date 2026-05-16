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
