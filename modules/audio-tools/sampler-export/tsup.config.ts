import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts", "src/cli/extract.ts"],
    format: ["cjs", "esm"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    tsconfig: "./tsconfig.build.json",
});
