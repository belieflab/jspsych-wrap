import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        "server/index": "src/server/index.ts",
    },
    format: ["cjs"],
    target: "node18",
    clean: true,
    sourcemap: true,
});
