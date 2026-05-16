#!/usr/bin/env node
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";

const args = process.argv.slice(2);
const command = args[0];

if (command === "init") {
    runInit();
} else {
    runServer();
}

function runServer() {
    const port = args.find(a => a.startsWith("--port="))?.split("=")[1] ?? "3000";
    const experimentDir = process.cwd();
    const dataDir = path.join(experimentDir, "data");
    const serverEntry = path.join(__dirname, "../server/index.js");

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

function runInit() {
    const experimentDir = process.cwd();
    const pkgPath = path.join(experimentDir, "package.json");
    const expDir = path.join(experimentDir, "exp");
    const dataDir = path.join(experimentDir, "data");
    const templatesDir = path.join(__dirname, "../../templates/exp");
    const cssDir = path.join(experimentDir, "css");
    const cssTemplatesDir = path.join(__dirname, "../../templates/css");
    const stimDir = path.join(experimentDir, "stim");
    const pluginsDir = path.join(experimentDir, "plugins");
    const templateIndex = path.join(__dirname, "../../templates/index.html");
    const experimentIndex = path.join(experimentDir, "index.html");

    if (fs.existsSync(pkgPath)) {
        console.error("package.json already exists. Run 'npm run dev' to start the server.");
        process.exit(1);
    }

    const experimentName = path.basename(experimentDir);

    // Write package.json
    const pkg = {
        name: experimentName,
        private: true,
        scripts: {
            dev: "jspsych-wrap",
            "dev:port": "jspsych-wrap --port=8080",
        },
        dependencies: {
            "jspsych-wrap": `^1.0.0`,
        },
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log("Created package.json");

    // Create exp/ from templates
    if (!fs.existsSync(expDir)) {
        fs.mkdirSync(expDir);
        const templateFiles = fs.readdirSync(templatesDir);
        for (const file of templateFiles) {
            fs.copyFileSync(path.join(templatesDir, file), path.join(expDir, file));
        }
        console.log(`Created exp/ with ${templateFiles.join(", ")}`);
    } else {
        console.log("exp/ already exists — skipping scaffold");
    }

    // Create css/
    if (!fs.existsSync(cssDir)) {
        fs.mkdirSync(cssDir);
        const cssFiles = fs.readdirSync(cssTemplatesDir);
        for (const file of cssFiles) {
            fs.copyFileSync(path.join(cssTemplatesDir, file), path.join(cssDir, file));
        }
        console.log("Created css/");
    }

    // Copy index.html
    if (!fs.existsSync(experimentIndex)) {
        fs.copyFileSync(templateIndex, experimentIndex);
        console.log("Created index.html");
    }

    // Create stim/
    if (!fs.existsSync(stimDir)) {
        fs.mkdirSync(stimDir);
        fs.writeFileSync(path.join(stimDir, ".gitkeep"), "");
        console.log("Created stim/");
    }

    // Create plugins/ and copy default plugin files
    if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir);
        const pluginSrcDir = path.join(__dirname, "../../client/plugins");
        const pluginFiles = fs.readdirSync(pluginSrcDir);
        for (const file of pluginFiles) {
            fs.copyFileSync(path.join(pluginSrcDir, file), path.join(pluginsDir, file));
        }
        console.log(`Created plugins/ with ${pluginFiles.join(", ")}`);
    }

    // Create data/
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
        fs.writeFileSync(path.join(dataDir, ".gitkeep"), "");
        console.log("Created data/");
    }

    // Install dependencies
    console.log("\nInstalling dependencies...");
    const installResult = spawnSync("npm", ["install", path.join(__dirname, "../../")], {
        stdio: "inherit",
        cwd: experimentDir,
    });

    if (installResult.status !== 0) {
        console.error("\nFailed to install dependencies. Run 'npm install' manually.");
        process.exit(1);
    }

    console.log(`\nDone! Start your experiment with:\n  npm run dev\n`);
}
