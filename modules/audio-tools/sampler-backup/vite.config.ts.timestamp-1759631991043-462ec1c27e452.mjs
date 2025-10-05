// vite.config.ts
import { defineConfig } from "file:///Users/orion/work/ol_dsp/modules/audio-tools/node_modules/.pnpm/vite@5.4.20_@types+node@22.18.8/node_modules/vite/dist/node/index.js";
import { resolve } from "path";
import dts from "file:///Users/orion/work/ol_dsp/modules/audio-tools/node_modules/.pnpm/vite-plugin-dts@4.5.4_@types+node@22.18.8_typescript@5.9.3_vite@5.4.20/node_modules/vite-plugin-dts/dist/index.mjs";
var __vite_injected_original_dirname = "/Users/orion/work/ol_dsp/modules/audio-tools/sampler-backup";
var vite_config_default = defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      include: ["src/**/*"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"]
    })
  ],
  css: false,
  // Disable CSS processing for Node.js library
  build: {
    lib: {
      entry: {
        index: resolve(__vite_injected_original_dirname, "src/index.ts"),
        "cli/backup": resolve(__vite_injected_original_dirname, "src/cli/backup.ts")
      },
      formats: ["es"]
    },
    rollupOptions: {
      external: [
        "commander",
        "pathe",
        "@oletizi/sampler-devices",
        "@oletizi/sampler-lib",
        // Node.js built-ins
        "module",
        "fs",
        "fs/promises",
        "path",
        "util",
        "os",
        "stream",
        "buffer",
        "process",
        "child_process"
      ],
      output: {
        preserveModules: false,
        entryFileNames: "[name].js"
      }
    },
    target: "node18",
    minify: false,
    sourcemap: true
  },
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "test/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "src/cli/**"
        // CLI tested with integration tests
      ]
    },
    testTimeout: 5e3,
    hookTimeout: 3e3
  },
  resolve: {
    alias: {
      "@": resolve(__vite_injected_original_dirname, "src")
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvb3Jpb24vd29yay9vbF9kc3AvbW9kdWxlcy9hdWRpby10b29scy9zYW1wbGVyLWJhY2t1cFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL29yaW9uL3dvcmsvb2xfZHNwL21vZHVsZXMvYXVkaW8tdG9vbHMvc2FtcGxlci1iYWNrdXAvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL29yaW9uL3dvcmsvb2xfZHNwL21vZHVsZXMvYXVkaW8tdG9vbHMvc2FtcGxlci1iYWNrdXAvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoJztcbmltcG9ydCBkdHMgZnJvbSAndml0ZS1wbHVnaW4tZHRzJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIGR0cyh7XG4gICAgICBpbnNlcnRUeXBlc0VudHJ5OiB0cnVlLFxuICAgICAgaW5jbHVkZTogWydzcmMvKiovKiddLFxuICAgICAgZXhjbHVkZTogWydzcmMvKiovKi50ZXN0LnRzJywgJ3NyYy8qKi8qLnNwZWMudHMnXSxcbiAgICB9KVxuICBdLFxuICBjc3M6IGZhbHNlLCAvLyBEaXNhYmxlIENTUyBwcm9jZXNzaW5nIGZvciBOb2RlLmpzIGxpYnJhcnlcbiAgYnVpbGQ6IHtcbiAgICBsaWI6IHtcbiAgICAgIGVudHJ5OiB7XG4gICAgICAgIGluZGV4OiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9pbmRleC50cycpLFxuICAgICAgICAnY2xpL2JhY2t1cCc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2NsaS9iYWNrdXAudHMnKVxuICAgICAgfSxcbiAgICAgIGZvcm1hdHM6IFsnZXMnXVxuICAgIH0sXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgZXh0ZXJuYWw6IFtcbiAgICAgICAgJ2NvbW1hbmRlcicsXG4gICAgICAgICdwYXRoZScsXG4gICAgICAgICdAb2xldGl6aS9zYW1wbGVyLWRldmljZXMnLFxuICAgICAgICAnQG9sZXRpemkvc2FtcGxlci1saWInLFxuICAgICAgICAvLyBOb2RlLmpzIGJ1aWx0LWluc1xuICAgICAgICAnbW9kdWxlJyxcbiAgICAgICAgJ2ZzJyxcbiAgICAgICAgJ2ZzL3Byb21pc2VzJyxcbiAgICAgICAgJ3BhdGgnLFxuICAgICAgICAndXRpbCcsXG4gICAgICAgICdvcycsXG4gICAgICAgICdzdHJlYW0nLFxuICAgICAgICAnYnVmZmVyJyxcbiAgICAgICAgJ3Byb2Nlc3MnLFxuICAgICAgICAnY2hpbGRfcHJvY2VzcydcbiAgICAgIF0sXG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgcHJlc2VydmVNb2R1bGVzOiBmYWxzZSxcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6ICdbbmFtZV0uanMnXG4gICAgICB9XG4gICAgfSxcbiAgICB0YXJnZXQ6ICdub2RlMTgnLFxuICAgIG1pbmlmeTogZmFsc2UsXG4gICAgc291cmNlbWFwOiB0cnVlXG4gIH0sXG4gIHRlc3Q6IHtcbiAgICBnbG9iYWxzOiB0cnVlLFxuICAgIGVudmlyb25tZW50OiAnbm9kZScsXG4gICAgY292ZXJhZ2U6IHtcbiAgICAgIHByb3ZpZGVyOiAndjgnLFxuICAgICAgcmVwb3J0ZXI6IFsndGV4dCcsICdodG1sJ10sXG4gICAgICBleGNsdWRlOiBbXG4gICAgICAgICdub2RlX21vZHVsZXMvKionLFxuICAgICAgICAnZGlzdC8qKicsXG4gICAgICAgICd0ZXN0LyoqJyxcbiAgICAgICAgJyoqLyoudGVzdC50cycsXG4gICAgICAgICcqKi8qLnNwZWMudHMnLFxuICAgICAgICAnc3JjL2NsaS8qKicgLy8gQ0xJIHRlc3RlZCB3aXRoIGludGVncmF0aW9uIHRlc3RzXG4gICAgICBdXG4gICAgfSxcbiAgICB0ZXN0VGltZW91dDogNTAwMCxcbiAgICBob29rVGltZW91dDogMzAwMFxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMnKVxuICAgIH1cbiAgfVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQW1XLFNBQVMsb0JBQW9CO0FBQ2hZLFNBQVMsZUFBZTtBQUN4QixPQUFPLFNBQVM7QUFGaEIsSUFBTSxtQ0FBbUM7QUFJekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsSUFBSTtBQUFBLE1BQ0Ysa0JBQWtCO0FBQUEsTUFDbEIsU0FBUyxDQUFDLFVBQVU7QUFBQSxNQUNwQixTQUFTLENBQUMsb0JBQW9CLGtCQUFrQjtBQUFBLElBQ2xELENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxLQUFLO0FBQUE7QUFBQSxFQUNMLE9BQU87QUFBQSxJQUNMLEtBQUs7QUFBQSxNQUNILE9BQU87QUFBQSxRQUNMLE9BQU8sUUFBUSxrQ0FBVyxjQUFjO0FBQUEsUUFDeEMsY0FBYyxRQUFRLGtDQUFXLG1CQUFtQjtBQUFBLE1BQ3REO0FBQUEsTUFDQSxTQUFTLENBQUMsSUFBSTtBQUFBLElBQ2hCO0FBQUEsSUFDQSxlQUFlO0FBQUEsTUFDYixVQUFVO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBO0FBQUEsUUFFQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLFFBQVE7QUFBQSxRQUNOLGlCQUFpQjtBQUFBLFFBQ2pCLGdCQUFnQjtBQUFBLE1BQ2xCO0FBQUEsSUFDRjtBQUFBLElBQ0EsUUFBUTtBQUFBLElBQ1IsUUFBUTtBQUFBLElBQ1IsV0FBVztBQUFBLEVBQ2I7QUFBQSxFQUNBLE1BQU07QUFBQSxJQUNKLFNBQVM7QUFBQSxJQUNULGFBQWE7QUFBQSxJQUNiLFVBQVU7QUFBQSxNQUNSLFVBQVU7QUFBQSxNQUNWLFVBQVUsQ0FBQyxRQUFRLE1BQU07QUFBQSxNQUN6QixTQUFTO0FBQUEsUUFDUDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUE7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLElBQ0EsYUFBYTtBQUFBLElBQ2IsYUFBYTtBQUFBLEVBQ2Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssUUFBUSxrQ0FBVyxLQUFLO0FBQUEsSUFDL0I7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
