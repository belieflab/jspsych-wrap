import { defineConfig } from "tsup";
import { cpSync } from "fs";

export default defineConfig({
    entry: {
        "server/index": "src/server/index.ts",
        "cli/index": "src/cli/index.ts",
    },
    format: ["cjs"],
    target: "node18",
    clean: true,
    sourcemap: true,
    onSuccess() {
        cpSync("templates", "dist/templates", { recursive: true });
        cpSync("client",    "dist/client",    { recursive: true });
    },
});
