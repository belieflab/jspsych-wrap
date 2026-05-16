import express from "express";
import fs from "fs";
import path from "path";
import portfinder from "portfinder";
import { dataRouter } from "./routes/data";
import { redirectRouter } from "./routes/redirect";
import { gitCommitHash } from "./utils/gitHash";
import { scanPlugins, scanLocalPlugins } from "./utils/pluginScanner";
import { injectPlugins } from "./utils/injectPlugins";
import { discoverExperiments, watchExperiments } from "./utils/multiServe";

const BASE_PORT = parseInt(process.env.PORT ?? "3000", 10);
const SERVE_MODE = process.env.SERVE_MODE;
const ASSET_RE = /\.(js|css|map|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|json|csv)$/i;
const CLIENT_DIR = path.join(__dirname, "../client");
const TEMPLATE_INDEX = path.join(__dirname, "../templates/index.html");

const app = express();
app.use(express.json());

// API routes are global across both modes
app.get("/api/version", (_req, res) => {
    const dir = SERVE_MODE === "multi"
        ? (process.env.EXPERIMENTS_DIR ?? process.cwd())
        : (process.env.EXPERIMENT_DIR ?? process.cwd());
    res.json({ version: gitCommitHash(dir) || null });
});

app.post("/api/log", (req, res) => {
    const { level = "error", message, source, line } = req.body ?? {};
    const location = [source, line].filter(Boolean).join(":");
    console.error(`[browser] ${level}: ${message}${location ? ` (${location})` : ""}`);
    res.json({ ok: true });
});

if (SERVE_MODE === "multi") {
    // ── Multi-experiment server ──────────────────────────────────────────────
    const EXPERIMENTS_DIR = process.env.EXPERIMENTS_DIR ?? process.cwd();
    const templateHtml = fs.readFileSync(TEMPLATE_INDEX, "utf8");

    const cache = discoverExperiments(EXPERIMENTS_DIR, templateHtml);
    watchExperiments(EXPERIMENTS_DIR, cache, templateHtml);

    // Shared wrap assets (same for all experiments)
    app.use("/wrap", express.static(CLIENT_DIR));

    // Root: experiment listing
    app.get("/", (_req, res) => {
        const experiments = [...cache.keys()].sort();
        const items = experiments.map(n => `  <li><a href="/${n}/">${n}</a></li>`).join("\n");
        res.type("html").send(
            `<!DOCTYPE html><html><head><title>jspsych-wrap</title></head><body><h2>Experiments</h2><ul>\n${items}\n</ul></body></html>`
        );
    });

    // Per-experiment data endpoint
    app.post("/:expName/data", (req, res) => {
        const entry = cache.get(req.params.expName);
        if (!entry) { res.status(404).json({ success: false, error: "Unknown experiment" }); return; }
        const { filename, filedata } = req.body as { filename?: string; filedata?: string };
        if (!filename || !filedata) { res.status(400).json({ success: false, error: "Missing filename or filedata" }); return; }
        const safeName = path.basename(filename);
        const filePath = path.join(entry.dataDir, `${safeName}.csv`);
        try {
            fs.mkdirSync(entry.dataDir, { recursive: true });
            fs.writeFileSync(filePath, filedata, "utf8");
            console.log(`Data saved: ${filePath}`);
            res.json({ success: true });
        } catch (err) {
            console.error("Failed to save data:", err);
            res.status(500).json({ success: false, error: String(err) });
        }
    });

    // Per-experiment participant redirect
    app.get("/:expName/redirect", (req, res) => {
        const { expName } = req.params;
        const entry = cache.get(expName);
        if (!entry) { res.status(404).send("Unknown experiment"); return; }
        const { workerId, PROLIFIC_PID, participantId } = req.query as Record<string, string>;
        if (workerId)           res.redirect(302, `/${expName}/?workerId=${encodeURIComponent(workerId)}`);
        else if (PROLIFIC_PID)  res.redirect(302, `/${expName}/?PROLIFIC_PID=${encodeURIComponent(PROLIFIC_PID)}`);
        else if (participantId) res.redirect(302, `/${expName}/?participantId=${encodeURIComponent(participantId)}`);
        else res.status(403).send("Access denied");
    });

    // Per-experiment static files — Express strips /:expName prefix before calling static
    app.use("/:expName", (req, res, next) => {
        const entry = cache.get(req.params.expName);
        if (!entry) return next();
        express.static(entry.dir, { index: false })(req, res, next);
    });

    // SPA catch-all: serve experiment HTML or 404 for missing assets
    app.get("*", (req, res) => {
        const expName = req.path.split("/").filter(Boolean)[0] ?? "";
        const entry = cache.get(expName);
        if (!entry) { res.status(404).send("Not found"); return; }
        if (ASSET_RE.test(req.path)) { res.status(404).send(`Not found: ${req.path}`); return; }
        res.type("html").send(entry.html);
    });

} else {
    // ── Single-experiment server (unchanged) ─────────────────────────────────
    const EXPERIMENT_DIR = process.env.EXPERIMENT_DIR ?? process.cwd();
    const DATA_DIR = process.env.DATA_DIR ?? path.join(EXPERIMENT_DIR, "data");

    app.use(redirectRouter(EXPERIMENT_DIR));
    app.use(dataRouter(DATA_DIR));
    app.use("/wrap", express.static(CLIENT_DIR));
    app.use(express.static(EXPERIMENT_DIR, { index: false }));

    const indexPath = fs.existsSync(path.join(EXPERIMENT_DIR, "index.html"))
        ? path.join(EXPERIMENT_DIR, "index.html")
        : TEMPLATE_INDEX;
    const rawHtml = fs.readFileSync(indexPath, "utf8");
    const neededPlugins = scanPlugins(EXPERIMENT_DIR);
    const localPlugins  = scanLocalPlugins(EXPERIMENT_DIR);
    const { html: injectedHtml, injected, unknown } = injectPlugins(rawHtml, neededPlugins, localPlugins, EXPERIMENT_DIR);
    if (injected.length) console.log(`Plugins auto-loaded: ${injected.join(", ")}`);
    if (unknown.length)  console.warn(`Unknown plugins (add CDN tag to index.html): ${unknown.join(", ")}`);

    app.get("*", (req, res) => {
        if (ASSET_RE.test(req.path)) { res.status(404).send(`Not found: ${req.path}`); return; }
        res.type("html").send(injectedHtml);
    });
}

// ── Start server ─────────────────────────────────────────────────────────────
portfinder.basePort = BASE_PORT;
portfinder.getPort((err, port) => {
    if (err) { console.error("Could not find an available port:", err); process.exit(1); }
    const workDir = SERVE_MODE === "multi"
        ? (process.env.EXPERIMENTS_DIR ?? process.cwd())
        : (process.env.EXPERIMENT_DIR ?? process.cwd());
    app.listen(port, () => {
        const version = gitCommitHash(workDir);
        if (port !== BASE_PORT) console.log(`Port ${BASE_PORT} in use — using ${port} instead.`);
        if (SERVE_MODE === "multi") {
            console.log(`jspsych-wrap [multi] running on http://localhost:${port}`);
            console.log(`Experiments: ${workDir}`);
        } else {
            console.log(`jspsych-wrap running on http://localhost:${port}`);
            console.log(`Experiment: ${workDir}`);
            console.log(`Data:       ${process.env.DATA_DIR ?? path.join(workDir, "data")}`);
        }
        if (version) console.log(`Git         ${version}`);
    });
});

export default app;
