// vite.config.ts
import { defineConfig } from "file:///Users/orion/work/ol_dsp/modules/audio-tools/node_modules/.pnpm/vite@5.4.20_@types+node@22.18.8/node_modules/vite/dist/node/index.js";
import { resolve } from "path";
import dts from "file:///Users/orion/work/ol_dsp/modules/audio-tools/node_modules/.pnpm/vite-plugin-dts@4.5.4_@types+node@22.18.8_typescript@5.9.3_vite@5.4.20/node_modules/vite-plugin-dts/dist/index.mjs";
var __vite_injected_original_dirname = "/Users/orion/work/ol_dsp/modules/audio-tools/sampler-midi";
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
        index: resolve(__vite_injected_original_dirname, "src/index.ts")
      },
      formats: ["es", "cjs"]
    },
    rollupOptions: {
      external: [
        "@oletizi/sampler-devices",
        "@oletizi/sampler-lib",
        "easymidi",
        "pathe",
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
    // Use include pattern that can be overridden by CLI filters
    include: ["test/**/*.test.ts"],
    // Exclude integration by default
    exclude: ["node_modules/**", "dist/**", "test/integration/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "test/**",
        "**/*.test.ts",
        "**/*.spec.ts"
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    testTimeout: 5e3,
    hookTimeout: 3e3
  },
  resolve: {
    alias: {
      "@": resolve(__vite_injected_original_dirname, "src"),
      "tests": resolve(__vite_injected_original_dirname, "test")
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvb3Jpb24vd29yay9vbF9kc3AvbW9kdWxlcy9hdWRpby10b29scy9zYW1wbGVyLW1pZGlcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9vcmlvbi93b3JrL29sX2RzcC9tb2R1bGVzL2F1ZGlvLXRvb2xzL3NhbXBsZXItbWlkaS92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvb3Jpb24vd29yay9vbF9kc3AvbW9kdWxlcy9hdWRpby10b29scy9zYW1wbGVyLW1pZGkvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoJztcbmltcG9ydCBkdHMgZnJvbSAndml0ZS1wbHVnaW4tZHRzJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIGR0cyh7XG4gICAgICBpbnNlcnRUeXBlc0VudHJ5OiB0cnVlLFxuICAgICAgaW5jbHVkZTogWydzcmMvKiovKiddLFxuICAgICAgZXhjbHVkZTogWydzcmMvKiovKi50ZXN0LnRzJywgJ3NyYy8qKi8qLnNwZWMudHMnXSxcbiAgICB9KVxuICBdLFxuICBjc3M6IGZhbHNlLCAvLyBEaXNhYmxlIENTUyBwcm9jZXNzaW5nIGZvciBOb2RlLmpzIGxpYnJhcnlcbiAgYnVpbGQ6IHtcbiAgICBsaWI6IHtcbiAgICAgIGVudHJ5OiB7XG4gICAgICAgIGluZGV4OiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9pbmRleC50cycpXG4gICAgICB9LFxuICAgICAgZm9ybWF0czogWydlcycsICdjanMnXVxuICAgIH0sXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgZXh0ZXJuYWw6IFtcbiAgICAgICAgJ0BvbGV0aXppL3NhbXBsZXItZGV2aWNlcycsXG4gICAgICAgICdAb2xldGl6aS9zYW1wbGVyLWxpYicsXG4gICAgICAgICdlYXN5bWlkaScsXG4gICAgICAgICdwYXRoZScsXG4gICAgICAgIC8vIE5vZGUuanMgYnVpbHQtaW5zXG4gICAgICAgICdtb2R1bGUnLFxuICAgICAgICAnZnMnLFxuICAgICAgICAnZnMvcHJvbWlzZXMnLFxuICAgICAgICAncGF0aCcsXG4gICAgICAgICd1dGlsJyxcbiAgICAgICAgJ29zJyxcbiAgICAgICAgJ3N0cmVhbScsXG4gICAgICAgICdidWZmZXInLFxuICAgICAgICAncHJvY2VzcycsXG4gICAgICAgICdjaGlsZF9wcm9jZXNzJ1xuICAgICAgXSxcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBwcmVzZXJ2ZU1vZHVsZXM6IGZhbHNlLFxuICAgICAgICBlbnRyeUZpbGVOYW1lczogJ1tuYW1lXS5qcydcbiAgICAgIH1cbiAgICB9LFxuICAgIHRhcmdldDogJ25vZGUxOCcsXG4gICAgbWluaWZ5OiBmYWxzZSxcbiAgICBzb3VyY2VtYXA6IHRydWVcbiAgfSxcbiAgdGVzdDoge1xuICAgIGdsb2JhbHM6IHRydWUsXG4gICAgZW52aXJvbm1lbnQ6ICdub2RlJyxcbiAgICAvLyBVc2UgaW5jbHVkZSBwYXR0ZXJuIHRoYXQgY2FuIGJlIG92ZXJyaWRkZW4gYnkgQ0xJIGZpbHRlcnNcbiAgICBpbmNsdWRlOiBbJ3Rlc3QvKiovKi50ZXN0LnRzJ10sXG4gICAgLy8gRXhjbHVkZSBpbnRlZ3JhdGlvbiBieSBkZWZhdWx0XG4gICAgZXhjbHVkZTogWydub2RlX21vZHVsZXMvKionLCAnZGlzdC8qKicsICd0ZXN0L2ludGVncmF0aW9uLyoqJ10sXG4gICAgY292ZXJhZ2U6IHtcbiAgICAgIHByb3ZpZGVyOiAndjgnLFxuICAgICAgcmVwb3J0ZXI6IFsndGV4dCcsICdodG1sJ10sXG4gICAgICBleGNsdWRlOiBbXG4gICAgICAgICdub2RlX21vZHVsZXMvKionLFxuICAgICAgICAnZGlzdC8qKicsXG4gICAgICAgICd0ZXN0LyoqJyxcbiAgICAgICAgJyoqLyoudGVzdC50cycsXG4gICAgICAgICcqKi8qLnNwZWMudHMnXG4gICAgICBdLFxuICAgICAgdGhyZXNob2xkczoge1xuICAgICAgICBsaW5lczogODAsXG4gICAgICAgIGZ1bmN0aW9uczogODAsXG4gICAgICAgIGJyYW5jaGVzOiA4MCxcbiAgICAgICAgc3RhdGVtZW50czogODBcbiAgICAgIH1cbiAgICB9LFxuICAgIHRlc3RUaW1lb3V0OiA1MDAwLFxuICAgIGhvb2tUaW1lb3V0OiAzMDAwXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0AnOiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYycpLFxuICAgICAgJ3Rlc3RzJzogcmVzb2x2ZShfX2Rpcm5hbWUsICd0ZXN0JylcbiAgICB9XG4gIH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE2VixTQUFTLG9CQUFvQjtBQUMxWCxTQUFTLGVBQWU7QUFDeEIsT0FBTyxTQUFTO0FBRmhCLElBQU0sbUNBQW1DO0FBSXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLElBQUk7QUFBQSxNQUNGLGtCQUFrQjtBQUFBLE1BQ2xCLFNBQVMsQ0FBQyxVQUFVO0FBQUEsTUFDcEIsU0FBUyxDQUFDLG9CQUFvQixrQkFBa0I7QUFBQSxJQUNsRCxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsS0FBSztBQUFBO0FBQUEsRUFDTCxPQUFPO0FBQUEsSUFDTCxLQUFLO0FBQUEsTUFDSCxPQUFPO0FBQUEsUUFDTCxPQUFPLFFBQVEsa0NBQVcsY0FBYztBQUFBLE1BQzFDO0FBQUEsTUFDQSxTQUFTLENBQUMsTUFBTSxLQUFLO0FBQUEsSUFDdkI7QUFBQSxJQUNBLGVBQWU7QUFBQSxNQUNiLFVBQVU7QUFBQSxRQUNSO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUE7QUFBQSxRQUVBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0EsUUFBUTtBQUFBLFFBQ04saUJBQWlCO0FBQUEsUUFDakIsZ0JBQWdCO0FBQUEsTUFDbEI7QUFBQSxJQUNGO0FBQUEsSUFDQSxRQUFRO0FBQUEsSUFDUixRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEsRUFDYjtBQUFBLEVBQ0EsTUFBTTtBQUFBLElBQ0osU0FBUztBQUFBLElBQ1QsYUFBYTtBQUFBO0FBQUEsSUFFYixTQUFTLENBQUMsbUJBQW1CO0FBQUE7QUFBQSxJQUU3QixTQUFTLENBQUMsbUJBQW1CLFdBQVcscUJBQXFCO0FBQUEsSUFDN0QsVUFBVTtBQUFBLE1BQ1IsVUFBVTtBQUFBLE1BQ1YsVUFBVSxDQUFDLFFBQVEsTUFBTTtBQUFBLE1BQ3pCLFNBQVM7QUFBQSxRQUNQO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLFlBQVk7QUFBQSxRQUNWLE9BQU87QUFBQSxRQUNQLFdBQVc7QUFBQSxRQUNYLFVBQVU7QUFBQSxRQUNWLFlBQVk7QUFBQSxNQUNkO0FBQUEsSUFDRjtBQUFBLElBQ0EsYUFBYTtBQUFBLElBQ2IsYUFBYTtBQUFBLEVBQ2Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssUUFBUSxrQ0FBVyxLQUFLO0FBQUEsTUFDN0IsU0FBUyxRQUFRLGtDQUFXLE1BQU07QUFBQSxJQUNwQztBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
