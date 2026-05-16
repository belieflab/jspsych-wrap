import express from "express";
import fs from "fs";
import path from "path";
import portfinder from "portfinder";
import { dataRouter } from "./routes/data";
import { redirectRouter } from "./routes/redirect";
import { gitCommitHash } from "./utils/gitHash";
import { scanPlugins } from "./utils/pluginScanner";
import { injectPlugins } from "./utils/injectPlugins";

const BASE_PORT = parseInt(process.env.PORT ?? "3000", 10);
const EXPERIMENT_DIR = process.env.EXPERIMENT_DIR ?? process.cwd();
const DATA_DIR = process.env.DATA_DIR ?? path.join(EXPERIMENT_DIR, "data");

const app = express();

app.use(express.json());

// API: git version for display in forms (replaces PHP gitCommitHash())
app.get("/api/version", (_req, res) => {
    const version = gitCommitHash(EXPERIMENT_DIR);
    res.json({ version: version || null });
});

// Browser error forwarding — logs client-side errors to the terminal
app.post("/api/log", (req, res) => {
    const { level = "error", message, source, line } = req.body ?? {};
    const location = [source, line].filter(Boolean).join(":");
    console.error(`[browser] ${level}: ${message}${location ? ` (${location})` : ""}`);
    res.json({ ok: true });
});

// Participant routing (replaces link/redirect.php)
app.use(redirectRouter(EXPERIMENT_DIR));

// Data persistence (replaces link/data.php)
app.use(dataRouter(DATA_DIR));

// Serve wrap client assets — dist/client/ sits one level above dist/server/
app.use("/wrap", express.static(path.join(__dirname, "../client")));

// Serve experiment static files (index.html, exp/, css/, etc.)
app.use(express.static(EXPERIMENT_DIR));

// Scan exp/ for jsPsych* plugin references and inject missing CDN tags into HTML.
const TEMPLATE_INDEX = path.join(__dirname, "../templates/index.html");
const indexPath = fs.existsSync(path.join(EXPERIMENT_DIR, "index.html"))
    ? path.join(EXPERIMENT_DIR, "index.html")
    : TEMPLATE_INDEX;
const rawHtml = fs.readFileSync(indexPath, "utf8");
const neededPlugins = scanPlugins(EXPERIMENT_DIR);
const { html: injectedHtml, injected, unknown } = injectPlugins(rawHtml, neededPlugins);
if (injected.length) console.log(`Plugins auto-loaded: ${injected.join(", ")}`);
if (unknown.length)  console.warn(`Unknown plugins (add CDN tag to index.html): ${unknown.join(", ")}`);

// SPA fallback — serve injected HTML. Return 404 for asset requests so missing files don't silently return HTML.
const ASSET_RE = /\.(js|css|map|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|json|csv)$/i;
app.get("*", (req, res) => {
    if (ASSET_RE.test(req.path)) {
        res.status(404).send(`Not found: ${req.path}`);
        return;
    }
    res.type("html").send(injectedHtml);
});

portfinder.basePort = BASE_PORT;
portfinder.getPort((err, port) => {
    if (err) {
        console.error("Could not find an available port:", err);
        process.exit(1);
    }
    app.listen(port, () => {
        const version = gitCommitHash(EXPERIMENT_DIR);
        if (port !== BASE_PORT) {
            console.log(`Port ${BASE_PORT} in use — using ${port} instead.`);
        }
        console.log(`jspsych-wrap running on http://localhost:${port}`);
        console.log(`Experiment: ${EXPERIMENT_DIR}`);
        console.log(`Data:       ${DATA_DIR}`);
        if (version) console.log(`Git         ${version}`);
    });
});

export default app;
