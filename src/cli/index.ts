#!/usr/bin/env node
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import * as p from "@clack/prompts";
import { scanPlugins, scanLocalPlugins } from "../server/utils/pluginScanner";
import { PLUGIN_REGISTRY } from "../server/utils/plugins";

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
