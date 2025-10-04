import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        "cli/extract": "src/cli/extract.ts",
    },
    format: ["cjs", "esm"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    tsconfig: "./tsconfig.build.json",
    shims: true, // Add shebang support for CLI
});
