import express from "express";
import path from "path";
import { dataRouter } from "./routes/data";
import { redirectRouter } from "./routes/redirect";
import { gitCommitHash } from "./utils/gitHash";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const EXPERIMENT_DIR = process.env.EXPERIMENT_DIR ?? process.cwd();
const DATA_DIR = process.env.DATA_DIR ?? path.join(EXPERIMENT_DIR, "data");

const app = express();

app.use(express.json());

// API: git version for display in forms (replaces PHP gitCommitHash())
app.get("/api/version", (_req, res) => {
    const version = gitCommitHash(EXPERIMENT_DIR);
    res.json({ version: version || null });
});

// Participant routing (replaces link/redirect.php)
app.use(redirectRouter(EXPERIMENT_DIR));

// Data persistence (replaces link/data.php)
app.use(dataRouter(DATA_DIR));

// Serve wrap client assets from this package's own directory
app.use("/wrap", express.static(path.join(__dirname, "../../client")));

// Serve experiment static files (index.html, exp/, css/, etc.)
app.use(express.static(EXPERIMENT_DIR));

// SPA fallback — serve index.html for any unmatched route
app.get("*", (_req, res) => {
    res.sendFile(path.join(EXPERIMENT_DIR, "index.html"));
});

app.listen(PORT, () => {
    const version = gitCommitHash(EXPERIMENT_DIR);
    console.log(`jspsych-wrap server running on http://localhost:${PORT}`);
    console.log(`Serving experiment from: ${EXPERIMENT_DIR}`);
    console.log(`Data directory: ${DATA_DIR}`);
    if (version) console.log(`Git ${version}`);
});

export default app;
