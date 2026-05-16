import fs from "fs";
import path from "path";
import { PLUGIN_REGISTRY } from "./plugins";

export function injectPlugins(
    html: string,
    needed: Set<string>,
    localPlugins: Map<string, string> = new Map(),
    experimentDir: string = ""
): { html: string; injected: string[]; unknown: string[] } {
    const injected: string[] = [];
    const unknown: string[] = [];
    const tags: string[] = [];

    for (const name of needed) {
        let url = localPlugins.get(name) ?? PLUGIN_REGISTRY[name];
        if (!url) { unknown.push(name); continue; }
        if (html.includes(url)) continue; // already in index.html

        // If the registry points to /plugins/ but the file doesn't exist locally,
        // fall back to /wrap/plugins/ which is always available from the package.
        if (url.startsWith("/plugins/") && experimentDir) {
            const localFile = path.join(experimentDir, url);
            if (!fs.existsSync(localFile)) {
                url = "/wrap" + url;
            }
        }

        tags.push(`  <script src="${url}"></script>`);
        injected.push(name);
    }

    if (tags.length) {
        html = html.replace("</head>", `${tags.join("\n")}\n</head>`);
    }

    return { html, injected, unknown };
}
