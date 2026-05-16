import { PLUGIN_REGISTRY } from "./plugins";

export function injectPlugins(
    html: string,
    needed: Set<string>
): { html: string; injected: string[]; unknown: string[] } {
    const injected: string[] = [];
    const unknown: string[] = [];
    const tags: string[] = [];

    for (const name of needed) {
        const url = PLUGIN_REGISTRY[name];
        if (!url) { unknown.push(name); continue; }
        if (html.includes(url)) continue; // already in index.html
        tags.push(`  <script src="${url}"></script>`);
        injected.push(name);
    }

    if (tags.length) {
        html = html.replace("</head>", `${tags.join("\n")}\n</head>`);
    }

    return { html, injected, unknown };
}
